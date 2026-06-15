import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const API_TARGET = process.env.GENFLOW_API ?? "http://127.0.0.1:5174";
const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

// https://vite.dev/config/
export default defineConfig({
  // Relative base so the built app loads over file:// inside Electron,
  // while still working when served at "/" (web/Render).
  base: "./",
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  server: {
    port: 5173,
    strictPort: false,
    open: process.env.GENFLOW_OPEN !== "false",
    proxy: {
      "/api": { target: API_TARGET, changeOrigin: true },
    },
  },
});
