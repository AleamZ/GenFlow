// A "hook"-style module (matches use* naming heuristic).
import { getPrice } from "../services/binance";
import { formatPrice } from "../utils/format";

export function usePrice(symbol: string) {
  let display = "loading...";
  getPrice(symbol).then((p) => {
    display = formatPrice(p);
  });
  return { symbol, display };
}
