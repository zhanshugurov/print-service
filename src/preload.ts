import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
    getVersion: () => ipcRenderer.invoke("get-version"),
    checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
});
