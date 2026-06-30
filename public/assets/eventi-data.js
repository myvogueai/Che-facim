// eventi-data.js
// Modulo condiviso per leggere/scrivere eventi su Firestore.
// Usato sia dalla app pubblica che dal pannello admin.

import { app, db } from "./auth.js";
export { app, db };
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const COLLEZIONE = "eventi";

// Categorie disponibili — usate sia in admin (select) che in UI (colori/icone)
export const CATEGORIE = [
  { id: "musica", label: "Musica live" },
  { id: "sagra", label: "Sagra / Festa paesana" },
  { id: "nightlife", label: "Discoteca / Nightlife" },
  { id: "teatro", label: "Teatro / Cultura" },
  { id: "sport", label: "Sport" },
  { id: "altro", label: "Altro" }
];

export async function creaEvento(dati) {
  const payload = {
    titolo: dati.titolo,
    sottotitolo: dati.sottotitolo || "",
    locale: dati.locale,
    comune: dati.comune,
    lat: Number(dati.lat),
    lng: Number(dati.lng),
    data: Timestamp.fromDate(new Date(dati.dataIso)),
    orario: dati.orario,
    categoria: dati.categoria,
    prezzo: dati.prezzo || "Gratis",
    immagine_url: dati.immagine_url || "",
    descrizione: dati.descrizione || "",
    contatti: dati.contatti || "",
    in_evidenza: !!dati.in_evidenza,
    stato: dati.stato || "pubblicato",
    creato_il: Timestamp.now()
  };
  return addDoc(collection(db, COLLEZIONE), payload);
}

export async function aggiornaEvento(id, dati) {
  const ref = doc(db, COLLEZIONE, id);
  const payload = { ...dati };
  if (dati.dataIso) {
    payload.data = Timestamp.fromDate(new Date(dati.dataIso));
    delete payload.dataIso;
  }
  if (dati.lat) payload.lat = Number(dati.lat);
  if (dati.lng) payload.lng = Number(dati.lng);
  return updateDoc(ref, payload);
}

export async function eliminaEvento(id) {
  return deleteDoc(doc(db, COLLEZIONE, id));
}

export async function getEventiPerGiorno(giorno) {
  const inizio = new Date(giorno);
  inizio.setHours(0, 0, 0, 0);
  const fine = new Date(giorno);
  fine.setHours(23, 59, 59, 999);

  const q = query(
    collection(db, COLLEZIONE),
    where("stato", "==", "pubblicato"),
    where("data", ">=", Timestamp.fromDate(inizio)),
    where("data", "<=", Timestamp.fromDate(fine)),
    orderBy("data", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getTuttiEventiAdmin() {
  const q = query(collection(db, COLLEZIONE), orderBy("data", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
