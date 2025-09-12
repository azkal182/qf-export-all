import fs from "node:fs";
import pLimit from "p-limit";
export const PER_PAGE = Number(process.env.PER_PAGE || 50);
export const LANGUAGE = process.env.LANGUAGE || "en";
export const CONCURRENCY = Number(process.env.CONCURRENCY || 4);
export const SLEEP_MS = Number(process.env.SLEEP_MS || 200);
export const limit = pLimit(CONCURRENCY);
export const outdir = "out";
if (!fs.existsSync(outdir))
    fs.mkdirSync(outdir);
export function ndjson(path, obj) {
    fs.appendFileSync(`${outdir}/${path}`, JSON.stringify(obj) + "\n");
}
export function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}
export function onlyWants(key) {
    const ONLY = (process.env.ONLY || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    return ONLY.length === 0 || ONLY.includes(key);
}
