"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startApi = startApi;
// src/api.ts
const express_1 = __importDefault(require("express"));
const body_parser_1 = __importDefault(require("body-parser"));
const path_1 = __importDefault(require("path"));
const config_1 = require("./config");
const print_1 = require("./print");
const electron_1 = require("electron");
const cors_1 = __importDefault(require("cors"));
const electron_updater_1 = require("electron-updater");
function startApi() {
    let cfg = (0, config_1.loadConfig)();
    const app = (0, express_1.default)();
    app.use(body_parser_1.default.json({ limit: "10mb" }));
    app.use((0, cors_1.default)({
        origin: "*",
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
    }));
    // Serve static UI
    const rendererPath = path_1.default.join(__dirname, "renderer");
    app.use(express_1.default.static(rendererPath));
    // Root UI
    app.get("/", (_req, res) => {
        res.sendFile(path_1.default.join(rendererPath, "index.html"));
    });
    // Health check
    app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
    // Printers
    app.get("/api/printers", async (_req, res) => {
        try {
            const printers = await (0, print_1.getPrinters)();
            res.json({
                printers,
                preferred: cfg.preferredPrinter,
                port: cfg.port,
                autoLaunch: cfg.autoLaunch,
            });
        }
        catch (e) {
            res.status(500).json({ error: String(e) });
        }
    });
    app.post("/api/printers/select", (req, res) => {
        const { printerName } = req.body;
        cfg.preferredPrinter = printerName || null;
        (0, config_1.saveConfig)(cfg);
        res.json({ ok: true, preferred: cfg.preferredPrinter });
    });
    // Config updates
    app.post("/api/config/port", (req, res) => {
        const { port } = req.body;
        const num = Number(port);
        if (!Number.isInteger(num) || num <= 0 || num > 65535)
            return res.status(400).json({ error: "invalid port" });
        cfg.port = num;
        (0, config_1.saveConfig)(cfg);
        res.json({ ok: true, port: cfg.port });
    });
    app.post("/api/config/autolaunch", (req, res) => {
        const { autoLaunch } = req.body;
        cfg.autoLaunch = !!autoLaunch;
        (0, config_1.saveConfig)(cfg);
        res.json({ ok: true, autoLaunch: cfg.autoLaunch });
    });
    // Printing
    app.post("/api/print", async (req, res) => {
        const { html } = req.body;
        if (!html)
            return res.status(400).json({ error: "missing html" });
        const device = cfg.preferredPrinter || undefined;
        try {
            await (0, print_1.printHtml)(html, device);
            res.json({ ok: true });
        }
        catch (e) {
            console.error("Print error:", e);
            try {
                new electron_1.Notification({
                    title: "Ошибка печати",
                    body: `Не удалось напечатать на принтере "${device || "По умолчанию"}". Проверьте настройки.`,
                }).show();
            }
            catch { }
            res.status(500).json({ error: String(e) });
        }
    });
    // Test print
    app.post("/api/print/test", async (_req, res) => {
        const html = `<div style="font-family: Arial; font-size: 12px;">
        <h2>Test Print</h2>
        <div>Date: ${new Date().toLocaleString()}</div>
        <div>Machine: ${electron_1.app.getName()} (${process.platform})</div>
      </div>`;
        try {
            await (0, print_1.printHtml)(html, cfg.preferredPrinter || undefined);
            res.json({ ok: true });
        }
        catch (e) {
            console.error("Test print error:", e);
            try {
                new electron_1.Notification({
                    title: "Ошибка тестовой печати",
                    body: `Не удалось напечатать на "${cfg.preferredPrinter || "По умолчанию"}". Выберите другой.`,
                }).show();
            }
            catch { }
            res.status(500).json({ error: String(e) });
        }
    });
    app.get("/api/config", (_req, res) => res.json(cfg));
    app.get("/api/version", (_req, res) => {
        res.json({ version: electron_1.app.getVersion() });
    });
    app.get("/api/check-for-updates", async (_req, res) => {
        try {
            const result = await electron_updater_1.autoUpdater.checkForUpdates();
            if (result?.updateInfo) {
                res.json({ updateAvailable: true, info: result.updateInfo });
            }
            else {
                res.json({ updateAvailable: false });
            }
        }
        catch (err) {
            res.json({ error: err instanceof Error ? err.message : String(err) });
        }
    });
    // Start API
    const port = cfg.port || 9100;
    const server = app.listen(port, "127.0.0.1", () => {
        console.log(`✅ PrinterService listening at http://localhost:${port}`);
        // показать уведомление (после готовности Electron)
        setTimeout(() => {
            try {
                new electron_1.Notification({
                    title: "Сервис печати",
                    body: `Приложение запущено на порту ${port}`,
                }).show();
            }
            catch { }
        }, 200);
    });
    server.on("error", (err) => {
        console.error("❌ Failed to start server:", err);
        setTimeout(() => {
            try {
                new electron_1.Notification({
                    title: "Ошибка запуска",
                    body: `Не удалось запустить сервер на порту ${port}`,
                }).show();
            }
            catch { }
            electron_1.app.quit();
        }, 200);
    });
}
