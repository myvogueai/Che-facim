#!/usr/bin/env node
/**
 * Test Firestore rules Fase 1 — users e preferiti.
 * Richiede: npx firebase emulators:exec --only firestore --project che-facim
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds
} from "@firebase/rules-unit-testing";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RULES = readFileSync(join(__dirname, "..", "firestore.rules"), "utf8");
const PROJECT = "che-facim";

const results = [];
const pass = (id, msg) => { results.push({ ok: true }); console.log(`  ✅ ${id}: ${msg}`); };
const fail = (id, msg) => { results.push({ ok: false }); console.log(`  ❌ ${id}: ${msg}`); throw new Error(msg); };

async function main() {
  console.log("=== Test Firestore rules Fase 1 ===\n");

  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT,
    firestore: {
      rules: RULES,
      host: "127.0.0.1",
      port: 8080
    }
  });

  const userA = testEnv.authenticatedContext("userA");
  const userB = testEnv.authenticatedContext("userB");
  const admin = testEnv.authenticatedContext("admin", { admin: true });

  const userARef = userA.firestore().collection("users").doc("userA");
  const userBRef = userB.firestore().collection("users").doc("userB");

  // D1 — create role=user
  await assertSucceeds(
    userARef.set({
      uid: "userA",
      email: "a@test.com",
      role: "user",
      email_verified: false,
      status: "active",
      onboarding_completed: false
    })
  );
  pass("D1", "create profilo user consentito");

  // D2 — create role=admin bloccato
  await assertFails(
    userA.firestore().collection("users").doc("hacker").set({
      uid: "hacker",
      email: "h@test.com",
      role: "admin",
      email_verified: false,
      status: "active",
      onboarding_completed: false
    })
  );
  pass("D2", "create role=admin negato");

  // D3 — update role negato
  await assertFails(userARef.update({ role: "admin" }));
  pass("D3", "update role negato al client");

  // D4 — update email_verified negato
  await assertFails(userARef.update({ email_verified: true }));
  pass("D4", "update email_verified negato");

  // D5 — read profilo altrui negato
  await assertFails(userB.firestore().collection("users").doc("userA").get());
  pass("D5", "read profilo altrui negato");

  await assertSucceeds(
    userBRef.set({
      uid: "userB",
      email: "b@test.com",
      role: "user",
      email_verified: false,
      status: "active",
      onboarding_completed: false
    })
  );

  // D6 — preferiti owner
  await assertSucceeds(
    userA.firestore().collection("users").doc("userA").collection("preferiti").doc("ev1").set({
      evento_id: "ev1",
      salvato_il: new Date()
    })
  );
  pass("D6", "write preferiti propri consentito");

  // D7 — preferiti altrui negato
  await assertFails(
    userA.firestore().collection("users").doc("userB").collection("preferiti").doc("ev1").set({
      evento_id: "ev1"
    })
  );
  pass("D7", "write preferiti altrui negato");

  // Admin read profilo altrui
  await assertSucceeds(admin.firestore().collection("users").doc("userB").get());
  pass("SEC-008", "admin legge profilo altrui");

  await testEnv.cleanup();

  console.log(`\n--- Rules: ${results.length}/${results.length} PASS ---`);
}

main().catch((err) => {
  console.error("\nRules test fallito:", err.message);
  process.exit(1);
});
