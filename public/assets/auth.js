// auth.js — inizializzazione Firebase, sessione e operazioni di autenticazione.
// Riferimento: ADR-001 Fase 1

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  deleteUser,
  connectAuthEmulator
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, connectFirestoreEmulator } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export { app };
export const db = getFirestore(app);

const auth = getAuth(app);

if (typeof location !== "undefined") {
  const useEmulator = new URLSearchParams(location.search).get("emulator") === "1";
  if (useEmulator) {
    try {
      connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
      connectFirestoreEmulator(db, "127.0.0.1", 8080);
    } catch {
      // già connesso (ricarica pagina)
    }
  }
}

let authResolved = false;
let currentUser = null;
let authReadyResolve;
const authReadyPromise = new Promise((resolve) => {
  authReadyResolve = resolve;
});

let profileCache = null;
let profileCacheUid = null;
let profileCacheTime = 0;
const PROFILE_TTL_MS = 5 * 60 * 1000;

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  profileCache = null;
  profileCacheUid = null;
  if (!authResolved) {
    authResolved = true;
    authReadyResolve();
  }
});

export function getAuthInstance() {
  return auth;
}

export async function waitForAuth() {
  await authReadyPromise;
  return currentUser;
}

export function getCurrentUser() {
  return currentUser;
}

export async function getUserProfile(forceRefresh = false) {
  const user = currentUser;
  if (!user) return null;

  if (
    !forceRefresh &&
    profileCache &&
    profileCacheUid === user.uid &&
    Date.now() - profileCacheTime < PROFILE_TTL_MS
  ) {
    return profileCache;
  }

  const { getUserProfile: fetchUserProfile } = await import("./users-data.js");
  const profile = await fetchUserProfile(user.uid);
  profileCache = profile;
  profileCacheUid = user.uid;
  profileCacheTime = Date.now();
  return profile;
}

export function clearProfileCache() {
  profileCache = null;
  profileCacheUid = null;
  profileCacheTime = 0;
}

export async function login(email, password) {
  const result = await signInWithEmailAndPassword(auth, email.trim(), password);
  clearProfileCache();
  return result.user;
}

export async function register(email, password, displayName = "") {
  const result = await createUserWithEmailAndPassword(auth, email.trim(), password);
  const user = result.user;

  try {
    const { createUserProfile } = await import("./users-data.js");
    await createUserProfile(user.uid, {
      email: user.email,
      display_name: displayName.trim()
    });
    await sendEmailVerification(user);
  } catch (err) {
    try {
      await deleteUser(user);
    } catch {
      // rollback best-effort
    }
    throw err;
  }

  return user;
}

export async function logout() {
  clearProfileCache();
  await signOut(auth);
}
