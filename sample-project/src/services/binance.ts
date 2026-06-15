// @ts-nocheck — demo fixture only (imports the uninstalled "axios" package on
// purpose). Analyzed via sample-project's own tsconfig; this directive just stops a
// repo-wide `tsc` (e.g. on a deploy host) from failing on this sample file.
// Binance service. Imports ../bot, closing the bot <-> binance cycle.
import axios from "axios";
import { log } from "../utils/logger";
import { handleMessage } from "../bot";

export async function getPrice(symbol: string): Promise<number> {
  log(`fetching price for ${symbol}`);
  const res = await axios.get(`https://api.binance.com/api/v3/ticker/price`, {
    params: { symbol },
  });
  return Number(res.data.price);
}

export function notifyPrice(symbol: string): void {
  // Calls back into bot — this is what makes the dependency circular.
  void handleMessage(`/price ${symbol}`);
}
