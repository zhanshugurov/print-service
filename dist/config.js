"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadConfig = loadConfig;
exports.saveConfig = saveConfig;
// src/config.ts
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const electron_1 = require("electron");
const defaultConfig = {
    port: 9100,
    preferredPrinter: null,
    autoLaunch: false
};
function getConfigPath() {
    const dataPath = electron_1.app ? electron_1.app.getPath("userData") : path_1.default.join(process.cwd(), "data");
    // ensure dir exists
    if (!fs_1.default.existsSync(dataPath))
        fs_1.default.mkdirSync(dataPath, { recursive: true });
    return path_1.default.join(dataPath, "printer-config.json");
}
function loadConfig() {
    try {
        const p = getConfigPath();
        if (!fs_1.default.existsSync(p)) {
            fs_1.default.writeFileSync(p, JSON.stringify(defaultConfig, null, 2), "utf-8");
            return defaultConfig;
        }
        const raw = fs_1.default.readFileSync(p, "utf-8");
        const parsed = JSON.parse(raw);
        return { ...defaultConfig, ...parsed };
    }
    catch (e) {
        console.error("loadConfig error", e);
        return defaultConfig;
    }
}
function saveConfig(cfg) {
    try {
        const p = getConfigPath();
        fs_1.default.writeFileSync(p, JSON.stringify(cfg, null, 2), "utf-8");
    }
    catch (e) {
        console.error("saveConfig error", e);
    }
}
