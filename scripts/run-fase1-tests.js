#!/usr/bin/env node
/**
 * Esegue tutti i test automatici Fase 1 con emulatori Firebase.
 */

import { spawn } from "child_process";
import { createInterface } from "readline";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const BASE = "http://127.0.0.1:5050";

function run(cmd, args, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: ROOT,
      env: { ...process.env, FIREBASE_EMULATOR: "1", ...env },
      stdio: "inherit"
    });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exit ${code}`))));
  });
}

async function waitForUrl(url, attempts = 40) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Servizio non raggiungibile: ${url}`);
}

function startEmulators() {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "npx",
      ["firebase-tools@15.22.3", "emulators:start", "--project", "che-facim", "--only", "auth,firestore"],
      { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] }
    );

    const onLine = (line) => {
      process.stdout.write(`[emulators] ${line}\n`);
      if (/All emulators ready|All emulators ready!/i.test(line)) {
        resolve(child);
      }
    };

    const rlOut = createInterface({ input: child.stdout });
    rlOut.on("line", onLine);
    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      process.stderr.write(`[emulators] ${text}`);
      text.split("\n").filter(Boolean).forEach(onLine);
    });

    setTimeout(() => reject(new Error("Timeout avvio emulatori Firebase")), 120000);
    child.on("exit", (code) => reject(new Error(`Emulatori terminati prematuramente (${code})`)));
  });
}

async function killStaleEmulators() {
  const { execSync } = await import("child_process");
  const cmds = [
    "pkill -f 'cloud-firestore-emulator' 2>/dev/null || true",
    "pkill -f 'firebase.*emulators:start' 2>/dev/null || true",
    "fuser -k 9099/tcp 8080/tcp 4400/tcp 4500/tcp 9150/tcp 5050/tcp 2>/dev/null || true"
  ];
  for (const cmd of cmds) {
    try {
      execSync(cmd, { stdio: "ignore" });
    } catch {
      // best-effort
    }
  }
  await new Promise((r) => setTimeout(r, 2000));
}

async function stopProcess(child, label) {
  if (!child || child.killed) return;
  child.kill("SIGTERM");
  await new Promise((r) => setTimeout(r, 1500));
  if (!child.killed) child.kill("SIGKILL");
}

async function main() {
  console.log("=== Suite completa test Fase 1 ===\n");

  await killStaleEmulators();

  const hosting = spawn(
    "python3",
    ["-m", "http.server", "5050", "--bind", "127.0.0.1"],
    { cwd: join(ROOT, "public"), stdio: "ignore" }
  );

  let emulators;
  try {
    await waitForUrl(`${BASE}/auth/login.html`);
    emulators = await startEmulators();

    await run("node", ["scripts/test-fase1-rules.js"]);
    await run("node", ["scripts/test-fase1.js", BASE]);
    await run("node", ["scripts/test-fase1-e2e.js", BASE]);
  } finally {
    await stopProcess(emulators, "emulators");
    await stopProcess(hosting, "hosting");
    await killStaleEmulators();
  }

  console.log("\n✅ Tutti i test automatici Fase 1 completati con successo.");
}

main().catch((err) => {
  console.error("\n❌ Suite Fase 1 fallita:", err.message);
  process.exit(1);
});
