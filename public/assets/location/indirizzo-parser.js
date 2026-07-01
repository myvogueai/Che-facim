// indirizzo-parser.js
// Estrae via, civico e comune dall'input libero dell'admin.

/**
 * @typedef {Object} InputIndirizzo
 * @property {string} via
 * @property {string|null} civico
 * @property {string|null} comune
 * @property {string} testoOriginale
 */

const RE_CIVICO_FINALE = /\s+(?:n\.?\s*|n°\s*)?(\d+[a-zA-Z]?)\s*$/i;

/**
 * @param {string} testo
 * @returns {InputIndirizzo}
 */
export function parseInputIndirizzo(testo) {
  const originale = (testo || "").trim();
  if (!originale) {
    return { via: "", civico: null, comune: null, testoOriginale: "" };
  }

  let segmentoVia = originale;
  let comune = null;

  const parti = originale.split(",").map((p) => p.trim()).filter(Boolean);
  if (parti.length >= 2) {
    const ultimo = parti[parti.length - 1];
    if (!RE_CIVICO_FINALE.test(ultimo) && ultimo.length >= 2) {
      comune = ultimo;
      segmentoVia = parti.slice(0, -1).join(", ");
    }
  }

  const matchCivico = segmentoVia.match(RE_CIVICO_FINALE);
  let via = segmentoVia;
  let civico = null;

  if (matchCivico) {
    via = segmentoVia.slice(0, matchCivico.index).trim();
    civico = matchCivico[1];
  }

  return { via, civico, comune, testoOriginale: originale };
}

/**
 * Query Photon senza civico; aggiunge il comune se disponibile.
 * @param {InputIndirizzo} parsed
 * @param {string} [comuneExtra]
 */
export function buildQueryRicerca(parsed, comuneExtra) {
  const comune = parsed.comune || comuneExtra || null;
  let query = parsed.via.trim();
  if (comune) query = `${query} ${comune}`.trim();
  return query;
}

/**
 * Indirizzo formattato con civico (per il campo anche se il geocoder non lo risolve).
 * @param {string} via
 * @param {string|null} civico
 * @param {string} comune
 */
export function formattaIndirizzoConCivico(via, civico, comune) {
  const viaCompleta = civico ? `${via} ${civico}`.trim() : via.trim();
  return comune ? `${viaCompleta}, ${comune}` : viaCompleta;
}
