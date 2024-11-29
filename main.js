// main.js
const { app, BrowserWindow, ipcMain, Menu, dialog, globalShortcut} = require('electron');
const path = require('path');
const Store = require('electron-store');


const store = new Store();
let mainWindow;

const { getAllInfoGit, getChangedFilesByDiffHash, getDiffTextByHashAndFile} = require("./git_utils");

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
            nodeIntegration: true,
        },
    });

    // Tải file HTML
    mainWindow.loadFile('index.html');

    // Ngăn chặn mở cửa sổ mới khi nhấp vào liên kết
    mainWindow.webContents.setWindowOpenHandler(() => {
        return { action: 'deny' };
    });

    // Đăng ký phím tắt Ctrl + Shift + I để mở DevTools
    globalShortcut.register('Control+Shift+I', () => {
        if (mainWindow) {
            mainWindow.webContents.toggleDevTools(); // Bật/tắt DevTools
        }
    });

    // Clear electro-store
    globalShortcut.register('Control+Shift+C', () => {
        if (mainWindow) {
            store.clear();
        }
    });

    const menu = Menu.buildFromTemplate([
        {
            label: 'File',
            submenu: [
                {
                    label: 'Open Local Repository',
                    click: async () => {
                        const folderPath = await openLocalRepository();
                        if (folderPath) {
                            mainWindow.webContents.send('selected-folder', folderPath);
                        }
                    },
                },
                { role: 'quit' },
            ],
        },
    ]);
    Menu.setApplicationMenu(menu)

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