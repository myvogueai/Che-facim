#!/usr/bin/env node
/**
 * Test E2E browser Fase 1 — richiede hosting locale e rete verso Firebase.
 * Uso: node scripts/test-fase1-e2e.js [baseUrl]
 */

import puppeteer from "puppeteer";

const BASE = process.argv[2] || "http://127.0.0.1:5050";
const EMU = process.env.FIREBASE_EMULATOR === "1" ? "?emulator=1" : "?emulator=1";
const AUTH_EMU = "http://127.0.0.1:9099";
const PROJECT = "che-facim";
const TEST_EMAIL = `fase1-${Date.now()}@test.chefacim.it`;
const TEST_PASSWORD = "TestCheFacim2026!";

const NAV_OPTS = { waitUntil: "domcontentloaded", timeout: 30000 };

const results = [];

function pass(id, msg) {
  results.push({ id, ok: true, msg });
  console.log(`  ✅ ${id}: ${msg}`);
}

function fail(id, msg) {
  results.push({ id, ok: false, msg });
  console.log(`  ❌ ${id}: ${msg}`);
}

async function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function verifyEmailInEmulator(email) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const res = await fetch(
      `${AUTH_EMU}/emulator/v1/projects/${PROJECT}/oobCodes`
    );
    const data = await res.json();
    const entry = data.oobCodes?.find(
      (c) => c.email === email && c.requestType === "VERIFY_EMAIL"
    );
    if (entry?.oobLink) {
      const verifyRes = await fetch(entry.oobLink);
      const result = await verifyRes.json();
      if (result?.authEmulator?.success) return entry.oobCode;
    }
    await wait(500);
  }
  throw new Error(`Codice verifica emulator non trovato per: ${email}`);
}

async function main() {
  console.log("=== Test E2E Fase 1 (browser + Firebase) ===");
  console.log(`Base URL: ${BASE}`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(20000);

    // A4 — password non coincidenti
    await page.goto(`${BASE}/auth/register.html${EMU}`, NAV_OPTS);
    await page.waitForSelector("#auth-contenuto:not([hidden])");
    await page.type("#email", "test@example.com");
    await page.type("#password", TEST_PASSWORD);
    await page.type("#password_confirm", "AltraPassword123!");
    await page.click("#bottone-register");
    await page.waitForFunction(
      () => document.getElementById("register-errore")?.classList.contains("visibile")
    );
    const errA4 = await page.$eval("#register-errore", (el) => el.textContent);
    if (errA4.includes("non coincidono")) pass("A4", "Password non coincidenti bloccate");
    else fail("A4", `Messaggio inatteso: ${errA4}`);

    // B1 — credenziali errate
    await page.goto(`${BASE}/auth/login.html${EMU}`, NAV_OPTS);
    await page.waitForSelector("#auth-contenuto:not([hidden])");
    await page.type("#email", "inesistente@test.chefacim.it");
    await page.type("#password", "PasswordSbagliata99!");
    await page.click("#bottone-login");
    await page.waitForFunction(
      () => document.getElementById("login-errore")?.classList.contains("visibile")
    );
    const errB1 = await page.$eval("#login-errore", (el) => el.textContent);
    if (errB1.includes("non corrette")) pass("B1", "Credenziali errate → messaggio generico");
    else fail("B1", `Messaggio inatteso: ${errB1}`);

    // C1 — splash presente all'avvio
    await page.goto(`${BASE}/auth/login.html${EMU}`, { waitUntil: "domcontentloaded" });
    const hadSplash = await page.evaluate(() => !!document.getElementById("auth-splash"));
    if (hadSplash) pass("C1", "Splash auth presente al caricamento");
    else fail("C1", "Splash auth assente");

    // A1/A2/A3/A10 — registrazione happy path
    await page.goto(`${BASE}/auth/register.html${EMU}`, NAV_OPTS);
    await page.waitForSelector("#auth-contenuto:not([hidden])");
    await page.type("#display_name", "Test Fase1");
    await page.type("#email", TEST_EMAIL);
    await page.type("#password", TEST_PASSWORD);
    await page.type("#password_confirm", TEST_PASSWORD);

    await page.click("#bottone-register");
    await page.waitForFunction(
      () => location.href.includes("/auth/login.html") && location.href.includes("registered=1"),
      { timeout: 30000 }
    );

    const afterRegisterUrl = page.url();
    if (afterRegisterUrl.includes("/auth/login.html") && afterRegisterUrl.includes("registered=1")) {
      pass("A1", `Redirect post-registrazione OK (${afterRegisterUrl})`);
    } else {
      fail("A1", `URL inatteso dopo registrazione: ${afterRegisterUrl}`);
    }

    await page.waitForFunction(
      () => !document.getElementById("banner-registrato")?.hidden,
      { timeout: 10000 }
    );
    const bannerVisible = await page.evaluate(() => !document.getElementById("banner-registrato")?.hidden);
    if (bannerVisible) pass("A10", "Banner post-registrazione visibile su login");
    else fail("A10", "Banner post-registrazione non visibile");

    // B3 — login utente non verificato
    await page.goto(`${BASE}/auth/login.html${EMU}&registered=1`, NAV_OPTS);
    await page.waitForSelector("#auth-contenuto:not([hidden])");
    await page.$eval("#email", (el) => { el.value = ""; });
    await page.$eval("#password", (el) => { el.value = ""; });
    await page.type("#email", TEST_EMAIL);
    await page.type("#password", TEST_PASSWORD);
    await page.click("#bottone-login");
    await page.waitForFunction(
      () => document.getElementById("login-errore")?.classList.contains("visibile")
    );
    const errB3 = await page.$eval("#login-errore", (el) => el.textContent);
    if (errB3.toLowerCase().includes("verifica")) {
      pass("B3", "Utente non verificato bloccato al login");
    } else {
      fail("B3", `Messaggio inatteso: ${errB3}`);
    }

    const stillOnLogin = page.url().includes("/auth/login.html");
    if (stillOnLogin) pass("REG-004", "Nessun redirect a home senza verifica email");
    else fail("REG-004", `Redirect inatteso: ${page.url()}`);

    // B10 — link registrati (prima del login verificato, utente non autenticato)
    await page.goto(`${BASE}/auth/login.html${EMU}`, NAV_OPTS);
    await page.waitForSelector("#auth-contenuto:not([hidden])");
    await page.waitForSelector('a[href="register.html"]');
    await Promise.all([
      page.waitForNavigation(NAV_OPTS),
      page.click('a[href="register.html"]')
    ]);
    if (page.url().includes("/auth/register.html")) pass("B10", "Link Registrati funzionante");
    else fail("B10", `Navigazione fallita: ${page.url()}`);

    // B4 — login utente verificato → home
    await verifyEmailInEmulator(TEST_EMAIL);
    await page.goto(`${BASE}/auth/login.html${EMU}`, NAV_OPTS);
    await page.waitForSelector("#auth-contenuto:not([hidden])");
    await page.$eval("#email", (el) => { el.value = ""; });
    await page.$eval("#password", (el) => { el.value = ""; });
    await page.type("#email", TEST_EMAIL);
    await page.type("#password", TEST_PASSWORD);
    await page.click("#bottone-login");
    await page.waitForFunction(
      () => location.pathname.endsWith("/index.html") || location.pathname === "/",
      { timeout: 30000 }
    );
    if (page.url().includes("index.html") || page.url().endsWith("/")) {
      pass("B4", "Login utente verificato → home");
    } else {
      fail("B4", `Redirect inatteso: ${page.url()}`);
    }

    // E1 — home pubblica senza login
    const ctx = await browser.createBrowserContext();
    const incognito = await ctx.newPage();
    await incognito.goto(`${BASE}/index.html`, NAV_OPTS);
    const homeOk = await incognito.evaluate(() => !!document.getElementById("lista-eventi"));
    if (homeOk) pass("E1", "Home accessibile senza login (Fase 2 non attiva)");
    else fail("E1", "Home non caricata");
    await ctx.close();

    // A6 — email già registrata
    await page.goto(`${BASE}/auth/register.html${EMU}`, NAV_OPTS);
    await page.waitForSelector("#auth-contenuto:not([hidden])");
    await page.type("#email", TEST_EMAIL);
    await page.type("#password", TEST_PASSWORD);
    await page.type("#password_confirm", TEST_PASSWORD);
    await page.click("#bottone-register");
    await page.waitForFunction(
      () => document.getElementById("register-errore")?.classList.contains("visibile")
    );
    const errA6 = await page.$eval("#register-errore", (el) => el.textContent);
    if (errA6.toLowerCase().includes("già registrata")) {
      pass("A6", "Email duplicata → messaggio specifico");
    } else {
      fail("A6", `Messaggio inatteso: ${errA6}`);
    }

    console.log(`\nEmail di test creata: ${TEST_EMAIL}`);
  } finally {
    await browser.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n--- E2E: ${results.length - failed.length}/${results.length} PASS ---`);
  if (failed.length) {
    failed.forEach((f) => console.log(`  - ${f.id}: ${f.msg}`));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Errore E2E:", err);
  process.exit(1);
});
