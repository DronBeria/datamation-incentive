const { contextBridge, ipcRenderer } = require('electron');

/**
 * IncentivePro Secure Bridge
 * Exposes controlled native capabilities to the Vercel-hosted web app
 */
contextBridge.exposeInMainWorld('electron', {
    saveBackup: (entity, data) => ipcRenderer.invoke('save-backup', { entity, data }),
    isDesktop: true
});
