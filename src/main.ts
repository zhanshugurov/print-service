// src/main.ts
import { app, BrowserWindow, Menu, Notification, shell, Tray } from "electron";
import { startApi } from "./api";
import { autoUpdater } from "electron-updater";
import AutoLaunch from "auto-launch";
import { loadConfig } from "./config";
import * as path from "path";

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
const cfg = loadConfig();
let serverPort = cfg.port || 9100;

function createTray() {
    const iconPath = path.join(__dirname, "..", "assets", "icon.png");
    tray = new Tray(iconPath);
    const contextMenu = Menu.buildFromTemplate([
        {
            label: "Открыть настройки",
            click: () => {
                shell.openExternal(`http://localhost:${serverPort}/`);
            },
        },
        {
            label: "Выйти",
            click: () => {
                app.quit();
            },
        },
    ]);
    tray.setToolTip("Сервис печати");
    tray.setContextMenu(contextMenu);
}

// Запрет второго экземпляра
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
} else {
    app.on("second-instance", () => {
        // если вдруг попытаются запустить второй экземпляр
        new Notification({
            title: "Сервис печати",
            body: "Приложение уже запущено",
        }).show();
    });
}

function createMainWindow() {
    mainWindow = new BrowserWindow({
        show: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });
    // keep hidden; used only if you want to show status later
    return mainWindow;
}

app.on("ready", async () => {
    // create hidden window (so webContents APIs work)
    createMainWindow();

    // start API / UI
    startApi();

    // трэй
    createTray();

    // autoUpdater (only in packaged builds)
    autoUpdater.on("checking-for-update", () => console.log("Checking for updates..."));
    autoUpdater.on("update-available", info => console.log("Update available", info));
    autoUpdater.on("update-not-available", () => console.log("No update available"));
    autoUpdater.on("error", err => console.error("AutoUpdater error", err));
    autoUpdater.on("download-progress", progress => console.log("Download progress", progress));
    autoUpdater.on("update-downloaded", info => {
        console.log("Update downloaded; will install on quit");
        // autoUpdater.quitAndInstall() // optionally call when ready
    });

    try {
        autoUpdater.checkForUpdatesAndNotify();
    } catch (e) {
        console.warn("autoUpdater check failed:", e);
    }

    // auto-launch handling: enable if config says so
    try {
        const launcher = new AutoLaunch({ name: "Printer Service", path: app.getPath("exe") });
        if (cfg.autoLaunch) {
            launcher.enable().catch(e => console.warn("autoLaunch enable failed", e));
        } else {
            launcher.disable().catch(() => { });
        }
    } catch (e) {
        console.warn("AutoLaunch init fail", e);
    }
});

// avoid app exit when windows closed; we run headless service
app.on("window-all-closed", () => {
    // e.preventDefault();
});

app.on("before-quit", () => {
    // clean-up if needed
});
