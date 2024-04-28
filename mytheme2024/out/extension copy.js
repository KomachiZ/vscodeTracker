"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require("vscode");
const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");
let jsonFavorite;
function loadFavoriteThemesByFile(allThemes) {
    try {
        let favoriteFile = __dirname + '/../Favorite.xlsx';
        const workbook = XLSX.readFile(favoriteFile);
        const sheetName = workbook.SheetNames[0]; // 假设您要读取第一个工作表的数据
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        return jsonData;
    }
    catch (e) {
        let newDefault = allThemes.slice(0, 10);
        saveFavoriteThemesByFile(newDefault);
        return newDefault;
        //return null;
    }
}
function saveFavoriteThemesByFile(favoriteThemes) {
    try {
        const worksheet = XLSX.utils.json_to_sheet(favoriteThemes);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
        let favoriteFile = __dirname + '/../Favorite.xlsx';
        const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        // 将二进制数据写入文件
        fs.writeFileSync(favoriteFile, excelBuffer);
    }
    catch (e) {
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
    const themeNames = [];
    themeExtensions.forEach(extension => {
        const contributes = extension.packageJSON?.contributes;
        const themes = contributes?.themes || [];
        themes.forEach((theme) => {
            if (theme.label && theme.uiTheme) {
                themeNames.push(theme.label);
            }
        });
    });
    return themeNames;
}
// 记录到csv文件
function recordToCsv(operate, theme, fullPath) {
    let filePath = __dirname + '/../record.csv';
    // 获取当前时间
    const currentTime = new Date().toLocaleString();
    // 或者字体尺寸等信息
    const fontSize = vscode.workspace.getConfiguration('editor').get('fontSize');
    let fontFamily = vscode.workspace.getConfiguration('editor').get('fontFamily');
    // 逗号替换为空格
    fontFamily = fontFamily.replace(/\,/g, ' ');
    if (fullPath.length === 0) {
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor) {
            fullPath = activeEditor.document.fileName;
        }
    }
    let baseName = "";
    let extName = "";
    if (fullPath.length > 0) {
        // 从全路径获取文件名
        baseName = path.basename(fullPath);
        // 从全路径获取扩展名
        extName = path.extname(fullPath);
        if (extName.charAt(0) === '.') {
            extName = extName.substring(1);
        }
    }
    // 要写入的CSV行数据
    const csvData = `${currentTime},${operate},${theme},${fontSize},${fontFamily},${baseName},${extName}\r\n`;
    if (!fs.existsSync(filePath)) {
        // 文件不存在，创建csv表头
        fs.writeFile(filePath, 'time,operate,themes,fontSize,fontFamily,filename,ext_name\r\n', (err) => {
            if (err) {
            }
            else {
            }
        });
        fs.close;
    }
    // 将数据追加写入CSV文件
    fs.appendFile(filePath, csvData, (err) => {
        if (err) {
        }
        else {
        }
    });
}
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
function activate(context) {
    // 读取全部主题的xlsx数据文件
    let themesFile = __dirname + '/../Themes Database.xlsx';
    const workbook = XLSX.readFile(themesFile);
    const sheetName = workbook.SheetNames[0]; // 假设您要读取第一个工作表的数据
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);
    // 按Score降序排序
    jsonData.sort(((a, b) => b.Score - a.Score));
    // 读收藏的主题xlsx文件到json
    jsonFavorite = loadFavoriteThemesByFile(jsonData);
    // 按Score降序排序
    jsonFavorite.sort(((a, b) => b.Score - a.Score));
    // 注册打开收藏主题列表的命令以及事件处理
    let disposableOpenList = vscode.commands.registerCommand('mytheme.openFavoriteThemesList', () => {
        const items = [];
        if (jsonFavorite === null) {
            return;
        }
        const showThemes = jsonFavorite; //jsonData.slice(0, 10);
        // 获取全部安装的主题
        const allInstalledThemes = getAllThemes();
        // 添加到列表
        showThemes.map((row) => {
            const themeName = row['Themes'].toString();
            let info = '';
            if (!allInstalledThemes.includes(themeName)) {
                info = ' Not Installed';
            }
            const currentTheme = vscode.workspace.getConfiguration().get('workbench.colorTheme');
            if (themeName === currentTheme) {
                items.push({ label: "* " + row['Themes'].toString(), description: /*'Score:' + row['Score'].toString() +*/ info });
            }
            else {
                items.push({ label: row['Themes'].toString(), description: /*'Score:' + row['Score'].toString() +*/ info });
            }
            // 记录到csv文件
            //recordToCsv("select favorite theme", themeName, "");
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
            recordToCsv("select favorite theme", selectedTheme, "");
        });
    });
    context.subscriptions.push(disposableOpenList);
    // 注册喜欢按钮的处理事件
    let disposableLike = vscode.commands.registerCommand('MyTheme.like', () => {
        //测试预览主题
        //openExtensionPage('ChirtleLovesDolls.nebula-theme');
        // 获取当前主题
        const currentTheme = vscode.workspace.getConfiguration().get('workbench.colorTheme');
        // 在全部主题中查询当前主题
        const query = jsonData.filter((item) => item.Themes === currentTheme);
        if (query.length) {
            // 将主题添加到收藏json列表中
            jsonFavorite.push(query[0]);
            // 按Score降序排序
            jsonFavorite.sort(((a, b) => b.Score - a.Score));
            // 更新到收藏文件中去
            saveFavoriteThemesByFile(jsonFavorite);
            // 更新显示或隐藏喜欢与不喜欢按钮
            themeChange(currentTheme);
        }
        recordToCsv("favorite theme", currentTheme, "");
    });
    context.subscriptions.push(disposableLike);
    // 注册不喜欢按钮的处理事件
    let disposableDislike = vscode.commands.registerCommand('MyTheme.dislike', () => {
        // 获取当前主题
        const currentTheme = vscode.workspace.getConfiguration().get('workbench.colorTheme');
        // 在收藏主题中查询当前主题的索引
        const targetIndex = jsonFavorite.findIndex((item) => item.Themes === currentTheme);
        if (targetIndex !== -1) {
            // 删除查询到的数据
            jsonFavorite.splice(targetIndex, 1);
            // 更新到收藏文件中去
            saveFavoriteThemesByFile(jsonFavorite);
            // 更新显示或隐藏喜欢与不喜欢按钮
            themeChange(currentTheme);
        }
        recordToCsv("disFavorite theme", currentTheme, "");
    });
    context.subscriptions.push(disposableDislike);
    // 注册默认主题按钮的处理事件
    let disposableDefaultTheme = vscode.commands.registerCommand('mytheme.defaultTheme', () => {
        const defaultThemeName = 'Visual Studio Dark';
        vscode.workspace.getConfiguration().update('workbench.colorTheme', defaultThemeName, vscode.ConfigurationTarget.Global);
        // 主题改变完成一些动作
        themeChange(defaultThemeName);
        // 记录到csv文件
        recordToCsv("Change2Default theme", defaultThemeName, "");
    });
    context.subscriptions.push(disposableDefaultTheme);
    // 注册循环更换主题按钮的处理事件
    let disposableNextTheme = vscode.commands.registerCommand('mytheme.nextTheme', () => {
        // 获取全部安装的主题
        const allInstalledThemes = getAllThemes();
        //console.log('全部安装的主题:', allInstalledThemes);
        // 获取当前主题
        const currentTheme = vscode.workspace.getConfiguration().get('workbench.colorTheme');
        //console.log('当前主题:', currentTheme);
        // 在全部主题中查询当前主题的索引
        let targetIndex = jsonData.findIndex((item) => item.Themes === currentTheme);
        if (targetIndex === -1) {
            targetIndex = 0;
        }
        // 查找下一个可以用的主题，并设置生效
        let newTheme = "";
        let matchingThemes = [];
        // 查找匹配的主题
        jsonData.forEach((element) => {
            if (allInstalledThemes.includes(element.Themes)) {
                matchingThemes.push(element.Themes);
            }
        });
        // 输出匹配的主题列表
        console.log('匹配的主题列表:', matchingThemes);
        for (let i = targetIndex + 1; i < jsonData.length; i++) {
            const element = jsonData[i];
            //console.log('下一个主题索引:', i,'总长度：',jsonData.length);
            if (allInstalledThemes.includes(element.Themes)) {
                newTheme = element.Themes;
                break;
            }
        }
        if (!newTheme.length) {
            for (let i = 0; i < targetIndex; i++) {
                const element = jsonData[i];
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
            recordToCsv("Change theme", newTheme, "");
        }
    });
    context.subscriptions.push(disposableNextTheme);
    // 监听vscode文件的打开
    vscode.workspace.onDidOpenTextDocument(document => {
        const fileName = document.fileName;
        if (path.basename(fileName).toLowerCase() === 'settings.json') {
            return;
        }
        //vscode.window.showInformationMessage(`当前打开的文件名${fileName}`);
        // 获取当前主题
        const currentTheme = vscode.workspace.getConfiguration().get('workbench.colorTheme');
        recordToCsv('Open file', currentTheme, fileName);
    });
    // 监听vscode文件的保存
    vscode.workspace.onDidSaveTextDocument(document => {
        const fileName = document.fileName;
        if (path.basename(fileName).toLowerCase() === 'settings.json') {
            return;
        }
        //vscode.window.showInformationMessage(`当前保存的文件名${fileName}`);
        // 获取当前主题
        const currentTheme = vscode.workspace.getConfiguration().get('workbench.colorTheme');
        recordToCsv('Save file', currentTheme, fileName);
    });
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
    function themeChange(theme) {
        // 判断当前主题是否在收藏列表里
        const query = jsonFavorite.filter((item) => item.Themes === theme);
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
    const currentTheme = vscode.workspace.getConfiguration().get('workbench.colorTheme');
    themeChange(currentTheme);
}
exports.activate = activate;
// this method is called when your extension is deactivated
function deactivate() { }
exports.deactivate = deactivate;
//# sourceMappingURL=extension%20copy.js.map