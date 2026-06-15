// @ts-nocheck — demo fixture only. It imports an uninstalled package and a local
// "@/" alias on purpose (to showcase external + alias resolution in GenFlow). The
// analyzer reads it via sample-project's own tsconfig; this directive just stops a
// repo-wide `tsc` (e.g. on a deploy host) from failing on this sample file.
// Bot service. Part of a deliberate circular dependency with services/binance.
import TelegramBot from "node-telegram-bot-api";
import { getPrice } from "./services/binance";
import { log } from "@/utils/logger";
import { appState } from "./store/state";

const bot = new TelegramBot("dummy-token", { polling: false });

export function startBot(): void {
  log("bot starting");
  appState.running = true;
  bot.on("message", (msg: { text?: string }) => handleMessage(msg.text ?? ""));
}

export async function handleMessage(text: string): Promise<void> {
  if (text.startsWith("/price")) {
    const price = await getPrice("BTCUSDT");
    log(`price = ${price}`);
  }
}
