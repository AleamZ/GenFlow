// Shared application state (store).
import { log } from "../utils/logger";

export interface AppState {
  running: boolean;
  lastOrder: { symbol: string; qty: number; price: number } | null;
}

export const appState: AppState = {
  running: false,
  lastOrder: null,
};

export function resetState(): void {
  appState.running = false;
  appState.lastOrder = null;
  log("state reset");
}
