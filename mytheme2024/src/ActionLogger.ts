import * as vscode from 'vscode';
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http'; 

interface LogEntry {
    timestamp: string;
    action: string;
    details: object;
    topic: string;
    userId: string;
}

export default class ActionLogger implements vscode.Disposable {
    private topic: string;
    private backendUrl: string;
    private userId: string; 
    private disposables: vscode.Disposable[] = [];
    private queueFlushInterval = 60000; // 1 minutes in milliseconds
    private flushTimer: any;
    private cacheFilePath: string;
    private terminalBuffer: string = '';
    private bufferTimeout: NodeJS.Timeout | null = null;
    private lastTerminalData: {[key: string]: string} = {};


    constructor(context: vscode.ExtensionContext, topic: string, backendUrl: string, actions: string[], userId: string) {
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
   
    private isWithinCsc111Folder(filePath: string): boolean {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            return false;
        }
        const csc111FolderPath = path.join(workspaceFolders[0].uri.fsPath, 'csc111');
        return filePath.startsWith(csc111FolderPath);
    }
    private ensureCacheFileExists(): void {
        const dir = path.dirname(this.cacheFilePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        if (!fs.existsSync(this.cacheFilePath)) {
            fs.writeFileSync(this.cacheFilePath, JSON.stringify([]), 'utf8');
        }
    }
    private startFlushTimer(): void {
        this.flushTimer = setInterval(() => {
            this.flushMessageQueue();
        }, this.queueFlushInterval);
    }
    private flushMessageQueue(): void {
        const logsToFlush = this.readCacheFile();
        if (logsToFlush.length === 0){
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
                } else {
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
    
    
    private subscribeToActions(actions: string[]): void {
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

    private stripAnsiEscapeCodes(text: string): string {
        // Remove ANSI escape sequences
        text = text.replace(/[\u001B\u009B][[\]()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
        
        // Remove specific UUID followed by control character \u0007
        text = text.replace(/\b[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\u0007/g, '');
        
        return text;
    }
    
    
    private handleExecInTerminal(event: vscode.TerminalDataWriteEvent): void {
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor) {
            const filePath = activeEditor.document.uri.fsPath;
            if (this.isWithinCsc111Folder(filePath)) {
                let terminalData = this.stripAnsiEscapeCodes(event.data.toString());
                const lastData = this.lastTerminalData[filePath] || "";
    
                if (terminalData !== lastData) {
                    this.terminalBuffer += terminalData;
                    if (this.bufferTimeout) clearTimeout(this.bufferTimeout);
                    this.bufferTimeout = setTimeout(() => {
                        this.logAction('execInTerminal', { terminalData: this.terminalBuffer });
                        this.lastTerminalData[filePath] = this.terminalBuffer;
                        this.terminalBuffer = ''; // Clear buffer after logging
                    }, 300); // Delay to accumulate data
                }
            }
        }
    }
    
    
    
    private handleOpenDocument(document: vscode.TextDocument): void {
        if (this.isWithinCsc111Folder(document.uri.fsPath)) {
            this.logAction('openDocument', { fileName: document.fileName });
        }
    }

    private handleStartDebugSession(session: vscode.DebugSession): void {
        if (session.workspaceFolder && this.isWithinCsc111Folder(session.workspaceFolder.uri.fsPath)) {
            this.logAction('startDebugSession', { sessionName: session.name });
        }
    }
    private handleTerminateDebugSession(session: vscode.DebugSession): void {
        if (session.workspaceFolder && this.isWithinCsc111Folder(session.workspaceFolder.uri.fsPath)) {
            this.logAction('endDebugSession', { sessionName: session.name });
        }
    }
    private handleEndTaskProcess(event: vscode.TaskProcessEndEvent): void {
        this.logAction('endTaskProcess', { taskName: event.execution.task.name, exitCode: event.exitCode });
    }
    private handleSaveDocument(document: vscode.TextDocument): void {
        if (this.isWithinCsc111Folder(document.uri.fsPath)) {
            const documentContent = document.getText();
            this.logAction('saveDocument', { fileName: document.fileName, contentPreview: documentContent.substring(0, 500) }); // Logs a preview of document content
        }
    }
    
    public logAction(action: string, details: object): void {
        const logEntry: LogEntry = {
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
  
    private readCacheFile(): LogEntry[] {
        try {
            const data = fs.readFileSync(this.cacheFilePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('Error reading cache file:', error);
            return [];
        }
    }

  
    dispose(): void {
        if (this.flushTimer) {
            clearInterval(this.flushTimer as NodeJS.Timeout);
        }
        this.flushMessageQueue(); // Ensure the queue is flushed on dispose
    }
}
