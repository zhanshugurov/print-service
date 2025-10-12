// src/api.ts
import express from "express";
import bodyParser from "body-parser";
import path from "path";
import { loadConfig, saveConfig, AppConfig } from "./config";
import { getPrinters, printHtml } from "./print";
import { app as electronApp } from "electron";
import { Notification } from "electron";
import cors from "cors";

export function startApi() {
    let cfg = loadConfig();

    const app = express();
    app.use(bodyParser.json({ limit: "10mb" }));
    app.use(cors({
        origin: "*",
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
    }));

    // Serve UI static files.
    // When packaged, __dirname points into app.asar/dist — we copy renderer into dist/renderer during build.
    const rendererPath = path.join(__dirname, "renderer");
    app.use(express.static(rendererPath));


    // UI root
    app.get("/", (_req, res) => {
        res.sendFile(path.join(rendererPath, "index.html"));
    });

    // Test health
    app.get("/api/health", async (_req, res) => {
        res.json({ status: "ok" });
    });

    // Get printers
    app.get("/api/printers", async (_req, res) => {
        try {
            const printers = await getPrinters();
            res.json({ printers, preferred: cfg.preferredPrinter, port: cfg.port, autoLaunch: cfg.autoLaunch });
        } catch (e) {
            res.status(500).json({ error: String(e) });
        }
    });

    // Select preferred printer
    app.post("/api/printers/select", (req, res) => {
        const { printerName } = req.body;
        cfg.preferredPrinter = printerName || null;
        saveConfig(cfg);
        res.json({ ok: true, preferred: cfg.preferredPrinter });
    });

    // Set port
    app.post("/api/config/port", (req, res) => {
        const { port } = req.body;
        const num = Number(port);
        if (!Number.isInteger(num) || num <= 0 || num > 65535) return res.status(400).json({ error: "invalid port" });
        cfg.port = num;
        saveConfig(cfg);
        res.json({ ok: true, port: cfg.port });
    });

    // Set autolaunch preference
    app.post("/api/config/autolaunch", (req, res) => {
        const { autoLaunch } = req.body;
        cfg.autoLaunch = !!autoLaunch;
        saveConfig(cfg);
        res.json({ ok: true, autoLaunch: cfg.autoLaunch });
    });

    // Print HTML
    app.post("/api/print", async (req, res) => {
        const { html } = req.body;
        if (!html) return res.status(400).json({ error: "missing html" });
        const device = cfg.preferredPrinter || undefined;
        try {
            await printHtml(html, device);
            res.json({ ok: true });
        } catch (e) {
            console.error("Print error:", e);

            // --- показываем уведомление в Windows ---
            try {
                new Notification({
                    title: "Ошибка печати",
                    body: `Не удалось напечатать на принтере "${device || "По умолчанию"}". Выберите другой принтер в настройках.`,
                }).show();
            } catch (notifyErr) {
                console.error("Notification error:", notifyErr);
            }
            // ----------------------------------------

            res.status(500).json({ error: String(e) });
        }
    });

    // Test print
    app.post("/api/print/test", async (_req, res) => {
        const html = `<div style="font-family: Arial; font-size: 12px;">
            <h2>Test Print</h2>
            <div>Date: ${new Date().toLocaleString()}</div>
            <div>Machine: ${electronApp.getName()} (${process.platform})</div>
        </div>`;
        try {
            await printHtml(html, cfg.preferredPrinter || undefined);
            res.json({ ok: true });
        } catch (e) {
            console.error("Test Print error:", e);

            // уведомление и для тестового принта
            try {
                new Notification({
                    title: "Ошибка тестовой печати",
                    body: `Не удалось напечатать на "${cfg.preferredPrinter || "По умолчанию"}". Зайдите в веб-интерфейс и выберите другой принтер.`,
                }).show();
            } catch (notifyErr) {
                console.error("Notification error:", notifyErr);
            }
            res.status(500).json({ error: String(e) });
        }
    });

    // Get full config
    app.get("/api/config", (_req, res) => {
        res.json(cfg);
    });

    // Print raw HTML via query example (debug)
    app.post("/api/print/url", async (req, res) => {
        const { url } = req.body;
        if (!url) return res.status(400).json({ error: "missing url" });
        try {
            await printHtml(`<iframe src="${url}" style="width:100%;height:100%"></iframe>`, cfg.preferredPrinter || undefined);
            res.json({ ok: true });
        } catch (e) {
            res.status(500).json({ error: String(e) });
        }
    });

    // Start server
    const port = cfg.port || 9100;
    app.listen(port, "127.0.0.1", () => {
        console.log(`PrinterService: API + UI available at http://localhost:${port}`);
    });

    // --- запуск сервера ---
    const server = app.listen(port, () => {
        // уведомление при успешном запуске
        new Notification({
            title: "Приложение запущено",
            body: `Сервер работает на порту ${port}`,
        }).show();

        console.log(`✅ Server started on port ${port}`);
    });

    server.on("error", (err: any) => {
        console.error("❌ Failed to start server:", err);

        // уведомление при ошибке
        new Notification({
            title: "Ошибка запуска",
            body: `Не удалось запустить сервер на порту ${port}.`,
        }).show();

        // корректно завершаем процесс
        electronApp.quit();
    });
}
