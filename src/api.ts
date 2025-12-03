// src/api.ts
import express from "express";
import bodyParser from "body-parser";
import path from "path";
import { loadConfig, saveConfig } from "./config";
import { getPrinters, printHtml } from "./print";
import { app as electronApp, Notification } from "electron";
import cors from "cors";
import { autoUpdater } from "electron-updater";

let server: any = null;         // Express server instance
let apiRunning = false;         // API state flag

export function isApiRunning() {
  return apiRunning;
}

export function stopApi() {
  return new Promise<void>((resolve) => {
    if (!apiRunning || !server) {
      return resolve();
    }

    console.log("⛔ Остановка PrinterService API...");

    try {
      server.close(() => {
        console.log("🛑 PrinterService API остановлен");
        server = null;
        apiRunning = false;
        resolve();
      });
    } catch (err) {
      console.error("Ошибка при остановке API:", err);
      server = null;
      apiRunning = false;
      resolve();
    }
  });
}

export function startApi() {
  if (apiRunning) {
    console.log("⚠ API уже запущен — повторный запуск пропущен");
    return;
  }

  let cfg = loadConfig();
  const app = express();

  app.use(bodyParser.json({ limit: "10mb" }));
  app.use(
    cors({
      origin: "*",
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  );

  const rendererPath = path.join(__dirname, "renderer");
  app.use(express.static(rendererPath));

  app.get("/", (_req, res) => {
    res.sendFile(path.join(rendererPath, "index.html"));
  });

  // Health check
  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

  // Printers
  app.get("/api/printers", async (_req, res) => {
    try {
      const printers = await getPrinters();
      res.json({
        printers,
        preferred: cfg.preferredPrinter,
        port: cfg.port,
        autoLaunch: cfg.autoLaunch,
      });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.post("/api/printers/select", (req, res) => {
    const { printerName } = req.body;
    cfg.preferredPrinter = printerName || null;
    saveConfig(cfg);
    res.json({ ok: true, preferred: cfg.preferredPrinter });
  });

  // Config updates
  app.post("/api/config/port", (req, res) => {
    const { port } = req.body;
    const num = Number(port);
    if (!Number.isInteger(num) || num <= 0 || num > 65535)
      return res.status(400).json({ error: "invalid port" });

    cfg.port = num;
    saveConfig(cfg);
    res.json({ ok: true, port: cfg.port });
  });

  app.post("/api/config/autolaunch", (req, res) => {
    const { autoLaunch } = req.body;
    cfg.autoLaunch = !!autoLaunch;
    saveConfig(cfg);
    res.json({ ok: true, autoLaunch: cfg.autoLaunch });
  });

  // Printing
  app.post("/api/print", async (req, res) => {
    const { html } = req.body;
    if (!html) return res.status(400).json({ error: "missing html" });

    const device = cfg.preferredPrinter || undefined;

    try {
      await printHtml(html, device);
      res.json({ ok: true });
    } catch (e) {
      console.error("Print error:", e);
      try {
        new Notification({
          title: "Ошибка печати",
          body: `Не удалось напечатать на "${device || "По умолчанию"}"`,
        }).show();
      } catch { }
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
      try {
        new Notification({
          title: "Ошибка тестовой печати",
          body: `Не удалось напечатать на "${cfg.preferredPrinter || "По умолчанию"}"`,
        }).show();
      } catch { }
      res.status(500).json({ error: String(e) });
    }
  });

  app.get("/api/version", (_req, res) => {
    res.json({ version: electronApp.getVersion() });
  });

  app.get("/api/config", (_req, res) => res.json(cfg));

  app.get("/api/check-for-updates", async (_req, res) => {
    try {
      const result = await autoUpdater.checkForUpdates();
      if (result?.updateInfo) {
        res.json({ updateAvailable: true, info: result.updateInfo });
      } else {
        res.json({ updateAvailable: false });
      }
    } catch (err) {
      res.json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // -------------------------------------------
  // Start API server
  // -------------------------------------------
  const port = cfg.port || 9100;

  server = app.listen(port, "127.0.0.1", () => {
    apiRunning = true;
    console.log(`✅ PrinterService listening at http://localhost:${port}`);

    try {
      new Notification({
        title: "Сервис печати",
        body: `Запущен на порту ${port}`,
      }).show();
    } catch { }
  });

  server.on("error", (err: any) => {
    console.error("❌ Failed to start server:", err);

    try {
      new Notification({
        title: "Ошибка запуска",
        body: `Не удалось запустить сервер на порту ${port}`,
      }).show();
    } catch { }

    electronApp.quit();
  });
}
