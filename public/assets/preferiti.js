// preferiti.js
// Gestione preferiti lato client con localStorage.
// Nessun login richiesto per l'MVP — se in futuro si aggiunge
// autenticazione utenti, questo modulo si sostituisce con una
// collezione Firestore "preferiti_utente/{uid}".

const CHIAVE = 'lucania_tonight_preferiti';

function leggiTutti() {
  try {
    return JSON.parse(localStorage.getItem(CHIAVE)) || {};
  } catch {
    return {};
  }
}

function scriviTutti(obj) {
  localStorage.setItem(CHIAVE, JSON.stringify(obj));
}

export function ePreferito(id) {
  const tutti = leggiTutti();
  return !!tutti[id];
}

export function aggiungiPreferito(id, datiEvento) {
  const tutti = leggiTutti();
  tutti[id] = { ...datiEvento, salvato_il: Date.now() };
  scriviTutti(tutti);
}

export function rimuoviPreferito(id) {
  const tutti = leggiTutti();
  delete tutti[id];
  scriviTutti(tutti);
}

export function getPreferiti() {
  const tutti = leggiTutti();
  return Object.entries(tutti).map(([id, dati]) => ({ id, ...dati }));
}
