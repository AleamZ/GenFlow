// Workaround for electron-builder on Windows WITHOUT Administrator / Developer Mode.
//
// electron-builder always extracts its "winCodeSign" tool with `7za x -snld`, which tries
// to create the macOS dylib *symlinks* inside the archive. Creating symlinks on Windows
// needs a privilege most users don't have, so extraction fails and the build aborts —
// even though Windows builds never need those macOS files.
//
// This script pre-populates the winCodeSign cache directory, extracting everything EXCEPT
// the `darwin/` folder (no symlinks), so electron-builder finds the tool already cached and
// skips its own failing extraction. No-op on non-Windows and when the cache already exists.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import https from "node:https";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";

const VERSION = "winCodeSign-2.6.0";
const URL = `https://github.com/electron-userland/electron-builder-binaries/releases/download/${VERSION}/${VERSION}.7z`;

if (process.platform !== "win32") {
  console.log("prepare-wincodesign: not Windows, skipping.");
  process.exit(0);
}

const base =
  process.env.ELECTRON_BUILDER_CACHE ||
  path.join(process.env.LOCALAPPDATA || os.tmpdir(), "electron-builder", "Cache");
const cacheDir = path.join(base, "winCodeSign");
const targetDir = path.join(cacheDir, VERSION);

if (fs.existsSync(path.join(targetDir, "windows-10"))) {
  console.log("prepare-wincodesign: cache already present, skipping.");
  process.exit(0);
}

function find7za() {
  try {
    const require = createRequire(import.meta.url);
    return require("7zip-bin").path7za;
  } catch {
    return null;
  }
}

function downloadFollow(url, dest, redirectsLeft = 6) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode ?? 0) && res.headers.location) {
          res.resume();
          if (redirectsLeft <= 0) return reject(new Error("too many redirects"));
          return resolve(downloadFollow(res.headers.location, dest, redirectsLeft - 1));
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        }
        const file = fs.createWriteStream(dest);
        res.pipe(file);
        file.on("finish", () => file.close(() => resolve()));
        file.on("error", reject);
      })
      .on("error", reject);
  });
}

/** Reuse a previously downloaded archive if electron-builder already fetched one. */
function findCached7z() {
  if (!fs.existsSync(cacheDir)) return null;
  for (const f of fs.readdirSync(cacheDir)) {
    if (f.endsWith(".7z")) {
      const p = path.join(cacheDir, f);
      try {
        if (fs.statSync(p).size > 1_000_000) return p;
      } catch {
        /* ignore */
      }
    }
  }
  return null;
}

async function main() {
  const path7za = find7za();
  if (!path7za || !fs.existsSync(path7za)) {
    console.warn("prepare-wincodesign: 7za not found, skipping (build may need Developer Mode).");
    return;
  }

  fs.mkdirSync(cacheDir, { recursive: true });
  let archive = findCached7z();
  let downloaded = false;
  if (!archive) {
    archive = path.join(cacheDir, `${VERSION}.prep.7z`);
    console.log("prepare-wincodesign: downloading winCodeSign…");
    await downloadFollow(URL, archive);
    downloaded = true;
  }

  fs.mkdirSync(targetDir, { recursive: true });
  // Extract everything except darwin/ (the symlink-bearing macOS signing libs).
  execFileSync(path7za, ["x", archive, `-o${targetDir}`, "-xr!darwin", "-y"], { stdio: "inherit" });
  if (downloaded) fs.rmSync(archive, { force: true });

  console.log(`prepare-wincodesign: ready at ${targetDir}`);
}

main().catch((err) => {
  console.warn("prepare-wincodesign: failed —", err.message);
  console.warn("If the Windows build fails on winCodeSign, enable Developer Mode or run as admin.");
  // Non-fatal: let electron-builder try anyway.
  process.exit(0);
});
