import * as vscode from 'vscode';
import ActionLogger from './ActionLogger';
import * as fs from 'fs';
import * as path from 'path';
import { create } from 'domain';
import * as http from 'http'; 
export async function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "tracker" is now active!');
	async function validateAndCacheUsername(userId: string) {
		const postData = JSON.stringify({ username: userId });
		const options = {
			hostname: '127.0.0.1', 
			port: 5000, 
			path: '/validate_user', 
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Content-Length': Buffer.byteLength(postData),
			},
		};
	
		return new Promise<void>((resolve, reject) => {
			const req = http.request(options, (res) => {
				if (res.statusCode === 200) {
					console.log('User validated');
					// 保存用户ID到本地
					cacheUsername(userId).then(resolve).catch(reject);
				} else {
					vscode.window.showWarningMessage("Invalid User ID.");
					reject();
				}
			});
	
			req.on('error', (e) => {
				console.error(`Problem with request: ${e.message}`);
				reject();
			});
	
			req.write(postData);
			req.end();
		});
	}
	
	const USERNAME_CACHE_FILE = path.join(context.globalStoragePath, '.usernameCache.json');
	console.log(USERNAME_CACHE_FILE);
	async function getCachedUsername(): Promise<string | undefined> {
      
        if (!fs.existsSync(context.globalStoragePath)) {
            fs.mkdirSync(context.globalStoragePath, { recursive: true });
        }

        try {
            if (fs.existsSync(USERNAME_CACHE_FILE)) {
                const data = fs.readFileSync(USERNAME_CACHE_FILE, 'utf8');
                const cache = JSON.parse(data);
                return cache.username;
            }
        } catch (error) {
            console.error('Error reading username cache:', error);
        }
        return undefined;
    }

    async function cacheUsername(username: string): Promise<void> {
        try {
            fs.writeFileSync(USERNAME_CACHE_FILE, JSON.stringify({ username }), 'utf8');
        } catch (error) {
            console.error('Error writing username cache:', error);
        }
    }
	let userId = await getCachedUsername();
    let attempts = 0;
	while (!userId && attempts < 3) { // 允许用户最多尝试3次,reset按钮
        userId = await vscode.window.showInputBox({
            prompt: "Please enter your User ID",
            placeHolder: "User ID",
        });

        if (userId) {
            try {
                await validateAndCacheUsername(userId);
                break; 
            } catch (error) {
                vscode.window.showWarningMessage("Failed to validate User ID. Please try again.");
                userId = undefined; 
            }
        } else {
            vscode.window.showWarningMessage("User ID is required for logging.");
            break; 
        }

        attempts++; 
    }

    if (!userId) { 
        vscode.window.showErrorMessage("Invalid User ID after 3 attempts. Please contact the administrator.");
        return; 
    }
   

	const logger = new ActionLogger(
		context,
		"base", // Topic for the logger d
		"http://127.0.0.1:5000/log", // Backend server URL
		['openDocument', 'startDebugSession', 'endDebugSession', 'endTaskProcess','execInTerminal','saveDocument'], // Actions to monitor
		userId
	);


	const statusBarButtonItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 601);
	statusBarButtonItem.text = `$(play) Download Templates`;
	statusBarButtonItem.tooltip = 'Download Templates';
	statusBarButtonItem.command = 'extension.downloadPythonTemplates';
	statusBarButtonItem.show();
	const disposableCommand = vscode.commands.registerCommand('extension.downloadPythonTemplates', async () => {

		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders) {
			vscode.window.showErrorMessage("Please open a workspace to download the templates.");
			return;
		}
		const fileList = ['homework1.py', 'homework2.py', 'homework3.py', 'homework4.py', 'homework5.py'];
		const targetFolder = path.join(workspaceFolders[0].uri.fsPath, 'csc111');
		
		try {
			if (!fs.existsSync(targetFolder)) {
				fs.mkdirSync(targetFolder);
			}
			let createdFiles = 0;
			fileList.forEach(async (fileName) => {
				const targetFilePath = path.join(targetFolder, fileName);
				const templatePath = path.join('template', fileName); 
				// Check if file already exists
				if (!fs.existsSync(targetFilePath)) {
					const fileContent = fs.readFileSync(context.asAbsolutePath(templatePath), 'utf8');
					fs.writeFileSync(targetFilePath, fileContent);
					createdFiles++;
				}
			});
	
			if (createdFiles > 0) {
				vscode.window.showInformationMessage(`${createdFiles} CSC111 homework files have been created successfully!`);
			} else {
				vscode.window.showInformationMessage('No new homework files needed to be created.');
			}
			//自定义日志事件
			logger.logAction('user_create_tempalete', { create_number: createdFiles});
		} catch (error) {
			vscode.window.showErrorMessage(`Error creating files: ${error}`);
		}
		 
	});
	// 添加新的状态栏按钮和命令
	const installExtensionButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	installExtensionButton.text = `$(cloud-download) Install ThemeRec-2024`;
	installExtensionButton.tooltip = 'Install ThemeRec-2024 Extension';
	installExtensionButton.command = 'extension.installThemeRec2024';
	installExtensionButton.show();

	const installExtensionCommand = vscode.commands.registerCommand('extension.installThemeRec2024', async () => {
		const extensionId = 'THEMEREC1.ThemeRec2024'; // 替换为正确的发布者和扩展ID
		const extension = vscode.extensions.getExtension(extensionId);

		if (!extension) {
			// 扩展未安装，安装它
			await vscode.commands.executeCommand('workbench.extensions.installExtension', extensionId);
			vscode.window.showInformationMessage('ThemeRec-2024 has been installed.');
		} else {
			// 扩展已安装
			vscode.window.showInformationMessage('ThemeRec-2024 is already installed.');
		}
	});

	context.subscriptions.push(installExtensionButton, installExtensionCommand);

	context.subscriptions.push(statusBarButtonItem);	
	context.subscriptions.push(disposableCommand);

	context.subscriptions.push(logger);
	
    
}

export function deactivate() {}
