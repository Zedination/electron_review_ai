// preload.js
const { contextBridge, ipcRenderer } = require("electron");
const { webUtils } = require('electron');
window.addEventListener('DOMContentLoaded', () => {
    initDragDrop();
});

contextBridge.exposeInMainWorld("electronAPI", {
    requestGitInfo: (repoPath) => ipcRenderer.invoke('request-git-info', repoPath),
    requestChangedFiles: (hash, diffType) => ipcRenderer.invoke('request-changed-files', hash, diffType),
    requestDiffTextByFilePath: (filePath, hashList, diffType) => ipcRenderer.invoke('request-diff-of-file', filePath, hashList, diffType),
    onFolderSelected: (callback) => ipcRenderer.on('selected-folder', (event, folderPath) => callback(folderPath)),
    requestGetStoreByKey: (key) => ipcRenderer.invoke('request-get-store', key),
    requestSetStoreByKey: (key) => ipcRenderer.invoke('request-set-store', key),
    requestUpdateToolbar: () => ipcRenderer.invoke('request-update-toolbar'),
    sendDialogSelectFolder: () => ipcRenderer.send('folder-selected-from-html'),
})


function initDragDrop() {
    const dropZone = document.getElementById('drop-zone');

//Ngăn hành vi mặc định của trình duyệt khi kéo thả
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, event => {
            event.preventDefault();
            event.stopPropagation();
        });
    });

// Hiệu ứng khi kéo vào vùng thả
    dropZone.addEventListener('dragenter', () => {
    });

    dropZone.addEventListener('dragleave', () => {
    });

// Xử lý sự kiện thả
    dropZone.addEventListener('drop', event => {
        const filePath = webUtils.getPathForFile(event.dataTransfer.files[0]);
        ipcRenderer.send('folder-selected-from-drop', filePath);
    });
}