"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld("electronAPI", {
    getVersion: () => electron_1.ipcRenderer.invoke("get-version"),
    checkForUpdates: () => electron_1.ipcRenderer.invoke("check-for-updates"),
});
