// Order service. Depends on binance + the shared store.
import { getPrice } from "./binance";
import { appState } from "../store/state";

export async function placeOrder(symbol: string, qty: number): Promise<void> {
  const price = await getPrice(symbol);
  appState.lastOrder = { symbol, qty, price };
}
