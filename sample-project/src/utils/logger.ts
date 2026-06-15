// Logging util. Imported by several modules (high fan-in).
import { config } from "../config";

export function log(message: string): void {
  console.log(`[${config.appName}] ${message}`);
}
