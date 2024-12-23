// main.js
const { app, BrowserWindow, ipcMain, Menu, dialog, globalShortcut, net, shell} = require('electron');
const path = require('path');
const Store = require('electron-store');
const { spawn, exec } = require('child_process');
const os = require('os');
const { autoUpdater } = require('electron-updater');
const isMac = process.platform === 'darwin';

const store = new Store();
let mainWindow;
require('electron-reload')(path.join(__dirname), {
    electron: path.join(__dirname, 'node_modules', '.bin', 'electron'),
});
const { getAllInfoGit, getChangedFilesByDiffHash, getDiffTextByHashAndFile, checkoutBranch, fetchOrigin, getAllBranches} = require("./git_utils");
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
            // add to history
            addToCurrentDirectoryList(filePath);
        }
    });

    ipcMain.on("folder-selected-from-html", async () => {
        const folderPath = await openLocalRepository();
        if (folderPath) {
            mainWindow.webContents.send('selected-folder', folderPath);
            // add to history
            addToCurrentDirectoryList(folderPath);
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

    // handle validate & open folder in currently opened folders
    ipcMain.handle('request-open-currently-folder', (event, item) => {
        // kiểm tra xem folder có tồn tại trên hệ thống hay không?
        if (isDirectory(item.folderPath)) {
            // nếu có tồn tại
            store.set('currentFolder', item.folderPath);
            mainWindow.webContents.send('selected-folder', item.folderPath);
            // add to history
            addToCurrentDirectoryList(item.folderPath);
        } else {
            const choice = dialog.showMessageBoxSync(mainWindow, {
                type: 'error',
                buttons: ['Delete', 'Cancel'], // Các nút trong dialog
                defaultId: 0, // Nút Delete
                cancelId: 1, // Nút cancel
                title: 'Invalid path',
                message: 'The folder you just selected does not exist!',
                detail: `The folder you just selected does not exist. Do you want to remove this folder from the recent folders list?`,
            });

            if (choice === 0) {
                // xoá folder khỏi danh sách gần đây
                deleteItemFromCurrentFolders(item);
            }
        }
    })

    // handle update menu toolbar
    ipcMain.handle('request-update-toolbar', () => {
        updateMenuToolBar();
    })

    ipcMain.handle('request-checkout-branch', async (event, branchName, isRemote) => {

        // nếu là remote branch, thông báo sẽ tạo nhánh local dựa trên nhánh remote này
        if (isRemote) {
            const option = {
                type: 'question',
                buttons: ['OK', 'Cancel'], // Các nút tùy chọn
                title: 'Confirmation',
                message: `Do you want to create and checkout branch ${branchName.replace('remotes/origin/', '')} based on the remote branch ${branchName}`,
            };
            const choice = dialog.showMessageBoxSync(mainWindow, option);
            if (choice === 1) {
                return false;
            }
        }

        const confirmCallback = async message => {
            const option = {
                type: 'question',
                buttons: ['OK', 'Cancel'], // Các nút tùy chọn
                title: 'Confirmation',
                message: message,
            };
            return dialog.showMessageBox(mainWindow, option);
        }

        const errorCallback = async message => {
            const option = {
                type: 'error',
                buttons: ['OK'],
                defaultId: 0,
                title: 'Error',
                message: message,
            };
            return dialog.showMessageBox(mainWindow, option);
        }
        return await checkoutBranch(store.get('currentFolder'), branchName, confirmCallback, errorCallback);
    })


    ipcMain.handle('request-fetch-origin', async event => {
        await fetchOrigin(store.get('currentFolder'));
    })

    ipcMain.handle('request-get-all-branches', async (event, repoPath) => {
        return await getAllBranches(repoPath);
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

    // Xử lý khi khởi động ứng dụng, mở folder từ context menu
    const args = process.argv;
    // fs.writeFile('D:\\Source Code\\Node JS\\setting2.txt', args.join('\n'), err => {});
    if (args && args.length > 1 && !args[0].includes('electron.exe')) {
        const folderPath = args[1];
        // dialog.showMessageBox(mainWindow, {type: 'info',
        //     title: 'Thông báo',
        //     message: args[1],
        //     buttons: ['OK']});
        if (folderPath && isDirectory(folderPath)) {
            store.set('currentFolder', folderPath);
            mainWindow.webContents.send('selected-folder', folderPath);
            // add to history
            addToCurrentDirectoryList(folderPath);
        }
    }

    // Kiểm tra cập nhật sau khi ứng dụng sẵn sàng
    mainWindow.webContents.once('did-finish-load', () => {
        sleep(0).then(() => {
            checkForUpdates();
        })
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
                            // add to history
                            addToCurrentDirectoryList(folderPath);
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
                    label: 'Open in Explorer',
                    enabled: store.get('currentFolder') !== undefined && store.get('currentFolder') !== null,
                    click: async () => {
                        const folderPath = store.get('currentFolder');
                        if (folderPath) {
                            openInExplorer(folderPath);
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

function openInExplorer(folderPath) {
    shell.openPath(folderPath)
        .then((result) => {
            if (result) {
                console.error('Error opening folder:', result);
            } else {
                console.log('Folder opened successfully!');
            }
        })
        .catch((err) => {
            console.error('Failed to open folder:', err);
        });
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
        return fs.existsSync(filePath) && fs.statSync(filePath).isDirectory();
    } catch (err) {
        return false;
    }
}

function checkForUpdates() {

    // kiểm tra internet, nếu không có internet thì ko check update
    if (!net.isOnline()) return;
    
    autoUpdater.checkForUpdates();

    // Khi có bản cập nhật mới
    autoUpdater.on('update-available', (info) => {
        console.log('Update available:', info);

        // Hiển thị dialog hỏi người dùng
        const choice = dialog.showMessageBoxSync(mainWindow, {
            type: 'info',
            buttons: ['OK', 'Not Now'], // Các nút trong dialog
            defaultId: 0, // Nút mặc định (OK)
            cancelId: 1, // Nút hủy (Not Now)
            title: 'Update Available',
            message: 'A new version is available. Would you like to update now?',
            detail: `Version ${info.version} is available for download.`,
        });

        // Xử lý lựa chọn của người dùng
        if (choice === 0) {
            // Nếu người dùng chọn "OK"
            autoUpdater.downloadUpdate();
        } else {
            // Người dùng chọn "Not Now"
            console.log('User chose not to update.');
        }
    });

    // Khi đang tải update
    autoUpdater.on('download-progress', (progress) => {
        console.log(`Download speed: ${progress.bytesPerSecond} Bps`);
        console.log(`Downloaded: ${progress.percent}%`);
        console.log(`Total: ${progress.total} bytes`);

        // Gửi tiến trình đến cửa sổ loading
        mainWindow.webContents.send('download-progress', progress);
    });

    // Khi bản cập nhật đã được tải xuống
    autoUpdater.on('update-downloaded', (info) => {
        console.log('Update downloaded:', info);
        mainWindow.webContents.send('complete-download-update');

        // Hiển thị dialog yêu cầu cài đặt
        const installChoice = dialog.showMessageBoxSync(mainWindow, {
            type: 'info',
            buttons: ['Install and Restart', 'Later'],
            defaultId: 0,
            cancelId: 1,
            title: 'Update Ready',
            message: 'The update has been downloaded. Would you like to install it now?',
            detail: 'The application will restart to apply the update.',
        });

        if (installChoice === 0) {
            // Cài đặt và khởi động lại ứng dụng
            autoUpdater.quitAndInstall();
        } else {
            console.log('User chose to install the update later.');
        }
    });

    // Khi không có bản cập nhật mới
    autoUpdater.on('update-not-available', () => {
        console.log('No updates available.');
    });

    // Xử lý lỗi trong quá trình cập nhật
    autoUpdater.on('error', (error) => {
        console.error('Error during update:', error);
        dialog.showErrorBox('Update Error', error.message || 'An unknown error occurred.');
        mainWindow.webContents.send('complete-download-update');
    });
}

function addToCurrentDirectoryList(folderPath) {
    const folderName = path.basename(folderPath);
    let directoryList = store.get('currentDirectoryList')??[];
    const index = directoryList.findIndex((item) => item.folderName === folderName && item.folderPath === folderPath);
    if (index !== -1) {
        directoryList.splice(index, 1);
    }
    directoryList.unshift({folderName, folderPath});
    store.set('currentDirectoryList', directoryList);
}

function deleteItemFromCurrentFolders(item) {
    let directoryList = store.get('currentDirectoryList')??[];
    const index = directoryList.indexOf(item);
    if (index !== -1) {
        directoryList.splice(index, 1);
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}