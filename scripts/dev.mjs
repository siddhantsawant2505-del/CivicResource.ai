#!/usr/bin/env node
/**
 * CivicResource.ai — one-command local dev launcher.
 *
 * Starts the backend API, the FastAPI AI engine, and the web client together,
 * prefixes each service's output, and shuts them all down on Ctrl+C.
 *
 * Usage:  npm run dev        (from the repository root)
 *
 * Requires: Node.js (already needed by the project), Python, and a running MongoDB.
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const isWin = process.platform === "win32";
const npmCmd = isWin ? "npm.cmd" : "npm";
const pyCmd = isWin ? "python" : "python3";

function readEnvValue(file, key, fallback) {
  try {
    const text = readFileSync(file, "utf8");
    const match = text.match(new RegExp(`^\\s*${key}\\s*=\\s*(.+?)\\s*$`, "m"));
    return match ? match[1].replace(/^["']|["']$/g, "").trim() : fallback;
  } catch {
    return fallback;
  }
}

function portOf(file, key, fallback) {
  const value = readEnvValue(file, key, fallback);
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const serverPort = portOf(resolve(root, "server/.env"), "PORT", 5000);
const aiPort = portOf(resolve(root, "ai-engine/.env"), "AI_ENGINE_PORT", 8000);
const clientPort = 8080;

const services = [
  {
    name: "server",
    color: "\x1b[34m",
    cmd: npmCmd,
    args: ["run", "dev"],
    cwd: resolve(root, "server"),
    url: `http://localhost:${serverPort}`,
  },
  {
    name: "ai    ",
    color: "\x1b[35m",
    cmd: pyCmd,
    args: ["main.py"],
    cwd: resolve(root, "ai-engine"),
    url: `http://localhost:${aiPort}`,
  },
  {
    name: "client",
    color: "\x1b[32m",
    cmd: npmCmd,
    args: ["run", "dev"],
    cwd: resolve(root, "client"),
    url: `http://localhost:${clientPort}`,
  },
];

const RESET = "\x1b[0m";

// Fail fast with an actionable message instead of a wall of spawn errors.
const problems = [];
if (!existsSync(resolve(root, "server/node_modules"))) problems.push("server/node_modules is missing — run: cd server && npm install");
if (!existsSync(resolve(root, "client/node_modules"))) problems.push("client/node_modules is missing — run: cd client && npm install");
if (!existsSync(resolve(root, "server/.env"))) problems.push("server/.env is missing — copy values from README.md 'Local Setup'");
if (!existsSync(resolve(root, "ai-engine/.env"))) problems.push("ai-engine/.env is missing — copy values from README.md 'Local Setup'");

if (problems.length) {
  console.error("\nCannot start — fix these first:\n");
  for (const p of problems) console.error(`  • ${p}`);
  console.error("");
  process.exit(1);
}

console.log("\nStarting CivicResource.ai services:\n");
for (const s of services) console.log(`  ${s.color}${s.name}${RESET}  →  ${s.url}`);
console.log("\nPress Ctrl+C to stop all services.\n");

const children = [];
let shuttingDown = false;

function killTree(child) {
  if (!child || child.killed || child.exitCode !== null) return;
  if (isWin) {
    try {
      spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    } catch {
      child.kill();
    }
  } else {
    child.kill("SIGTERM");
  }
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) killTree(child);
  setTimeout(() => process.exit(code), 300);
}

for (const service of services) {
  const child = spawn(service.cmd, service.args, {
    cwd: service.cwd,
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
    shell: isWin,
  });

  const prefix = `${service.color}[${service.name}]${RESET} `;
  const pipe = (stream, target) => {
    let buffer = "";
    stream.on("data", (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";
      for (const line of lines) target.write(`${prefix}${line}\n`);
    });
  };
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);

  child.on("error", (err) => {
    process.stderr.write(`${prefix}failed to start: ${err.message}\n`);
  });
  child.on("exit", (code) => {
    if (!shuttingDown) {
      process.stdout.write(`${prefix}exited with code ${code}\n`);
      shutdown(code ?? 0);
    }
  });

  children.push(child);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
