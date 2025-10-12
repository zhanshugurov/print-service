// src/config.ts
import fs from "fs";
import path from "path";
import { app } from "electron";

export interface AppConfig {
  port: number;
  preferredPrinter: string | null;
  autoLaunch: boolean;
}

const defaultConfig: AppConfig = {
  port: 9100,
  preferredPrinter: null,
  autoLaunch: false
};

function getConfigPath(): string {
  const dataPath = app ? app.getPath("userData") : path.join(process.cwd(), "data");
  // ensure dir exists
  if (!fs.existsSync(dataPath)) fs.mkdirSync(dataPath, { recursive: true });
  return path.join(dataPath, "printer-config.json");
}

export function loadConfig(): AppConfig {
  try {
    const p = getConfigPath();
    if (!fs.existsSync(p)) {
      fs.writeFileSync(p, JSON.stringify(defaultConfig, null, 2), "utf-8");
      return defaultConfig;
    }
    const raw = fs.readFileSync(p, "utf-8");
    const parsed = JSON.parse(raw) as Partial<AppConfig>;
    return { ...defaultConfig, ...parsed };
  } catch (e) {
    console.error("loadConfig error", e);
    return defaultConfig;
  }
}

export function saveConfig(cfg: AppConfig) {
  try {
    const p = getConfigPath();
    fs.writeFileSync(p, JSON.stringify(cfg, null, 2), "utf-8");
  } catch (e) {
    console.error("saveConfig error", e);
  }
}
