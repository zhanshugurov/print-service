"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPrinters = getPrinters;
exports.printHtml = printHtml;
// src/print.ts
const electron_1 = require("electron");
function createHiddenWindow() {
    const win = new electron_1.BrowserWindow({
        show: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });
    return win;
}
async function getPrinters() {
    const win = createHiddenWindow();
    // depending on electron version either getPrintersAsync or getPrinters exists
    const wc = win.webContents;
    try {
        if (wc.getPrintersAsync) {
            const res = await wc.getPrintersAsync();
            win.destroy();
            return res;
        }
        const res = wc.getPrinters();
        win.destroy();
        return res;
    }
    catch (e) {
        win.destroy();
        console.error("getPrinters error", e);
        return [];
    }
}
async function printHtml(html, deviceName) {
    return new Promise(async (resolve, reject) => {
        const win = new electron_1.BrowserWindow({
            show: false,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true
            }
        });
        const url = "data:text/html;charset=utf-8," + encodeURIComponent(html);
        win.loadURL(url).catch(e => {
            win.destroy();
            reject(e);
        });
        const cleanup = () => {
            try {
                win.close();
            }
            catch { }
            try {
                win.destroy();
            }
            catch { }
        };
        win.webContents.once("did-finish-load", () => {
            // printOptions
            const options = {
                silent: true,
                printBackground: true,
                deviceName: deviceName || undefined
            };
            win.webContents.print(options, (success, errorType) => {
                cleanup();
                if (!success) {
                    reject(new Error(String(errorType || "print-failed")));
                }
                else {
                    resolve();
                }
            });
        });
        // safety timeout
        setTimeout(() => {
            cleanup();
            reject(new Error("print-timeout"));
        }, 20000);
    });
}
