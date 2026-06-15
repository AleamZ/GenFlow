/// <reference types="vite/client" />

// Injected at build time from web/package.json "version".
declare const __APP_VERSION__: string;

// Exposed by the Electron preload bridge (desktop build only).
interface Window {
  genflow?: import("./platform").GenflowBridge;
}
