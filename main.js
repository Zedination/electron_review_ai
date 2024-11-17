// main.js
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

const { getAllInfoGit, getChangedFilesByDiffHash, getDiffTextByHashAndFile} = require("./git_utils");

function createWindow() {
    // Tạo cửa sổ trình duyệt
    const win = new BrowserWindow({
        width: 1600,
        height: 900,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: true,
        },
    });

    // Tải file HTML
    win.loadFile('index.html');

    // Ngăn chặn mở cửa sổ mới khi nhấp vào liên kết
    win.webContents.setWindowOpenHandler(() => {
        return { action: 'deny' };
    });

    ipcMain.handle("request-git-info", async () => {
        return await getAllInfoGit('D:\\Source Code\\fullstack-chat');
    });

    ipcMain.handle("request-changed-files", async (event, hash, diffType) => {
        return await getChangedFilesByDiffHash(hash,'D:\\Source Code\\fullstack-chat', diffType);
    });

    ipcMain.handle("request-diff-of-file", async (event, filePath, hashList, diffType) => {
        return await getDiffTextByHashAndFile('D:\\Source Code\\fullstack-chat', filePath, hashList, diffType);
    });
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
