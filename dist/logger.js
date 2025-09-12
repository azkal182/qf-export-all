import fs from "node:fs";
import path from "node:path";
const levelOrder = {
    debug: 10,
    info: 20,
    warn: 30,
    error: 40,
};
const envLevel = (process.env.LOG_LEVEL || "info").toLowerCase();
const minLevel = levelOrder[envLevel] ?? levelOrder.info;
const jsonMode = String(process.env.LOG_JSON || "false").toLowerCase() === "true";
const logFile = process.env.LOG_FILE || "";
let stream = null;
if (logFile) {
    const dir = path.dirname(logFile);
    if (!fs.existsSync(dir))
        fs.mkdirSync(dir, { recursive: true });
    stream = fs.createWriteStream(logFile, { flags: "a" });
}
function ts() {
    return new Date().toISOString();
}
function write(line) {
    if (stream)
        stream.write(line + "\n");
    // selalu ke console juga
    // (kalau mau “hanya ke file”, hapus baris di bawah)
    process.stdout.write(line + "\n");
}
function logAt(level, msg, meta) {
    if (levelOrder[level] < minLevel)
        return;
    if (jsonMode) {
        const obj = { t: ts(), level, msg, ...(meta || {}) };
        write(JSON.stringify(obj));
        return;
    }
    const tag = level === "debug"
        ? "🐛 DEBUG"
        : level === "info"
            ? "ℹ️  INFO "
            : level === "warn"
                ? "⚠️  WARN "
                : "❌ ERROR";
    const extra = meta ? " " + JSON.stringify(meta) : "";
    write(`${ts()} ${tag} ${msg}${extra}`);
}
export const log = {
    debug: (m, meta) => logAt("debug", m, meta),
    info: (m, meta) => logAt("info", m, meta),
    warn: (m, meta) => logAt("warn", m, meta),
    error: (m, meta) => logAt("error", m, meta),
};
// Heartbeat util untuk progress periodik
let heartbeatTimer = null;
export function startHeartbeat(fn) {
    const interval = Number(process.env.LOG_INTERVAL_MS || 10000);
    if (interval <= 0)
        return;
    stopHeartbeat();
    heartbeatTimer = setInterval(() => {
        try {
            log.info("heartbeat", fn());
        }
        catch { }
    }, interval);
}
export function stopHeartbeat() {
    if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
    }
}
