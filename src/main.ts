// src/main.ts
import { app, dialog, Menu, Notification, shell, ipcMain, Tray } from "electron";
import { startApi } from "./api";
import { autoUpdater } from "electron-updater";
import AutoLaunch from "auto-launch";
import { loadConfig } from "./config";
import * as path from "path";

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

// версия
ipcMain.handle("get-version", () => app.getVersion());

// проверка обновления
ipcMain.handle("check-for-updates", async () => {
  try {
    const result = await autoUpdater.checkForUpdates();
    if (result?.updateInfo.version !== app.getVersion()) {
      return { updateAvailable: true, info: result?.updateInfo };
    } else {
      return { updateAvailable: false };
    }
  } catch (error: any) {
    return { error: error.message };
  }
});


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

app.on("ready", async () => {
  // start API / UI
  startApi();

  // трэй
  createTray();

  // autoUpdater (only in packaged builds)
  autoUpdater.on('checking-for-update', () => {
    console.log('Проверка обновлений...');
  });

  autoUpdater.on('update-available', () => {
    dialog.showMessageBox({
      type: 'info',
      title: 'Обновление найдено',
      message: 'Новая версия загружается...',
    });
  });

  autoUpdater.on('update-downloaded', () => {
    dialog
      .showMessageBox({
        type: "info",
        buttons: ["Перезапустить", "Позже"],
        title: "Обновление готово",
        message: "Доступна новая версия. Перезапустить и установить?",
      })
      .then((res) => {
        if (res.response === 0) autoUpdater.quitAndInstall();
      });

  });

  autoUpdater.on('error', (err) => {
    console.error('Ошибка автообновления:', err);
  });

  try {
    // первая проверка при запуске
    autoUpdater.checkForUpdatesAndNotify();

    // повторная проверка каждый час
    const ONE_HOUR = 60 * 60 * 1000;
    setInterval(() => {
      console.log("Автоматическая проверка обновлений...");
      autoUpdater.checkForUpdatesAndNotify().catch(err => {
        console.warn("Ошибка при автопроверке обновлений:", err);
      });
    }, ONE_HOUR);
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
