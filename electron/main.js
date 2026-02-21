const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        title: "PayoutPower Industrial Suite",
        icon: path.join(__dirname, 'icon.png'), // We'll need an icon later
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    });

    // During development, we can point to localhost
    // For production, this will be your Vercel URL
    const startUrl = process.env.VERCEL_URL || 'http://localhost:3000';
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
        const backupDir = path.join(app.getPath('documents'), 'PayoutPower', 'Backups');
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
