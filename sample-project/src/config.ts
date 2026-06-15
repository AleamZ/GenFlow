// App configuration (no internal dependencies).
export const config = {
  appName: "sample-trading-bot",
  env: process.env.NODE_ENV ?? "development",
  baseUrl: "https://api.binance.com",
  symbols: ["BTCUSDT", "ETHUSDT"],
};

export type AppConfig = typeof config;
