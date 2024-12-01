// main.js
const { app, BrowserWindow, ipcMain, Menu, dialog, globalShortcut} = require('electron');
const path = require('path');
const Store = require('electron-store');
const { spawn, exec } = require('child_process');
const os = require('os');
const isMac = process.platform === 'darwin';

const store = new Store();
let mainWindow;
require('electron-reload')(path.join(__dirname), {
    electron: path.join(__dirname, 'node_modules', '.bin', 'electron'),
});
const { getAllInfoGit, getChangedFilesByDiffHash, getDiffTextByHashAndFile} = require("./git_utils");
const fs = require("node:fs");

function createWindow() {
    // Tạo cửa sổ trình duyệt
    mainWindow = new BrowserWindow({
        width: 1600,
        height: 900,
        minWidth: 1333,
        minHeight: 768,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            enableRemoteModule: false,
        },
    });

    // Tải file HTML
    mainWindow.loadFile('index.html');

    // Ngăn chặn mở cửa sổ mới khi nhấp vào liên kết
    mainWindow.webContents.setWindowOpenHandler(() => {
        return { action: 'deny' };
    });

    // Clear electro-store
    globalShortcut.register('Control+Shift+C', () => {
        if (mainWindow) {
            store.clear();
            updateMenuToolBar();
        }
    });

    updateMenuToolBar();

    ipcMain.on("folder-selected-from-drop", async (event, filePath) => {
        if (isDirectory(filePath)) {
            store.set('currentFolder', filePath);
            mainWindow.webContents.send('selected-folder', filePath);
        }
    });

    ipcMain.on("folder-selected-from-html", async () => {
        const folderPath = await openLocalRepository();
        if (folderPath) {
            mainWindow.webContents.send('selected-folder', folderPath);
        }
    })


    ipcMain.handle("request-git-info", async (event, repoPath) => {
        return await getAllInfoGit(repoPath);
    });

    ipcMain.handle("request-changed-files", async (event, hash, diffType) => {
        return await getChangedFilesByDiffHash(hash,store.get('currentFolder'), diffType);
    });

    ipcMain.handle("request-diff-of-file", async (event, filePath, hashList, diffType) => {
        return await getDiffTextByHashAndFile(store.get('currentFolder'), filePath, hashList, diffType);
    });

    // handle get store
    ipcMain.handle("request-get-store",  (event, key) => {
        return store.get(key);
    })

    // handle set store
    ipcMain.handle("request-set-store",  (event, key, value) => {
        if (value) {
            store.set(key, value);
        } else {
            store.delete(key);
        }
    })

    // handle update menu toolbar
    ipcMain.handle('request-update-toolbar', () => {
        updateMenuToolBar();
    })

}

app.whenReady().then(() => {
    createWindow();
    app.on('activate', () => {
        // Trên macOS, mở lại cửa sổ khi ứng dụng được kích hoạt lại
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    // Đóng ứng dụng khi tất cả cửa sổ đã bị đóng
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

function updateMenuToolBar() {
    const menu = Menu.buildFromTemplate([
        {
            label: 'File',
            submenu: [
                {
                    label: 'Open Local Repository',
                    accelerator: isMac ? 'Cmd+O' : 'Ctrl+O',
                    click: async () => {
                        const folderPath = await openLocalRepository();
                        if (folderPath) {
                            mainWindow.webContents.send('selected-folder', folderPath);
                        }
                    },
                },
                {
                    label: 'Settings...',
                    accelerator: isMac ? 'Cmd+Alt+S' : 'Ctrl+Alt+S',
                    click: async () => {
                        mainWindow.webContents.send('open-settings');
                    },
                },
                { role: 'quit' },
            ],
        },
        {
            label: 'View',
            submenu: [
                {
                    label: 'Reload',
                    accelerator: isMac ? 'Cmd+R' : 'Ctrl+R', // Phím tắt cho reload
                    click: () => mainWindow.webContents.reload(),
                },
                {
                    label: 'Zoom In',
                    accelerator: isMac ? 'Cmd+Plus' : 'Ctrl+Plus', // macOS: Cmd+, Windows/Linux: Ctrl+
                    click: () => mainWindow.webContents.setZoomLevel(mainWindow.webContents.getZoomLevel() + 1),
                },
                {
                    label: 'Zoom Out',
                    accelerator: isMac ? 'Cmd+-' : 'Ctrl+-', // macOS: Cmd-, Windows/Linux: Ctrl-
                    click: () => mainWindow.webContents.setZoomLevel(mainWindow.webContents.getZoomLevel() - 1),
                },
                {
                    label: 'Toggle DevTools',
                    accelerator: isMac ? 'Cmd+Shift+I' : 'Ctrl+Shift+I', // macOS: Cmd-, Windows/Linux: Ctrl-
                    click: () => {
                        if (mainWindow) {
                            mainWindow.webContents.toggleDevTools(); // Bật/tắt DevTools
                        }
                    },
                },
            ],
        },
        {
            label: 'Repository',
            submenu: [
                {
                    label: 'Open in Command Prompt',
                    enabled: store.get('currentFolder') !== undefined && store.get('currentFolder') !== null,
                    click: async () => {
                        const folderPath = store.get('currentFolder');
                        if (folderPath) {
                            openInCmd(folderPath);
                        }
                    }
                },
                {
                    label: 'Open in Visual Studio Code',
                    enabled: store.get('currentFolder') !== undefined && store.get('currentFolder') !== null,
                    click: () => openInIDE('code'),
                },
                {
                    label: 'Open in IntelliJ IDEA',
                    enabled: store.get('currentFolder') !== undefined && store.get('currentFolder') !== null,
                    click: () => openInIDE('idea'),
                },
                {
                    label: 'Open in PyCharm',
                    enabled: store.get('currentFolder') !== undefined && store.get('currentFolder') !== null,
                    click: () => openInIDE('pycharm'),
                },
                {
                    label: 'Open in WebStorm',
                    enabled: store.get('currentFolder') !== undefined && store.get('currentFolder') !== null,
                    click: () => openInIDE('webstorm'),
                },
            ]
        }
    ]);
    Menu.setApplicationMenu(menu)
}

async function openLocalRepository() {
    // Hiển thị hộp thoại chọn folder
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory'], // Chỉ chọn folder
    });

    if (!result.canceled && result.filePaths.length > 0) {
        store.set('currentFolder', result.filePaths[0]);
        // Trả về đường dẫn folder
        return result.filePaths[0];
    }

    return null;
}

function openInCmd(folderPath) {
    const platform = os.platform();
    if (platform === 'win32') {
        exec(`start cmd.exe /K "cd /d ${folderPath}"`, (error, stdout, stderr) => {

        });
    } else if (platform === 'darwin') {
        spawn('open', ['-a', 'Terminal', folderPath]);
    } else if (platform === 'linux') {
        spawn('gnome-terminal', ['--working-directory', folderPath]);
    } else {
        throw new Error('Unsupported platform');
    }
}

function openInIDE(ide) {
    const folderPath = store.get('currentFolder');
    if (folderPath) {
        let command;
        const platform = os.platform(); // Xác định hệ điều hành

        switch (ide) {
            case 'code':
                if (platform === 'win32') {
                    command = `code "${folderPath}"`;
                } else if (platform === 'darwin') {
                    command = `code "${folderPath}"`;
                } else if (platform === 'linux') {
                    command = `code "${folderPath}"`;
                }
                break;

            case 'idea':
                if (platform === 'win32') {
                    command = `idea "${folderPath}"`;
                } else if (platform === 'darwin') {
                    command = `open -a "IntelliJ IDEA" "${folderPath}"`;
                } else if (platform === 'linux') {
                    command = `/opt/idea/bin/idea.sh "${folderPath}"`;
                }
                break;

            case 'pycharm':
                if (platform === 'win32') {
                    command = `pycharm "${folderPath}"`;
                } else if (platform === 'darwin') {
                    command = `open -a "PyCharm" "${folderPath}"`;
                } else if (platform === 'linux') {
                    command = `/opt/pycharm/bin/pycharm.sh "${folderPath}"`;
                }
                break;

            case 'webstorm':
                if (platform === 'win32') {
                    command = `webstorm "${folderPath}"`;
                } else if (platform === 'darwin') {
                    command = `open -a "WebStorm" "${folderPath}"`;
                } else if (platform === 'linux') {
                    command = `/opt/webstorm/bin/webstorm.sh "${folderPath}"`;
                }
                break;
            default:
                console.error('Unsupported IDE');
                return;
        }
        // Thực thi lệnh
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error opening ${ide}: ${error.message}`);
                return;
            }
            if (stderr) {
                console.error(`Stderr: ${stderr}`);
            }
            console.log(`Opened ${ide} successfully!`);
        });

    }
}

function isDirectory(filePath) {
    try {
        return fs.statSync(filePath).isDirectory();
    } catch (err) {
        return false;
    }
}