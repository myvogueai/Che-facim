// nominatim-geocoder.js
// Geocoding basato su OpenStreetMap: Photon per autocomplete, Nominatim per civico/reverse.

import {
  parseInputIndirizzo,
  buildQueryRicerca,
  formattaIndirizzoConCivico,
} from "./indirizzo-parser.js?v=9";

const PHOTON_URL = "https://photon.komoot.io/api/";
const NOMINATIM_URL = "https://nominatim.openstreetmap.org";

const CENTRO_BASILICATA = { lat: 40.6404, lng: 15.8056 };

/** @typedef {'offline'|'service'} GeocoderErrorCode */

export class GeocoderError extends Error {
  /** @param {GeocoderErrorCode} code */
  constructor(code) {
    super(GeocoderError.MESSAGGI[code]);
    this.code = code;
    this.name = "GeocoderError";
  }
}

GeocoderError.MESSAGGI = {
  offline: "Connessione assente",
  service: "Servizio di ricerca temporaneamente non disponibile",
};

/** @type {Map<string, RisultatoGeocoding[]>} */
const cacheRicerche = new Map();

/**
 * @param {string} query
 * @param {number} lat
 * @param {number} lng
 * @param {number} limit
 */
function chiaveCache(query, lat, lng, limit) {
  return `${query.toLowerCase()}|${lat.toFixed(2)}|${lng.toFixed(2)}|${limit}`;
}

/**
 * @typedef {Object} RisultatoGeocoding
 * @property {number} lat
 * @property {number} lng
 * @property {string} comune
 * @property {string} indirizzo
 * @property {string} label
 * @property {string} via
 * @property {string|null} [civico]
 * @property {boolean} [haCivico]
 */

function estraiComune(props) {
  return (
    props.city ||
    props.town ||
    props.village ||
    props.municipality ||
    props.county ||
    ""
  );
}

function nomeVia(props) {
  return props.street || props.name || "";
}

function formattaIndirizzo(props, civicoExtra = null) {
  const comune = estraiComune(props);
  const civico = civicoExtra || props.housenumber || null;
  const via = nomeVia(props);
  const viaCompleta = civico ? `${via} ${civico}`.trim() : via;
  const parti = [(viaCompleta || props.name), comune].filter(Boolean);
  return parti.join(", ");
}

function formattaLabel(props, comune) {
  const via = nomeVia(props);
  const civico = props.housenumber || null;
  const viaConCivico = civico ? `${via} ${civico}`.trim() : via;

  if (viaConCivico && comune) {
    return `${viaConCivico} — ${comune}`;
  }
  if (props.name && comune && props.name !== via) {
    return `${props.name} — ${comune}`;
  }
  return viaConCivico || props.name || comune || formattaIndirizzo(props);
}

function parsePhotonFeature(feature) {
  const [lng, lat] = feature.geometry.coordinates;
  const props = feature.properties;
  const comune = estraiComune(props);
  const via = nomeVia(props);
  const civico = props.housenumber || null;
  return {
    lat,
    lng,
    comune,
    via,
    civico,
    haCivico: !!civico,
    indirizzo: formattaIndirizzo(props),
    label: formattaLabel(props, comune),
  };
}

function parseNominatimItem(data) {
  const addr = data.address || {};
  const comune =
    addr.city ||
    addr.town ||
    addr.village ||
    addr.municipality ||
    addr.county ||
    "";
  const via = addr.road || addr.pedestrian || addr.footway || "";
  const civico = addr.house_number || null;
  const indirizzo =
    formattaIndirizzoConCivico(via, civico, comune) ||
    data.display_name ||
    "";
  return {
    lat: parseFloat(data.lat),
    lng: parseFloat(data.lon),
    comune,
    via,
    civico,
    haCivico: !!civico,
    indirizzo,
    label: indirizzo,
  };
}

function parseNominatimReverse(data) {
  return parseNominatimItem(data);
}

/** @param {RisultatoGeocoding[]} risultati */
function deduplicaRisultati(risultati) {
  const visti = new Set();
  return risultati.filter((r) => {
    const key = r.label.toLowerCase().replace(/\s+/g, " ").trim();
    if (visti.has(key)) return false;
    visti.add(key);
    return true;
  });
}

/**
 * @param {string} testo
 * @param {{ limit?: number, lat?: number, lng?: number, comune?: string }} opts
 */
function preparaRicerca(testo, opts = {}) {
  const parsed = parseInputIndirizzo(testo);
  const query = buildQueryRicerca(parsed, opts.comune);
  return { parsed, query };
}

/**
 * @param {string} url
 * @returns {Promise<Response>}
 */
async function fetchGeocoder(url) {
  if (!navigator.onLine) {
    throw new GeocoderError("offline");
  }

  try {
    const res = await fetch(url);
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[geocoder] HTTP", res.status, url, body);
      throw new GeocoderError("service");
    }
    return res;
  } catch (err) {
    if (err instanceof GeocoderError) throw err;
    console.error("[geocoder] fetch fallita:", url, err);
    if (!navigator.onLine) throw new GeocoderError("offline");
    throw new GeocoderError("service");
  }
}

/**
 * @param {string} testo
 * @param {{ limit?: number, lat?: number, lng?: number, comune?: string }} [opts]
 */
export function haRicercaInCache(testo, opts = {}) {
  const { query } = preparaRicerca(testo, opts);
  if (!query || query.length < 3) return false;
  const { limit = 5, lat = CENTRO_BASILICATA.lat, lng = CENTRO_BASILICATA.lng } = opts;
  return cacheRicerche.has(chiaveCache(query, lat, lng, limit));
}

/**
 * Cerca luoghi mentre l'admin digita (autocomplete).
 * Il civico viene rimosso dalla query; il comune (input o campo) viene aggiunto.
 * @param {string} testo
 * @param {{ limit?: number, lat?: number, lng?: number, comune?: string }} [opts]
 * @returns {Promise<RisultatoGeocoding[]>}
 */
export async function cercaLuoghi(testo, opts = {}) {
  const { parsed, query } = preparaRicerca(testo, opts);
  if (!query || query.length < 3) return [];

  const { limit = 5, lat = CENTRO_BASILICATA.lat, lng = CENTRO_BASILICATA.lng } = opts;
  const key = chiaveCache(query, lat, lng, limit);

  if (cacheRicerche.has(key)) {
    return cacheRicerche.get(key);
  }

  const params = new URLSearchParams({
    q: query,
    limit: String(Math.min(limit * 2, 10)),
    lat: String(lat),
    lon: String(lng),
  });

  const url = `${PHOTON_URL}?${params}`;
  const res = await fetchGeocoder(url);
  const data = await res.json();
  const risultati = deduplicaRisultati(
    (data.features || []).map(parsePhotonFeature)
  ).slice(0, limit);

  cacheRicerche.set(key, risultati);
  return risultati;
}

/**
 * Geocoding puntuale con civico (Nominatim). Usato dopo la selezione autocomplete.
 * @param {string} via
 * @param {string} civico
 * @param {string} comune
 * @returns {Promise<RisultatoGeocoding|null>}
 */
export async function geocodeConCivico(via, civico, comune) {
  if (!via || !civico || !comune) return null;

  const q = formattaIndirizzoConCivico(via, civico, comune);
  const params = new URLSearchParams({
    q: `${q}, Italia`,
    format: "json",
    addressdetails: "1",
    limit: "5",
    countrycodes: "it",
  });

  const url = `${NOMINATIM_URL}/search?${params}`;
  const res = await fetchGeocoder(url);
  const items = await res.json();
  if (!Array.isArray(items) || items.length === 0) return null;

  const civicoNorm = civico.toLowerCase();
  const viaNorm = via.toLowerCase();

  for (const item of items) {
    const parsed = parseNominatimItem(item);
    const addr = item.address || {};
    const stessaVia =
      parsed.via.toLowerCase().includes(viaNorm) ||
      viaNorm.includes(parsed.via.toLowerCase());
    const civicoTrovato = (addr.house_number || "").toLowerCase() === civicoNorm;

    if (stessaVia && civicoTrovato) {
      return { ...parsed, haCivico: true };
    }
  }

  for (const item of items) {
    const parsed = parseNominatimItem(item);
    if (parsed.via.toLowerCase().includes(viaNorm)) {
      return { ...parsed, haCivico: false };
    }
  }

  return null;
}

/**
 * Reverse geocoding: da coordinate a indirizzo (es. dopo drag del marker).
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<RisultatoGeocoding>}
 */
export async function reverseGeocode(lat, lng) {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
    format: "json",
    addressdetails: "1",
    "accept-language": "it",
  });

  const url = `${NOMINATIM_URL}/reverse?${params}`;
  const res = await fetchGeocoder(url);
  return parseNominatimReverse(await res.json());
}

export function coordinateValide(lat, lng) {
  const la = Number(lat);
  const lo = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return false;
  if (la < -90 || la > 90 || lo < -180 || lo > 180) return false;
  return !(la === 0 && lo === 0);
}

export { CENTRO_BASILICATA, parseInputIndirizzo, formattaIndirizzoConCivico };
