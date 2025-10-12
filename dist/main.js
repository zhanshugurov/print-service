"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/main.ts
const electron_1 = require("electron");
const api_1 = require("./api");
const electron_updater_1 = require("electron-updater");
const auto_launch_1 = __importDefault(require("auto-launch"));
const config_1 = require("./config");
const path = __importStar(require("path"));
let mainWindow = null;
let tray = null;
const cfg = (0, config_1.loadConfig)();
let serverPort = cfg.port || 9100;
function createTray() {
    const iconPath = path.join(__dirname, "..", "assets", "icon.png");
    tray = new electron_1.Tray(iconPath);
    const contextMenu = electron_1.Menu.buildFromTemplate([
        {
            label: "Открыть настройки",
            click: () => {
                electron_1.shell.openExternal(`http://localhost:${serverPort}/`);
            },
        },
        {
            label: "Выйти",
            click: () => {
                electron_1.app.quit();
            },
        },
    ]);
    tray.setToolTip("Сервис печати");
    tray.setContextMenu(contextMenu);
}
// версия
electron_1.ipcMain.handle("get-version", () => electron_1.app.getVersion());
// проверка обновления
electron_1.ipcMain.handle("check-for-updates", async () => {
    try {
        const result = await electron_updater_1.autoUpdater.checkForUpdates();
        if (result?.updateInfo.version !== electron_1.app.getVersion()) {
            return { updateAvailable: true, info: result?.updateInfo };
        }
        else {
            return { updateAvailable: false };
        }
    }
    catch (error) {
        return { error: error.message };
    }
});
// Запрет второго экземпляра
const gotTheLock = electron_1.app.requestSingleInstanceLock();
if (!gotTheLock) {
    electron_1.app.quit();
}
else {
    electron_1.app.on("second-instance", () => {
        // если вдруг попытаются запустить второй экземпляр
        new electron_1.Notification({
            title: "Сервис печати",
            body: "Приложение уже запущено",
        }).show();
    });
}
function createMainWindow() {
    mainWindow = new electron_1.BrowserWindow({
        show: false,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
        }
    });
    // keep hidden; used only if you want to show status later
    return mainWindow;
}
electron_1.app.on("ready", async () => {
    // create hidden window (so webContents APIs work)
    const mainWindow = createMainWindow();
    // start API / UI
    (0, api_1.startApi)();
    // трэй
    createTray();
    // autoUpdater (only in packaged builds)
    electron_updater_1.autoUpdater.on('checking-for-update', () => {
        console.log('Проверка обновлений...');
    });
    electron_updater_1.autoUpdater.on('update-available', () => {
        electron_1.dialog.showMessageBox({
            type: 'info',
            title: 'Обновление найдено',
            message: 'Новая версия загружается...',
        });
    });
    electron_updater_1.autoUpdater.on('update-downloaded', () => {
        electron_1.dialog
            .showMessageBox(mainWindow, {
            type: "info",
            buttons: ["Перезапустить", "Позже"],
            title: "Обновление готово",
            message: "Доступна новая версия. Перезапустить и установить?",
        })
            .then((res) => {
            if (res.response === 0)
                electron_updater_1.autoUpdater.quitAndInstall();
        });
    });
    electron_updater_1.autoUpdater.on('error', (err) => {
        console.error('Ошибка автообновления:', err);
    });
    try {
        electron_updater_1.autoUpdater.checkForUpdatesAndNotify();
    }
    catch (e) {
        console.warn("autoUpdater check failed:", e);
    }
    // auto-launch handling: enable if config says so
    try {
        const launcher = new auto_launch_1.default({ name: "Printer Service", path: electron_1.app.getPath("exe") });
        if (cfg.autoLaunch) {
            launcher.enable().catch(e => console.warn("autoLaunch enable failed", e));
        }
        else {
            launcher.disable().catch(() => { });
        }
    }
    catch (e) {
        console.warn("AutoLaunch init fail", e);
    }
});
// avoid app exit when windows closed; we run headless service
electron_1.app.on("window-all-closed", () => {
    // e.preventDefault();
});
electron_1.app.on("before-quit", () => {
    // clean-up if needed
});
