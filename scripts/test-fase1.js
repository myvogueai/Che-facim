#!/usr/bin/env node
/**
 * Test Fase 1 — ADR-001
 * Esegue verifiche statiche e smoke test HTTP su hosting locale.
 * Uso: node scripts/test-fase1.js [baseUrl]
 */

import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const BASE = process.argv[2] || "http://127.0.0.1:5050";

const results = [];

function pass(id, msg) {
  results.push({ id, ok: true, msg });
  console.log(`  ✅ ${id}: ${msg}`);
}

function fail(id, msg) {
  results.push({ id, ok: false, msg });
  console.log(`  ❌ ${id}: ${msg}`);
}

async function fetchOk(url, label) {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      fail(label, `HTTP ${res.status} per ${url}`);
      return null;
    }
    return await res.text();
  } catch (err) {
    fail(label, `${url} — ${err.message}`);
    return null;
  }
}

function staticTests() {
  console.log("\n📁 Verifiche statiche\n");

  const required = [
    "public/assets/auth.js",
    "public/assets/users-data.js",
    "public/assets/router.js",
    "public/assets/eventi-data.js",
    "public/auth/login.html",
    "public/auth/register.html",
    "firestore.rules"
  ];

  for (const f of required) {
    const p = join(ROOT, f);
    if (existsSync(p)) pass(`STATIC-${f}`, "presente");
    else fail(`STATIC-${f}`, "mancante");
  }

  const eventiData = readFileSync(join(ROOT, "public/assets/eventi-data.js"), "utf8");
  if (eventiData.includes("collection,") && eventiData.includes("collection(db")) {
    pass("STATIC-collection-import", "collection importato in eventi-data.js");
  } else {
    fail("STATIC-collection-import", "collection mancante in eventi-data.js");
  }

  if (eventiData.includes('from "./auth.js"')) {
    pass("STATIC-eventi-auth-delegate", "eventi-data delega init a auth.js");
  } else {
    fail("STATIC-eventi-auth-delegate", "eventi-data non importa auth.js");
  }

  const authJs = readFileSync(join(ROOT, "public/assets/auth.js"), "utf8");
  for (const fn of ["waitForAuth", "login", "register", "logout", "getUserProfile"]) {
    if (authJs.includes(`export async function ${fn}`) || authJs.includes(`export function ${fn}`)) {
      pass(`STATIC-auth-${fn}`, "esportato");
    } else {
      fail(`STATIC-auth-${fn}`, "mancante");
    }
  }

  const routerJs = readFileSync(join(ROOT, "public/assets/router.js"), "utf8");
  if (routerJs.includes('type: "auth-only"') && routerJs.includes("export async function guard")) {
    pass("STATIC-router-guard", "guard auth-only presente");
  } else {
    fail("STATIC-router-guard", "guard incompleto");
  }

  const rules = readFileSync(join(ROOT, "firestore.rules"), "utf8");
  if (rules.includes("match /users/{uid}") && rules.includes("match /users/{uid}/preferiti")) {
    pass("STATIC-rules-users", "rules users e preferiti");
  } else {
    fail("STATIC-rules-users", "rules users mancanti");
  }

  const loginHtml = readFileSync(join(ROOT, "public/auth/login.html"), "utf8");
  if (loginHtml.includes("auth-splash") && loginHtml.includes("guard(getPageConfig())")) {
    pass("STATIC-login-splash-guard", "splash e guard su login");
  } else {
    fail("STATIC-login-splash-guard", "login incompleto");
  }

  const registerHtml = readFileSync(join(ROOT, "public/auth/register.html"), "utf8");
  if (registerHtml.includes("password_confirm") && registerHtml.includes("Le password non coincidono")) {
    pass("STATIC-register-confirm", "validazione conferma password");
  } else {
    fail("STATIC-register-confirm", "register senza validazione password");
  }
}

async function httpTests() {
  console.log("\n🌐 Smoke test HTTP\n");

  const login = await fetchOk(`${BASE}/auth/login.html`, "HTTP-login");
  if (login) {
    if (login.includes("auth-splash") && login.includes("form-login")) pass("HTTP-login-content", "markup login OK");
    else fail("HTTP-login-content", "markup login incompleto");
  }

  const register = await fetchOk(`${BASE}/auth/register.html`, "HTTP-register");
  if (register) {
    if (register.includes("form-register") && register.includes("Registrati")) pass("HTTP-register-content", "markup register OK");
    else fail("HTTP-register-content", "markup register incompleto");
  }

  const index = await fetchOk(`${BASE}/index.html`, "HTTP-index");
  if (index) {
    if (index.includes("lista-eventi") && index.includes("eventi-data.js")) pass("E1-home", "home pubblica caricabile (non regressione)");
    else fail("E1-home", "home incompleta");
  }

  const admin = await fetchOk(`${BASE}/admin/index.html`, "HTTP-admin");
  if (admin) {
    if (admin.includes("vista-login") && admin.includes("form-login")) pass("E2-admin-legacy", "admin legacy con login inline");
    else fail("E2-admin-legacy", "admin non trovato");
  }

  for (const asset of ["auth.js", "users-data.js", "router.js", "eventi-data.js"]) {
    const js = await fetchOk(`${BASE}/assets/${asset}`, `HTTP-asset-${asset}`);
    if (js && js.length > 50) pass(`HTTP-asset-${asset}`, "servito correttamente");
  }

  const eventiJs = await fetchOk(`${BASE}/assets/eventi-data.js`, "HTTP-eventi-js-check");
  if (eventiJs && eventiJs.includes("import { app, db }") && eventiJs.includes("collection,")) {
    pass("E4-eventi-data", "eventi-data.js servito con collection import");
  } else if (eventiJs) {
    fail("E4-eventi-data", "eventi-data.js servito ma contenuto inatteso");
  }
}

async function main() {
  console.log("=== Test Fase 1 ADR-001 ===");
  console.log(`Base URL: ${BASE}`);

  staticTests();
  await httpTests();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n--- Risultato: ${results.length - failed.length}/${results.length} PASS ---`);
  if (failed.length) {
    console.log("\nFalliti:");
    failed.forEach((f) => console.log(`  - ${f.id}: ${f.msg}`));
    process.exit(1);
  }
  console.log("\nTutti i test automatici Fase 1 sono PASS.");
}

main();
