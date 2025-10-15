"use strict";

const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

function log(msg) {
  // Keep logs concise and clear for CLI
  process.stdout.write(`${msg}\n`);
}

function parseArgs(argv) {
  const args = { port: 9222, headless: true, url: null, profileDir: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--no-headless") args.headless = false;
    else if (a === "--headless") args.headless = true;
    else if (a === "--port" && argv[i + 1]) args.port = Number(argv[++i]);
    else if (a.startsWith("--port=")) args.port = Number(a.split("=")[1]);
    else if (a === "--url" && argv[i + 1]) args.url = argv[++i];
    else if (a.startsWith("--url=")) args.url = a.split("=")[1];
    else if (a === "--user-data-dir" && argv[i + 1]) args.profileDir = argv[++i];
    else if (a.startsWith("--user-data-dir=")) args.profileDir = a.split("=")[1];
  }
  if (!Number.isFinite(args.port) || args.port <= 0) args.port = 9222;
  return args;
}

function exists(p) {
  try {
    return fs.existsSync(p);
  } catch (_) {
    return false;
  }
}

function which(cmd) {
  // very lightweight PATH lookup
  const pathEnv = process.env.PATH || process.env.Path || "";
  const exts = process.platform === "win32" ? (process.env.PATHEXT || ".EXE;.CMD;.BAT").split(";") : [""];
  for (const dir of pathEnv.split(path.delimiter)) {
    const base = path.join(dir, cmd);
    for (const ext of exts) {
      const candidate = base + ext;
      if (exists(candidate)) return candidate;
    }
  }
  return null;
}

function findChromeBinary() {
  // Honor explicit override first
  const envPath = process.env.CHROME_PATH || process.env.GOOGLE_CHROME_BIN;
  if (envPath && exists(envPath)) return envPath;

  if (process.platform === "win32") {
    const local = process.env.LOCALAPPDATA || "";
    const pf = process.env["ProgramFiles"] || "C:\\Program Files";
    const pfx86 = process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";
    const candidates = [
      path.join(local, "Google", "Chrome", "Application", "chrome.exe"),
      path.join(local, "Google", "Chrome SxS", "Application", "chrome.exe"), // Canary
      path.join(pf, "Google", "Chrome", "Application", "chrome.exe"),
      path.join(pfx86, "Google", "Chrome", "Application", "chrome.exe"),
    ];
    for (const c of candidates) if (exists(c)) return c;
    // PATH fallback
    const onPath = which("chrome.exe") || which("chrome");
    if (onPath) return onPath;
  } else if (process.platform === "darwin") {
    const candidates = [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
    ];
    for (const c of candidates) if (exists(c)) return c;
    const onPath = which("google-chrome") || which("chrome");
    if (onPath) return onPath;
  } else {
    const candidates = [
      "google-chrome-stable",
      "google-chrome",
      "chromium-browser",
      "chromium",
      "chrome",
    ];
    for (const c of candidates) {
      const bin = which(c);
      if (bin) return bin;
    }
  }
  return null;
}

function ensureProfileDir(requested) {
  const base = requested || path.join(process.cwd(), ".tmp", "chrome-cdp-profile");
  fs.mkdirSync(base, { recursive: true });
  return base;
}

(async function main() {
  const { port, headless, url, profileDir } = parseArgs(process.argv);
  const chrome = findChromeBinary();
  if (!chrome) {
    log("[devtools:chrome] Could not locate Chrome binary.");
    log("Set CHROME_PATH env or install Google Chrome.");
    process.exit(1);
  }

  const userDataDir = ensureProfileDir(profileDir);
  const args = [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    "--no-first-run",
    "--no-default-browser-check",
  ];
  if (headless) args.push("--headless=new");
  // Optional: reduce noise/resource usage when headless
  if (headless) args.push("--disable-gpu", "--hide-crash-restore-bubble");

  if (url) args.push(url);

  log(`[devtools:chrome] Launching: ${chrome}`);
  log(`[devtools:chrome] Port: ${port}`);
  log(`[devtools:chrome] Profile: ${userDataDir}`);
  if (headless) log("[devtools:chrome] Mode: headless"); else log("[devtools:chrome] Mode: visible");
  log("[devtools:chrome] Tip: open another Chrome -> chrome://inspect/#devices -> Configure -> 127.0.0.1:" + port);

  const child = spawn(chrome, args, {
    stdio: "inherit",
    windowsHide: false,
  });

  child.on("error", (err) => {
    log(`[devtools:chrome] Failed to start Chrome: ${err.message}`);
    process.exit(1);
  });

  child.on("exit", (code, signal) => {
    if (signal) log(`[devtools:chrome] Exited with signal: ${signal}`);
    else log(`[devtools:chrome] Exited with code: ${code}`);
    process.exit(code || 0);
  });
})();

