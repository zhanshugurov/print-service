// src/main.ts
import { app, dialog, Menu, Notification, shell, ipcMain, Tray } from "electron";
import { startApi, stopApi } from "./api";
import { autoUpdater } from "electron-updater";
import AutoLaunch from "auto-launch";
import { loadConfig } from "./config";
import * as path from "path";

let tray: Tray | null = null;
let apiStarted = false;

const cfg = loadConfig();
let serverPort = cfg.port || 9100;

// ------------------------------
//   Протокол
// ------------------------------
function handleProtocol(url: string) {
  console.log("Protocol call:", url);

  if (url === "ticketingprint://start") {
    startPrintService();
  }

  if (url === "ticketingprint://ping") {
    new Notification({
      title: "Сервис печати",
      body: "Сервис работает",
    }).show();
  }
}

// ------------------------------
//   Гарантируем один экземпляр
// ------------------------------
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", (event, argv) => {
    const url = argv.find((a) => a.startsWith("ticketingprint://"));
    if (url) {
      handleProtocol(url);
      return;
    }

    new Notification({
      title: "Сервис печати",
      body: "Приложение уже запущено",
    }).show();
  });
}

// ----------------------------------------
//   Запуск сервисной части (API)
// ----------------------------------------
function startPrintService() {
  if (apiStarted) {
    console.log("API уже запущен");
    return;
  }

  apiStarted = true;

  try {
    startApi();
    new Notification({
      title: "Сервис печати",
      body: "Локальный сервис запущен",
    }).show();
  } catch (err) {
    console.error("API start error:", err);
  }
}

// ------------------------------
//  Трей
// ------------------------------
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
    { type: "separator" },
    {
      label: "Запустить сервис",
      click: () => startPrintService(),
    },
    { type: "separator" },
    {
      label: "Выйти",
      click: () => {
        stopApi?.();
        app.quit();
      },
    },
  ]);

  tray.setToolTip("Сервис печати");
  tray.setContextMenu(contextMenu);
}

let updateListenersInitialized = false;

function initAutoUpdater() {
  if (updateListenersInitialized) return;
  updateListenersInitialized = true;

  autoUpdater.on("update-available", () => {
    dialog.showMessageBox({
      type: "info",
      title: "Обновление найдено",
      message: "Новая версия загружается...",
    });
  });

  autoUpdater.on("update-downloaded", () => {
    dialog.showMessageBox({
      type: "info",
      buttons: ["Перезапустить", "Позже"],
      title: "Обновление доступно",
      message: "Установить обновление сейчас?",
    }).then((res) => {
      if (res.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  });

  autoUpdater.on("error", (err) => {
    console.error("Updater error:", err);
  });
}

// ------------------------------
//   Версия
// ------------------------------
ipcMain.handle("get-version", () => app.getVersion());

// ------------------------------
//   Обновления
// ------------------------------
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

// ------------------------------
//   Старт приложения
// ------------------------------
app.on("ready", async () => {
  // 1. Проверяем: был ли запуск по протоколу
  const url = process.argv.find((a) => a.startsWith("ticketingprint://"));
  if (url) handleProtocol(url);

  // 2. Стартуем API один раз
  startPrintService();

  // 3. Трей
  createTray();

  // 4. Проверка обновлений
  initAutoUpdater();
  autoUpdater.checkForUpdates().catch(() => { });

  // 5. Автозапуск
  try {
    const launcher = new AutoLaunch({
      name: "Printer Service",
      path: app.getPath("exe"),
    });

    if (cfg.autoLaunch) {
      launcher.enable();
    } else {
      launcher.disable();
    }
  } catch (e) {
    console.warn("AutoLaunch error:", e);
  }
});

// ------------------------------
//   Приложение не закрываем
// ------------------------------
app.on("window-all-closed", () => {
  // Ничего не делаем, сервис работает полностью без окон
});

// ------------------------------
//   Quit
// ------------------------------
app.on("before-quit", () => {
  stopApi?.();
});
