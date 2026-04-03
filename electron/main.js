const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1440,
        height: 900,
        title: "IncentivePro — Industrial Incentive Suite",
        autoHideMenuBar: true, // Professional desktop look
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    });

    // Pointing to your production Vercel deployment
    const productionUrl = 'https://IncentivePro-incentive.vercel.app';
    const startUrl = process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : productionUrl;

    mainWindow.loadURL(startUrl);

    // Open external links in the default browser
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });
}

/**
 * Industrial Data Preservation Logic
 * Creates a local shadow copy of cloud data
 */
ipcMain.handle('save-backup', async (event, { entity, data }) => {
    try {
        const backupDir = path.join(app.getPath('documents'), 'IncentivePro', 'Backups');
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        const filename = `${entity}_${new Date().toISOString().split('T')[0]}.json`;
        const filePath = path.join(backupDir, filename);

        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        return { success: true, path: filePath };
    } catch (err) {
        console.error('Local backup failed:', err);
        return { success: false, error: err.message };
    }
});

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
