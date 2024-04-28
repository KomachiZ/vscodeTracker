"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
const http = require("http");
class ActionLogger {
    constructor(context, topic, backendUrl, actions, userId) {
        this.disposables = [];
        this.queueFlushInterval = 10000; // 10 minutes in milliseconds
        this.terminalBuffer = '';
        this.bufferTimeout = null;
        this.lastTerminalData = {};
        this.workspaceFolders = vscode.workspace.workspaceFolders;
        this.topic = topic;
        this.userId = userId;
        this.backendUrl = backendUrl;
        this.cacheFilePath = path.join(context.globalStorageUri.fsPath, '.actionLoggerCache.json');
        console.log(this.cacheFilePath);
        this.ensureCacheFileExists();
        this.subscribeToActions(actions);
        this.startFlushTimer();
    }
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
exports.default = ActionLogger;
//# sourceMappingURL=ActionLogger.js.map