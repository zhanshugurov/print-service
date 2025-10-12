// src/print.ts
import { BrowserWindow } from "electron";

function createHiddenWindow(): BrowserWindow {
    const win = new BrowserWindow({
        show: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });
    return win;
}

export async function getPrinters(): Promise<Electron.PrinterInfo[]> {
    const win = createHiddenWindow();
    // depending on electron version either getPrintersAsync or getPrinters exists
    const wc = win.webContents as any;
    try {
        if (wc.getPrintersAsync) {
            const res = await wc.getPrintersAsync();
            win.destroy();
            return res as Electron.PrinterInfo[];
        }
        const res = wc.getPrinters();
        win.destroy();
        return res as Electron.PrinterInfo[];
    } catch (e) {
        win.destroy();
        console.error("getPrinters error", e);
        return [];
    }
}

export async function printHtml(html: string, deviceName?: string): Promise<void> {
    return new Promise(async (resolve, reject) => {
        const win = new BrowserWindow({
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
            try { win.close(); } catch { }
            try { win.destroy(); } catch { }
        };

        win.webContents.once("did-finish-load", () => {
            // printOptions
            const options: Electron.WebContentsPrintOptions = {
                silent: true,
                printBackground: true,
                deviceName: deviceName || undefined
            };

            win.webContents.print(options, (success, errorType) => {
                cleanup();
                if (!success) {
                    reject(new Error(String(errorType || "print-failed")));
                } else {
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
