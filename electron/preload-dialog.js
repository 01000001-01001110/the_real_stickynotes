const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('dialogApi', {
  sendResponse: (confirmed) => ipcRenderer.send('confirm-dialog-response', confirmed),
});
