import "dotenv/config";
import axios from "axios";
import { log } from "./logger.js";

const ENABLED =
  String(process.env.TELEGRAM_ENABLED || "false").toLowerCase() === "true";
const BOT = process.env.TELEGRAM_BOT_TOKEN || "";
const CHAT = process.env.TELEGRAM_CHAT_ID || "";

export async function notifyTelegram(text: string) {
  if (!ENABLED) return;
  if (!BOT || !CHAT) {
    log.warn("telegram: missing BOT token or CHAT id, skipping");
    return;
  }
  try {
    await axios.post(
      `https://api.telegram.org/bot${BOT}/sendMessage`,
      {
        chat_id: CHAT,
        text,
        disable_web_page_preview: true,
        parse_mode: "Markdown",
      },
      { timeout: 10000 }
    );
    log.info("telegram: notification sent");
  } catch (e: any) {
    log.error("telegram: send failed", { err: e?.message });
  }
}

export function formatFatal(title: string, detail?: Record<string, any>) {
  const d = detail
    ? "```json\n" + JSON.stringify(detail, null, 2).slice(0, 3500) + "\n```"
    : "";
  return `❌ *${title}*\n${d}`;
}
