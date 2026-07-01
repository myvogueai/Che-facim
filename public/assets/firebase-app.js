// firebase-app.js — singleton Firebase App condiviso da Auth, Firestore e Storage.

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { firebaseConfig } from "./firebase-config.js";

export const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export { firebaseConfig };
