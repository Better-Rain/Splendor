import { app, BrowserWindow } from 'electron';
import path from 'path';
import { startServer } from './server';

let mainWindow: BrowserWindow | null = null;
let server: any = null;

function shouldStartEmbeddedServer(): boolean {
    return process.env.SPLENDOR_EMBED_SERVER !== 'false';
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        icon: path.join(__dirname, '../../assets/icon.png')
    });

    // 开发环境加载本地服务器
      if (process.env.NODE_ENV === 'development') {
        mainWindow.loadURL('http://localhost:3000');
        mainWindow.webContents.openDevTools();
      } else {
        mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
      }

    // mainWindow.loadURL('http://localhost:3000');
    // mainWindow.webContents.openDevTools();

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(() => {
    // 启动游戏服务器
    if (shouldStartEmbeddedServer()) {
        server = startServer({
            snapshotPath: path.join(app.getPath('userData'), 'host-snapshot.json')
        });
    }

    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        if (server && server.close) {
            server.close();
        }
        app.quit();
    }
});
