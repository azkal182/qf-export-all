import fs from "node:fs";
const path = process.env.CHECKPOINT_PATH || "";
export function loadCP() {
    if (!path)
        return {};
    try {
        const t = fs.readFileSync(path, "utf8");
        return JSON.parse(t);
    }
    catch {
        return {};
    }
}
export function saveCP(obj) {
    if (!path)
        return;
    fs.writeFileSync(path, JSON.stringify(obj, null, 2));
}
export function setCP(section, key, value) {
    const cp = loadCP();
    cp[section] = cp[section] || {};
    cp[section][key] = value;
    saveCP(cp);
}
export function getCP(section, key, def) {
    const cp = loadCP();
    return cp?.[section]?.[key] ?? def;
}
