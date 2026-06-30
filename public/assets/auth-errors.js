// auth-errors.js — messaggi utente per errori Auth/Firestore.
// Riferimento: ADR-001 Fase 1

const REGISTER_MESSAGES = {
  "auth/email-already-in-use":
    "Questa email è già registrata. Accedi oppure reimposta la password.",
  "auth/invalid-email": "L'indirizzo email non è valido.",
  "auth/weak-password": "La password è troppo debole.",
  "auth/too-many-requests": "Troppi tentativi. Riprova più tardi.",
  "auth/network-request-failed": "Connessione assente. Controlla Internet e riprova.",
  "permission-denied":
    "Impossibile salvare il profilo utente. Riprova più tardi.",
  unavailable: "Connessione assente. Controlla Internet e riprova.",
  "deadline-exceeded": "Connessione assente. Controlla Internet e riprova."
};

const UNEXPECTED_REGISTER =
  "Si è verificato un errore imprevisto. Riprova più tardi.";

export function getRegisterErrorMessage(err) {
  const code = err?.code || "";
  if (REGISTER_MESSAGES[code]) {
    return REGISTER_MESSAGES[code];
  }

  if (typeof console !== "undefined") {
    console.error("[auth] Errore registrazione:", code || err);
  }

  return UNEXPECTED_REGISTER;
}
