// preload.js
const { contextBridge, ipcRenderer } = require("electron");
window.addEventListener('DOMContentLoaded', () => {
    console.log('Preload script loaded');
});

contextBridge.exposeInMainWorld("electronAPI", {
    requestGitInfo: (repoPath) => ipcRenderer.invoke('request-git-info', repoPath),
    requestChangedFiles: (hash, diffType) => ipcRenderer.invoke('request-changed-files', hash, diffType),
    requestDiffTextByFilePath: (filePath, hashList, diffType) => ipcRenderer.invoke('request-diff-of-file', filePath, hashList, diffType),
    onFolderSelected: (callback) => ipcRenderer.on('selected-folder', (event, folderPath) => callback(folderPath)),
    requestGetStoreByKey: (key) => ipcRenderer.invoke('request-get-store', key),
    requestSetStoreByKey: (key) => ipcRenderer.invoke('request-set-store', key),
})
