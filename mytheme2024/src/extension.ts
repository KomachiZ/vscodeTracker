// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { COMMADN_TYPE } from './config';
import * as XLSX from 'xlsx';
import ActionLogger from './ActionLogger';
import * as fs from 'fs';
import * as path from 'path';
import { create } from 'domain';
import * as http from 'http'; 


// 定义XLSX数据字段
interface XLSX_Data {
	Themes: string;
	Score: number;
}
let jsonFavorite:any;

function loadFavoriteThemesByFile(allThemes:any) {
	try {
		let favoriteFile = __dirname + '/../Favorite.xlsx';
		const workbook = XLSX.readFile(favoriteFile);
		const sheetName = workbook.SheetNames[0]; 
		const worksheet = workbook.Sheets[sheetName];
		const jsonData = XLSX.utils.sheet_to_json(worksheet);
		return jsonData;
	} catch (e) {
		let newDefault = allThemes.slice(0, 10);
		saveFavoriteThemesByFile(newDefault);
		return newDefault;
		//return null;
	}
}

function saveFavoriteThemesByFile(favoriteThemes:any) {
	try {
		const worksheet = XLSX.utils.json_to_sheet(favoriteThemes);
		const workbook = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');

		let favoriteFile = __dirname + '/../Favorite.xlsx';
		const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
		// 将二进制数据写入文件
		fs.writeFileSync(favoriteFile, excelBuffer);
	} catch (e) {
	}
}

function getAllThemes() {
	// 获取全部扩展
	const allExtensions = vscode.extensions.all;
  
	// 筛选主题扩展
	const themeExtensions = allExtensions.filter(extension => {
	  const contributes = extension.packageJSON?.contributes;
	  return contributes?.themes?.length > 0;
	});
  
	// 提取主题名称
	const themeNames: string[] = [];
	themeExtensions.forEach(extension => {
	  const contributes = extension.packageJSON?.contributes;
	  const themes = contributes?.themes || [];
	  themes.forEach((theme: { label: string; uiTheme: any; }) => {
		if (theme.label && theme.uiTheme) {
		  themeNames.push(theme.label);
		}
	  });
	});
  
	return themeNames;
}
export async function activate(context: vscode.ExtensionContext) {

		//login
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
		"Themes", // Topic for the logger d
		"http://127.0.0.1:5000/log", // Backend server URL
		['openDocument'], // Actions to monitor
		userId
	);

	// 读取全部主题的xlsx数据文件
	let themesFile = __dirname + '/../Themes Database.xlsx';
	const workbook = XLSX.readFile(themesFile);
	const sheetName = workbook.SheetNames[0]; // 假设您要读取第一个工作表的数据
	const worksheet = workbook.Sheets[sheetName];
	const jsonData = XLSX.utils.sheet_to_json(worksheet);
	// 按Score降序排序
	jsonData.sort(((a:XLSX_Data, b:XLSX_Data) => b.Score - a.Score) as () => number);
	// 读收藏的主题xlsx文件到json
	jsonFavorite = loadFavoriteThemesByFile(jsonData);
	// 按Score降序排序
	jsonFavorite.sort(((a:XLSX_Data, b:XLSX_Data) => b.Score - a.Score) as () => number);

	// 注册打开收藏主题列表的命令以及事件处理
	let disposableOpenList = vscode.commands.registerCommand('mytheme.openFavoriteThemesList', () => {
		const items: vscode.QuickPickItem[] = [];
		if (jsonFavorite === null) {
			return;
		}
		const showThemes = jsonFavorite;//jsonData.slice(0, 10);

		// 获取全部安装的主题
		const allInstalledThemes = getAllThemes();

		// 添加到列表
		showThemes.map((row: any) => {
			const themeName = row['Themes'].toString();
			let info = '';
  			if (!allInstalledThemes.includes(themeName)) {
				info = ' Not Installed';
			}

			const currentTheme = vscode.workspace.getConfiguration().get('workbench.colorTheme');
			if (themeName === currentTheme) {
				items.push( {label: "* " + row['Themes'].toString(), description: /*'Score:' + row['Score'].toString() +*/ info});
			} else {
				items.push( {label: row['Themes'].toString(), description: /*'Score:' + row['Score'].toString() +*/ info});
			}


		});
	
		// 列表选中事件

		vscode.window.showQuickPick(items).then(selectedItem => {
			console.log('进入选中事件:', selectedItem);
			if (!selectedItem?.label.length) {
				return;
			}

			// 选择的主题就是当前主题，则返回
			let selectedTheme = selectedItem?.label.toString();
			if (selectedTheme.charAt(0) === '*') {
				return;
			}

			if (!allInstalledThemes.includes(selectedTheme)) {
				// 未安装主题
				return;
			}

			// 在这里可以处理用户选择的列表项
			// vscode.window.showInformationMessage(`You selected ${selectedTheme}`);
			// 设置新的主题
			vscode.workspace.getConfiguration().update('workbench.colorTheme', selectedTheme, vscode.ConfigurationTarget.Global);
			// 主题改变完成一些动作,变更收藏行为的icon
			themeChange(selectedTheme);
			// 记录到csv文件
			logger.logAction('click favorite theme', { clickedTheme: selectedTheme});
			//recordToCsv("select favorite theme", selectedTheme, "");
		});
	});
	context.subscriptions.push(disposableOpenList);


	// 注册喜欢按钮的处理事件
	let disposableLike = vscode.commands.registerCommand('MyTheme.like', () => {
		// 获取当前主题
		const currentTheme:any = vscode.workspace.getConfiguration().get('workbench.colorTheme');

		// 在全部主题中查询当前主题
		const query = jsonData.filter((item:any) => item.Themes === currentTheme);
		

		if (query.length) {
			// 将主题添加到收藏json列表中
			jsonFavorite.push(query[0]);
			// 按Score降序排序
			jsonFavorite.sort(((a:XLSX_Data, b:XLSX_Data) => b.Score - a.Score) as () => number);
			// 更新到收藏文件中去
			saveFavoriteThemesByFile(jsonFavorite);
			// 更新显示或隐藏喜欢与不喜欢按钮
			themeChange(currentTheme);
		}
		//recordToCsv("favorite theme", currentTheme, "");
		logger.logAction('select favorite theme', { favoriteTheme: currentTheme});
	});
	context.subscriptions.push(disposableLike);

	// 注册不喜欢按钮的处理事件
	let disposableDislike = vscode.commands.registerCommand('MyTheme.dislike', () => {
		// 获取当前主题
		const currentTheme:any = vscode.workspace.getConfiguration().get('workbench.colorTheme');

		// 在收藏主题中查询当前主题的索引
		const targetIndex = jsonFavorite.findIndex((item:any) => item.Themes === currentTheme);
		if (targetIndex !== -1) {
			// 删除查询到的数据
			jsonFavorite.splice(targetIndex, 1);
			// 更新到收藏文件中去
			saveFavoriteThemesByFile(jsonFavorite);
			// 更新显示或隐藏喜欢与不喜欢按钮
			themeChange(currentTheme);
		}
		//recordToCsv("disFavorite theme", currentTheme, "");
		logger.logAction('select disFavorite theme', { disFavoriteThemes: currentTheme});
	});
	context.subscriptions.push(disposableDislike);

	// 注册默认主题按钮的处理事件
	let disposableDefaultTheme = vscode.commands.registerCommand('mytheme.defaultTheme', () => {
		const defaultThemeName = 'Visual Studio Dark';
		vscode.workspace.getConfiguration().update('workbench.colorTheme', defaultThemeName, vscode.ConfigurationTarget.Global);
		// 主题改变完成一些动作
		themeChange(defaultThemeName);
		// 记录到csv文件
		//recordToCsv("Change2Default theme", defaultThemeName, "");
		logger.logAction('Change2Default theme', { default: defaultThemeName});
	});
	context.subscriptions.push(disposableDefaultTheme);

	// 注册循环更换主题按钮的处理事件
	let disposableNextTheme = vscode.commands.registerCommand('mytheme.nextTheme', () => {
		// 获取全部安装的主题
		const allInstalledThemes = getAllThemes();
		//console.log('全部安装的主题:', allInstalledThemes);
		// 获取当前主题
		const currentTheme:any = vscode.workspace.getConfiguration().get('workbench.colorTheme');
		//console.log('当前主题:', currentTheme);
		// 在全部主题中查询当前主题的索引
		let targetIndex = jsonData.findIndex((item:any) => item.Themes === currentTheme);
		if (targetIndex === -1) {
			targetIndex = 0;
		}

		// 查找下一个可以用的主题，并设置生效
		let newTheme = "";
		let matchingThemes: string[] = [];

		// 查找匹配的主题
		jsonData.forEach((element: any) => {
			if (allInstalledThemes.includes(element.Themes)) {
				matchingThemes.push(element.Themes);
			}
		});
		// 输出匹配的主题列表
		console.log('匹配的主题列表:', matchingThemes);
		for (let i = targetIndex + 1; i < jsonData.length; i++) {
			const element:any = jsonData[i];
			//console.log('下一个主题索引:', i,'总长度：',jsonData.length);
			if (allInstalledThemes.includes(element.Themes)) {
				newTheme = element.Themes;
				break;
			}
		}
		if (!newTheme.length) {
			for (let i = 0; i < targetIndex; i++) {
				const element:any = jsonData[i];
				if (allInstalledThemes.includes(element.Themes)) {
					newTheme = element.Themes;
					break;
				}
			}	
		}
		console.log('下一个主题:', newTheme);
		if (newTheme.length) {
			// 设置新的主题
			vscode.workspace.getConfiguration().update('workbench.colorTheme', newTheme, vscode.ConfigurationTarget.Global);
			// 主题改变完成一些动作
			themeChange(newTheme);
			// 记录到csv文件
			//recordToCsv("Change theme", newTheme, "");
			logger.logAction('Change theme', { changeTheme: newTheme});
		}
	});
	context.subscriptions.push(disposableNextTheme);

	let myStatusBarItemByLike = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 601);
	myStatusBarItemByLike.text = '$(heart)'; //'$(heart)Like';
	myStatusBarItemByLike.tooltip = 'Add';
	myStatusBarItemByLike.command = 'MyTheme.like';
	context.subscriptions.push(myStatusBarItemByLike);
	//myStatusBarItemByLike.show();

	let myStatusBarItemByDislike = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 602);
	myStatusBarItemByDislike.text = '$(trash)'; //'$(trash)Dislike';
	myStatusBarItemByDislike.tooltip = 'Remove';
	myStatusBarItemByDislike.command = 'MyTheme.dislike';
	context.subscriptions.push(myStatusBarItemByDislike);
	//myStatusBarItemByDislike.show();

	let selectThemeBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 603);
	selectThemeBarItem.text = '$(arrow-up)'; //'$(book)Favorite';
	selectThemeBarItem.tooltip = 'Favorite';
	selectThemeBarItem.command = 'mytheme.openFavoriteThemesList';
	context.subscriptions.push(selectThemeBarItem);
	selectThemeBarItem.show();

	let selectThemeBarItemByDefaultTheme = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 604);
	selectThemeBarItemByDefaultTheme.text = '$(reply)';
	selectThemeBarItemByDefaultTheme.tooltip = 'Default';
	selectThemeBarItemByDefaultTheme.command = 'mytheme.defaultTheme';
	context.subscriptions.push(selectThemeBarItemByDefaultTheme);
	selectThemeBarItemByDefaultTheme.show();

	let selectThemeBarItemByNextTheme = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 605);
	selectThemeBarItemByNextTheme.text = '$(refresh)';
	selectThemeBarItemByNextTheme.tooltip = "I'm Feeling Lucky";
	selectThemeBarItemByNextTheme.command = 'mytheme.nextTheme';
	context.subscriptions.push(selectThemeBarItemByNextTheme);
	selectThemeBarItemByNextTheme.show();

	// 处理主题改变后的事务
	function themeChange(theme:any) {
		// 判断当前主题是否在收藏列表里
		const query = jsonFavorite.filter((item:any) => item.Themes === theme);
		if (query.length) {
			// 主题在收藏中，隐藏喜欢按钮，显示不喜欢按钮
			myStatusBarItemByLike.hide();
			myStatusBarItemByDislike.show();
		}
		else {
			// 主题不在收藏中，显示喜欢按钮，隐藏不喜欢按钮
			myStatusBarItemByLike.show();
			myStatusBarItemByDislike.hide();
		}
	}

	// 获取当前主题
	const currentTheme:any = vscode.workspace.getConfiguration().get('workbench.colorTheme');
	themeChange(currentTheme);
}

// this method is called when your extension is deactivated
export function deactivate() { }
