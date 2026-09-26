#!/usr/bin/env node
/**
 * CivicResource.ai — local stack health check.
 *
 * Verifies that MongoDB, the backend API, the AI engine, and the web client
 * are reachable, then prints a pass/fail summary.
 *
 * Usage:  npm run health        (from the repository root)
 * Exit code is 1 if any check fails, so it can gate scripts or CI.
 */
import net from "node:net";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function readEnvValue(file, key, fallback) {
  try {
    const text = readFileSync(file, "utf8");
    const match = text.match(new RegExp(`^\\s*${key}\\s*=\\s*(.+?)\\s*$`, "m"));
    return match ? match[1].replace(/^["']|["']$/g, "").trim() : fallback;
  } catch {
    return fallback;
  }
}

function toPort(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const mongoUri = readEnvValue(resolve(root, "server/.env"), "MONGODB_URI", "mongodb://127.0.0.1:27017/civicresourceai_dev");
const serverPort = toPort(readEnvValue(resolve(root, "server/.env"), "PORT", "5000"), 5000);
const aiPort = toPort(readEnvValue(resolve(root, "ai-engine/.env"), "AI_ENGINE_PORT", "8000"), 8000);
const clientPort = 8080;

function mongoTarget(uri) {
  try {
    const parsed = new URL(uri);
    return { host: parsed.hostname || "127.0.0.1", port: toPort(parsed.port, 27017) };
  } catch {
    return { host: "127.0.0.1", port: 27017 };
  }
}

function checkTcp(host, port, timeoutMs = 2000) {
  return new Promise((resolveResult) => {
    const socket = net.connect({ host, port });
    const finish = (ok, detail) => {
      socket.destroy();
      resolveResult({ ok, detail });
    };
    socket.once("connect", () => finish(true, "connected"));
    socket.once("error", (err) => finish(false, err.code || err.message));
    socket.setTimeout(timeoutMs, () => finish(false, "timed out"));
  });
}

async function checkHttp(url, timeoutMs = 4000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return { ok: response.ok, detail: `HTTP ${response.status}` };
  } catch (err) {
    return { ok: false, detail: err.name === "AbortError" ? "timed out" : "unreachable" };
  } finally {
    clearTimeout(timer);
  }
}

const mongo = mongoTarget(mongoUri);

const checks = [
  {
    name: "MongoDB",
    hint: "start it (winget/choco install, or: docker compose up -d)",
    run: () => checkTcp(mongo.host, mongo.port),
    target: `${mongo.host}:${mongo.port}`,
  },
  {
    name: "Server API",
    hint: "cd server && npm run dev",
    run: () => checkHttp(`http://localhost:${serverPort}/`),
    target: `http://localhost:${serverPort}`,
  },
  {
    name: "AI Engine",
    hint: "cd ai-engine && python main.py",
    run: () => checkHttp(`http://localhost:${aiPort}/`),
    target: `http://localhost:${aiPort}`,
  },
  {
    name: "Web Client",
    hint: "cd client && npm run dev",
    run: () => checkHttp(`http://localhost:${clientPort}/`),
    target: `http://localhost:${clientPort}`,
  },
];

console.log("\nCivicResource.ai — stack health\n");

let failures = 0;
for (const check of checks) {
  const result = await check.run();
  const mark = result.ok ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m";
  const label = check.name.padEnd(12);
  const detail = result.ok ? result.detail : `${result.detail} — ${check.hint}`;
  console.log(`  ${mark} ${label} ${check.target.padEnd(32)} ${detail}`);
  if (!result.ok) failures += 1;
}

console.log("");
if (failures === 0) {
  console.log("\x1b[32mAll services are up.\x1b[0m\n");
} else {
  console.log(`\x1b[31m${failures} service(s) not reachable.\x1b[0m\n`);
}
process.exit(failures === 0 ? 0 : 1);
