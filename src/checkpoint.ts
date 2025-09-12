import fs from "node:fs";

const path = process.env.CHECKPOINT_PATH || "";

type CP = Record<string, any>;

export function loadCP(): CP {
  if (!path) return {};
  try {
    const t = fs.readFileSync(path, "utf8");
    return JSON.parse(t);
  } catch {
    return {};
  }
}

export function saveCP(obj: CP) {
  if (!path) return;
  fs.writeFileSync(path, JSON.stringify(obj, null, 2));
}

export function setCP(section: string, key: string, value: any) {
  const cp = loadCP();
  cp[section] = cp[section] || {};
  cp[section][key] = value;
  saveCP(cp);
}

export function getCP(section: string, key: string, def?: any) {
  const cp = loadCP();
  return cp?.[section]?.[key] ?? def;
}
