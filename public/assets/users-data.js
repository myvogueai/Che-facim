// users-data.js — profilo utente su Firestore (collection users).
// Riferimento: ADR-001 Fase 1

import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "./auth.js";

const COLLEZIONE = "users";

export async function createUserProfile(uid, { email, display_name = "" }) {
  const ref = doc(db, COLLEZIONE, uid);
  await setDoc(ref, {
    uid,
    email: (email || "").toLowerCase(),
    display_name: display_name || "",
    role: "user",
    email_verified: false,
    status: "active",
    onboarding_completed: false,
    preferences: {},
    created_at: serverTimestamp(),
    updated_at: serverTimestamp()
  });
}

export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, COLLEZIONE, uid));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function ensureUserProfile(user) {
  let profile = await getUserProfile(user.uid);
  if (profile) return profile;

  await createUserProfile(user.uid, { email: user.email });
  return getUserProfile(user.uid);
}

export async function updateLastLogin(uid) {
  await updateDoc(doc(db, COLLEZIONE, uid), {
    last_login_at: serverTimestamp(),
    updated_at: serverTimestamp()
  });
}
