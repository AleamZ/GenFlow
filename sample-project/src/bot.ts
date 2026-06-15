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
