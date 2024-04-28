/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ([
/* 0 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.deactivate = exports.activate = void 0;
const vscode = __importStar(__webpack_require__(1));
const ActionLogger_1 = __importDefault(__webpack_require__(2));
const fs = __importStar(__webpack_require__(3));
const path = __importStar(__webpack_require__(4));
const http = __importStar(__webpack_require__(5));
async function activate(context) {
    console.log('Congratulations, your extension "tracker" is now active!');
    async function validateAndCacheUsername(userId) {
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
        return new Promise((resolve, reject) => {
            const req = http.request(options, (res) => {
                if (res.statusCode === 200) {
                    console.log('User validated');
                    // 保存用户ID到本地
                    cacheUsername(userId).then(resolve).catch(reject);
                }
                else {
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
    async function getCachedUsername() {
        if (!fs.existsSync(context.globalStoragePath)) {
            fs.mkdirSync(context.globalStoragePath, { recursive: true });
        }
        try {
            if (fs.existsSync(USERNAME_CACHE_FILE)) {
                const data = fs.readFileSync(USERNAME_CACHE_FILE, 'utf8');
                const cache = JSON.parse(data);
                return cache.username;
            }
        }
        catch (error) {
            console.error('Error reading username cache:', error);
        }
        return undefined;
    }
    async function cacheUsername(username) {
        try {
            fs.writeFileSync(USERNAME_CACHE_FILE, JSON.stringify({ username }), 'utf8');
        }
        catch (error) {
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
            }
            catch (error) {
                vscode.window.showWarningMessage("Failed to validate User ID. Please try again.");
                userId = undefined;
            }
        }
        else {
            vscode.window.showWarningMessage("User ID is required for logging.");
            break;
        }
        attempts++;
    }
    if (!userId) {
        vscode.window.showErrorMessage("Invalid User ID after 3 attempts. Please contact the administrator.");
        return;
    }
    const logger = new ActionLogger_1.default(context, "base", // Topic for the logger d
    "http://127.0.0.1:5000/log", // Backend server URL
    ['openDocument', 'startDebugSession', 'endDebugSession', 'endTaskProcess', 'execInTerminal', 'saveDocument'], // Actions to monitor
    userId);
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
            }
            else {
                vscode.window.showInformationMessage('No new homework files needed to be created.');
            }
            //自定义日志事件
            logger.logAction('user_create_tempalete', { create_number: createdFiles });
        }
        catch (error) {
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
        }
        else {
            // 扩展已安装
            vscode.window.showInformationMessage('ThemeRec-2024 is already installed.');
        }
    });
    context.subscriptions.push(installExtensionButton, installExtensionCommand);
    context.subscriptions.push(statusBarButtonItem);
    context.subscriptions.push(disposableCommand);
    context.subscriptions.push(logger);
}
exports.activate = activate;
function deactivate() { }
exports.deactivate = deactivate;


/***/ }),
/* 1 */
/***/ ((module) => {

module.exports = require("vscode");

/***/ }),
/* 2 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
const vscode = __importStar(__webpack_require__(1));
const fs = __importStar(__webpack_require__(3));
const path = __importStar(__webpack_require__(4));
const http = __importStar(__webpack_require__(5));
class ActionLogger {
    topic;
    backendUrl;
    userId;
    disposables = [];
    queueFlushInterval = 10000; // 10 minutes in milliseconds
    flushTimer;
    cacheFilePath;
    terminalBuffer = '';
    bufferTimeout = null;
    lastTerminalData = {};
    constructor(context, topic, backendUrl, actions, userId) {
        this.topic = topic;
        this.userId = userId;
        this.backendUrl = backendUrl;
        this.cacheFilePath = path.join(context.globalStorageUri.fsPath, '.actionLoggerCache.json');
        console.log(this.cacheFilePath);
        this.ensureCacheFileExists();
        this.subscribeToActions(actions);
        this.startFlushTimer();
    }
    workspaceFolders = vscode.workspace.workspaceFolders;
    isWithinCsc111Folder(filePath) {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            return false;
        }
        const csc111FolderPath = path.join(workspaceFolders[0].uri.fsPath, 'csc111');
        return filePath.startsWith(csc111FolderPath);
    }
    ensureCacheFileExists() {
        const dir = path.dirname(this.cacheFilePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        if (!fs.existsSync(this.cacheFilePath)) {
            fs.writeFileSync(this.cacheFilePath, JSON.stringify([]), 'utf8');
        }
    }
    startFlushTimer() {
        this.flushTimer = setInterval(() => {
            this.flushMessageQueue();
        }, this.queueFlushInterval);
    }
    flushMessageQueue() {
        const logsToFlush = this.readCacheFile();
        if (logsToFlush.length === 0) {
            return;
        }
        const postData = JSON.stringify(logsToFlush);
        const options = {
            hostname: new URL(this.backendUrl).hostname,
            port: new URL(this.backendUrl).port || 80, // Default HTTP port is 80
            path: new URL(this.backendUrl).pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
            },
        };
        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                if (res.statusCode === 202) {
                    console.log('Logs successfully sent to the server');
                    // Clear the cache after successful transmission
                    fs.writeFileSync(this.cacheFilePath, JSON.stringify([]), 'utf8');
                }
                else {
                    console.error(`Failed to send logs, server responded with status code: ${res.statusCode}`);
                }
            });
        });
        req.on('error', (e) => {
            console.error(`Problem with request: ${e.message}`);
        });
        req.write(postData);
        req.end();
    }
    subscribeToActions(actions) {
        actions.forEach(action => {
            switch (action) {
                case 'openDocument':
                    this.disposables.push(vscode.workspace.onDidOpenTextDocument(this.handleOpenDocument.bind(this)));
                    break;
                case 'startDebugSession':
                    this.disposables.push(vscode.debug.onDidStartDebugSession(this.handleStartDebugSession.bind(this)));
                    break;
                case 'endDebugSession':
                    this.disposables.push(vscode.debug.onDidTerminateDebugSession(this.handleTerminateDebugSession.bind(this)));
                    break;
                case 'endTaskProcess':
                    this.disposables.push(vscode.tasks.onDidEndTaskProcess(this.handleEndTaskProcess.bind(this)));
                    break;
                case 'saveDocument':
                    this.disposables.push(vscode.workspace.onDidSaveTextDocument(this.handleSaveDocument.bind(this)));
                    break;
                case 'execInTerminal':
                    this.disposables.push(vscode.window.onDidWriteTerminalData(this.handleExecInTerminal.bind(this)));
                    break;
                //save
            }
        });
    }
    stripAnsiEscapeCodes(text) {
        // Remove ANSI escape sequences
        text = text.replace(/[\u001B\u009B][[\]()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
        // Remove specific UUID followed by control character \u0007
        text = text.replace(/\b[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\u0007/g, '');
        return text;
    }
    handleExecInTerminal(event) {
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor) {
            const filePath = activeEditor.document.uri.fsPath;
            if (this.isWithinCsc111Folder(filePath)) {
                let terminalData = this.stripAnsiEscapeCodes(event.data.toString());
                const lastData = this.lastTerminalData[filePath] || "";
                if (terminalData !== lastData) {
                    this.terminalBuffer += terminalData;
                    if (this.bufferTimeout)
                        clearTimeout(this.bufferTimeout);
                    this.bufferTimeout = setTimeout(() => {
                        this.logAction('execInTerminal', { terminalData: this.terminalBuffer });
                        this.lastTerminalData[filePath] = this.terminalBuffer;
                        this.terminalBuffer = ''; // Clear buffer after logging
                    }, 300); // Delay to accumulate data
                }
            }
        }
    }
    handleOpenDocument(document) {
        if (this.isWithinCsc111Folder(document.uri.fsPath)) {
            this.logAction('openDocument', { fileName: document.fileName });
        }
    }
    handleStartDebugSession(session) {
        if (session.workspaceFolder && this.isWithinCsc111Folder(session.workspaceFolder.uri.fsPath)) {
            this.logAction('startDebugSession', { sessionName: session.name });
        }
    }
    handleTerminateDebugSession(session) {
        if (session.workspaceFolder && this.isWithinCsc111Folder(session.workspaceFolder.uri.fsPath)) {
            this.logAction('endDebugSession', { sessionName: session.name });
        }
    }
    handleEndTaskProcess(event) {
        this.logAction('endTaskProcess', { taskName: event.execution.task.name, exitCode: event.exitCode });
    }
    handleSaveDocument(document) {
        if (this.isWithinCsc111Folder(document.uri.fsPath)) {
            const documentContent = document.getText();
            this.logAction('saveDocument', { fileName: document.fileName, contentPreview: documentContent.substring(0, 500) }); // Logs a preview of document content
        }
    }
    logAction(action, details) {
        const logEntry = {
            timestamp: Date.now().toString(),
            action,
            details,
            userId: this.userId,
            topic: this.topic,
        };
        const currentLogs = this.readCacheFile();
        currentLogs.push(logEntry);
        fs.writeFileSync(this.cacheFilePath, JSON.stringify(currentLogs), 'utf8');
    }
    readCacheFile() {
        try {
            const data = fs.readFileSync(this.cacheFilePath, 'utf8');
            return JSON.parse(data);
        }
        catch (error) {
            console.error('Error reading cache file:', error);
            return [];
        }
    }
    dispose() {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
        }
        this.flushMessageQueue(); // Ensure the queue is flushed on dispose
    }
}
exports["default"] = ActionLogger;


/***/ }),
/* 3 */
/***/ ((module) => {

module.exports = require("fs");

/***/ }),
/* 4 */
/***/ ((module) => {

module.exports = require("path");

/***/ }),
/* 5 */
/***/ ((module) => {

module.exports = require("http");

/***/ })
/******/ 	]);
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module is referenced by other modules so it can't be inlined
/******/ 	var __webpack_exports__ = __webpack_require__(0);
/******/ 	module.exports = __webpack_exports__;
/******/ 	
/******/ })()
;
//# sourceMappingURL=extension.js.map