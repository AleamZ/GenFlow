// Entrypoint: wires up config and starts the bot.
import { startBot } from "./bot";
import { config } from "./config";

export function main(): void {
  console.log(`Starting ${config.appName} in ${config.env} mode`);
  startBot();
}

main();
