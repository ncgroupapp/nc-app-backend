#!/usr/bin/env node
/**
 * Watches the "Ventas NC GROUP" folder and uploads every invoice / credit note (PDF or XML) saved there
 * to the app (POST /billing/sync). Runs on the office PC; needs Node 18+ and no extra packages.
 *
 * Config: config.json next to this file (see config.example.json) or environment variables
 * NC_API_URL, NC_SYNC_TOKEN, NC_VENTAS_FOLDER, NC_INTERVAL_SECONDS.
 *
 *   node sincronizar-ventas.mjs          keeps watching (default)
 *   node sincronizar-ventas.mjs --once   uploads what is pending and exits
 */
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const STATE_FILE = join(HERE, "subidos.json");
const LOG_FILE = join(HERE, "sincronizar-ventas.log");
const EXTENSIONS = new Set([".pdf", ".xml"]);
/** Browser downloads in progress and Office lock files */
const IGNORED = /(\.crdownload|\.part|\.tmp|\.download)$|^~\$|^\./i;

function loadConfig() {
  const file = join(HERE, "config.json");
  const fromFile = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
  const config = {
    apiUrl: process.env.NC_API_URL ?? fromFile.apiUrl,
    token: process.env.NC_SYNC_TOKEN ?? fromFile.token,
    folder: process.env.NC_VENTAS_FOLDER ?? fromFile.folder,
    intervalSeconds: Number(process.env.NC_INTERVAL_SECONDS ?? fromFile.intervalSeconds ?? 30),
  };
  const missing = ["apiUrl", "token", "folder"].filter((key) => !config[key]);
  if (missing.length) {
    throw new Error(`Falta configurar: ${missing.join(", ")}. Copiá config.example.json a config.json y completalo.`);
  }
  config.apiUrl = config.apiUrl.replace(/\/+$/, "");
  return config;
}

function log(message) {
  const line = `[${new Date().toLocaleString("es-UY")}] ${message}`;
  console.log(line);
  try {
    appendFileSync(LOG_FILE, line + "\n");
  } catch {
    // logging must never stop the sync
  }
}

/** path → { size, mtimeMs, hash, status } of every file already sent */
function loadState() {
  try {
    return JSON.parse(readFileSync(STATE_FILE, "utf8"));
  } catch {
    return {};
  }
}

const saveState = (state) => writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));

async function listFiles(folder) {
  const found = [];
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    if (IGNORED.test(entry.name)) continue;
    const path = join(folder, entry.name);
    if (entry.isDirectory()) found.push(...(await listFiles(path)));
    else if (EXTENSIONS.has(extname(entry.name).toLowerCase())) found.push(path);
  }
  return found;
}

async function upload(config, path, data) {
  const form = new FormData();
  const type = extname(path).toLowerCase() === ".xml" ? "application/xml" : "application/pdf";
  form.append("file", new Blob([data], { type }), basename(path));
  const response = await fetch(`${config.apiUrl}/billing/sync`, {
    method: "POST",
    headers: { "x-sync-token": config.token },
    body: form,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success === false) {
    const reason = typeof body.data === "string" ? body.data : body.message ?? response.statusText;
    const error = new Error(`HTTP ${response.status}: ${reason}`);
    // A wrong token or server config will not fix itself by retrying every file
    error.fatal = response.status === 401 || response.status === 503;
    throw error;
  }
  return body.data.results[0];
}

/** Files seen with the same size and date on the previous scan, so half-downloaded files are not sent */
const lastSeen = new Map();

async function scan(config, state, { waitForStable }) {
  let files;
  try {
    files = await listFiles(config.folder);
  } catch (error) {
    log(`No se puede leer la carpeta ${config.folder}: ${error.message}`);
    return;
  }

  for (const path of files) {
    let info;
    try {
      info = await stat(path);
    } catch {
      continue; // moved or deleted meanwhile
    }
    const sent = state[path];
    if (sent && sent.size === info.size && sent.mtimeMs === info.mtimeMs) continue;

    const signature = `${info.size}:${info.mtimeMs}`;
    if (waitForStable && lastSeen.get(path) !== signature) {
      lastSeen.set(path, signature);
      continue;
    }
    lastSeen.delete(path);

    try {
      const data = await readFile(path);
      const hash = createHash("sha256").update(data).digest("hex");
      if (sent?.hash === hash) {
        state[path] = { ...sent, size: info.size, mtimeMs: info.mtimeMs };
        saveState(state);
        continue;
      }
      const result = await upload(config, path, data);
      const label =
        result.status === "created"
          ? `subido (${result.document.type === "nota_credito" ? "nota de crédito" : "factura"} ${[result.document.series, result.document.number].filter(Boolean).join(" ") || "sin número"})`
          : result.status === "duplicate"
            ? "ya estaba en la app"
            : `no se subió: ${result.reason}`;
      log(`${basename(path)} → ${label}`);
      state[path] = { size: info.size, mtimeMs: info.mtimeMs, hash, status: result.status, at: new Date().toISOString() };
      saveState(state);
    } catch (error) {
      log(`${basename(path)} → error, se reintenta en la próxima vuelta: ${error.message}`);
      if (error.fatal) return;
    }
  }
}

async function main() {
  const config = loadConfig();
  const once = process.argv.includes("--once");
  const state = loadState();
  log(`Vigilando ${config.folder} → ${config.apiUrl} (cada ${config.intervalSeconds} s)`);

  // First pass uploads everything already in the folder
  await scan(config, state, { waitForStable: false });
  if (once) return;

  let running = false;
  setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await scan(config, state, { waitForStable: true });
    } finally {
      running = false;
    }
  }, config.intervalSeconds * 1000);
}

main().catch((error) => {
  log(`Error: ${error.message}`);
  process.exit(1);
});
