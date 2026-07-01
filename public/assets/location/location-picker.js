// location-picker.js
// Selettore posizione admin: autocomplete indirizzo + civico + mini mappa Leaflet.

import {
  cercaLuoghi,
  reverseGeocode,
  geocodeConCivico,
  coordinateValide,
  CENTRO_BASILICATA,
  GeocoderError,
  haRicercaInCache,
  parseInputIndirizzo,
  formattaIndirizzoConCivico,
} from "./nominatim-geocoder.js";

const DEBOUNCE_MS = 300;
const DEBOUNCE_CIVICO_MS = 500;
const ZOOM_MARKER = 16;
const ZOOM_DEFAULT = 9;
const MSG_CIVICO_NON_TROVATO =
  "Numero civico non trovato. Puoi spostare il marker manualmente.";

/**
 * @typedef {'vuoto'|'trovato'|'attenzione'} StatoPosizione
 */

export class LocationPicker {
  /**
   * @param {Object} opts
   * @param {HTMLInputElement} opts.localeEl
   * @param {HTMLInputElement} opts.indirizzoEl
   * @param {HTMLInputElement} opts.civicoEl
   * @param {HTMLInputElement} opts.comuneEl
   * @param {HTMLInputElement} opts.latEl
   * @param {HTMLInputElement} opts.lngEl
   * @param {HTMLElement} opts.suggerimentiEl
   * @param {HTMLElement} opts.mappaEl
   * @param {HTMLElement} opts.statoEl
   */
  constructor(opts) {
    this.localeEl = opts.localeEl;
    this.indirizzoEl = opts.indirizzoEl;
    this.civicoEl = opts.civicoEl;
    this.comuneEl = opts.comuneEl;
    this.latEl = opts.latEl;
    this.lngEl = opts.lngEl;
    this.suggerimentiEl = opts.suggerimentiEl;
    this.mappaEl = opts.mappaEl;
    this.statoEl = opts.statoEl;

    /** @type {import('leaflet').Map|null} */
    this.mappa = null;
    /** @type {import('leaflet').Marker|null} */
    this.marker = null;
    this._debounceTimer = null;
    this._debounceCivicoTimer = null;
    this._ricercaInCorso = false;
    this._ricercaId = 0;
    this._posizioneConfermata = false;
    this._indiceAttivo = -1;
    /** @type {import('./indirizzo-parser.js').InputIndirizzo|null} */
    this._ultimoInputParsed = null;
    /** @type {{ lat: number, lng: number }|null} */
    this._coordsVia = null;
    this._viaCorrente = "";
    this._comuneCorrente = "";

    this._setupSpinner();
    this._bindEvents();
    this._bindResize();
    this._aggiornaStato("vuoto");
  }

  _bindResize() {
    const onResize = () => this.invalidateSize();
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
  }

  _setupSpinner() {
    const wrap = document.createElement("div");
    wrap.className = "indirizzo-input-wrap";
    this.indirizzoEl.parentNode.insertBefore(wrap, this.indirizzoEl);
    wrap.appendChild(this.indirizzoEl);

    this.spinnerEl = document.createElement("span");
    this.spinnerEl.className = "indirizzo-spinner";
    this.spinnerEl.hidden = true;
    this.spinnerEl.setAttribute("aria-hidden", "true");
    wrap.appendChild(this.spinnerEl);
  }

  _setSpinner(visible) {
    this.spinnerEl.hidden = !visible;
    this.indirizzoEl.classList.toggle("indirizzo-input--caricamento", visible);
    this.indirizzoEl.setAttribute("aria-busy", visible ? "true" : "false");
  }

  _bindEvents() {
    this.indirizzoEl.addEventListener("input", () => {
      this._posizioneConfermata = false;
      this._coordsVia = null;
      this._viaCorrente = "";
      this._aggiornaStato("attenzione", "Seleziona un suggerimento dall'elenco");
      this._estraiCivicoDaInput();
      this._debounceCerca();
    });

    this.indirizzoEl.addEventListener("keydown", (e) => this._onKeydown(e));

    this.indirizzoEl.addEventListener("blur", () => {
      setTimeout(() => this._nascondiSuggerimenti(), 150);
    });

    this.indirizzoEl.addEventListener("focus", () => {
      if (this.suggerimentiEl.children.length > 0) {
        this.suggerimentiEl.hidden = false;
      }
    });

    this.civicoEl.addEventListener("input", () => {
      this._debounceGeocodingCivico();
    });

    document.addEventListener("click", (e) => {
      if (
        !this.indirizzoEl.contains(e.target) &&
        !this.suggerimentiEl.contains(e.target)
      ) {
        this._nascondiSuggerimenti();
      }
    });
  }

  /** Se l'admin digita il civico nella via, lo sposta nel campo dedicato. */
  _estraiCivicoDaInput() {
    const parsed = parseInputIndirizzo(this.indirizzoEl.value);
    this._ultimoInputParsed = parsed;
    if (parsed.civico && !this.civicoEl.value.trim()) {
      this.civicoEl.value = parsed.civico;
      this.indirizzoEl.value = parsed.comune
        ? `${parsed.via}, ${parsed.comune}`
        : parsed.via;
    }
  }

  _debounceCerca() {
    clearTimeout(this._debounceTimer);
    const testo = this.indirizzoEl.value.trim();
    if (testo.length < 3) {
      this._setSpinner(false);
      this._nascondiSuggerimenti();
      if (!testo) this._aggiornaStato("vuoto");
      return;
    }
    this._debounceTimer = setTimeout(() => this._eseguiRicerca(testo), DEBOUNCE_MS);
  }

  _debounceGeocodingCivico() {
    clearTimeout(this._debounceCivicoTimer);
    if (!this._viaCorrente || !this._coordsVia) return;
    this._debounceCivicoTimer = setTimeout(
      () => this._applicaGeocodingCivico(),
      DEBOUNCE_CIVICO_MS
    );
  }

  async _eseguiRicerca(testo) {
    const id = ++this._ricercaId;
    this._ricercaInCorso = true;

    const lat = Number(this.latEl.value) || CENTRO_BASILICATA.lat;
    const lng = Number(this.lngEl.value) || CENTRO_BASILICATA.lng;
    const comune = this.comuneEl.value.trim() || undefined;
    this._ultimoInputParsed = parseInputIndirizzo(testo);
    const daCache = haRicercaInCache(testo, { lat, lng, comune });

    if (!daCache) {
      this._setSpinner(true);
    }

    try {
      const risultati = await cercaLuoghi(testo, { lat, lng, comune });
      if (id !== this._ricercaId) return;
      this._mostraSuggerimenti(risultati);
    } catch (err) {
      if (id !== this._ricercaId) return;
      const messaggio =
        err instanceof GeocoderError
          ? err.message
          : GeocoderError.MESSAGGI.service;
      console.error("[location-picker] ricerca fallita:", testo, err);
      this.suggerimentiEl.innerHTML =
        `<li class="suggerimento-item suggerimento-item--vuoto">${this._escapeHtml(messaggio)}</li>`;
      this.suggerimentiEl.hidden = false;
      this._aggiornaStato("attenzione", messaggio);
    } finally {
      if (id === this._ricercaId) {
        this._ricercaInCorso = false;
        this._setSpinner(false);
      }
    }
  }

  _mostraSuggerimenti(risultati) {
    this._indiceAttivo = -1;
    if (risultati.length === 0) {
      this.suggerimentiEl.innerHTML =
        '<li class="suggerimento-item suggerimento-item--vuoto">Nessun indirizzo trovato</li>';
      this.suggerimentiEl.hidden = false;
      this._aggiornaStato("attenzione", "Nessun indirizzo trovato");
      return;
    }

    this.suggerimentiEl.innerHTML = risultati
      .map(
        (r, i) =>
          `<li class="suggerimento-item" role="option" data-index="${i}">${this._escapeHtml(r.label)}</li>`
      )
      .join("");

    this._risultatiCorrenti = risultati;
    this.suggerimentiEl.hidden = false;

    this.suggerimentiEl.querySelectorAll(".suggerimento-item[data-index]").forEach((li) => {
      li.addEventListener("mousedown", (e) => {
        e.preventDefault();
        const idx = Number(li.dataset.index);
        this._selezionaRisultato(this._risultatiCorrenti[idx]);
      });
    });
  }

  _onKeydown(e) {
    const items = this.suggerimentiEl.querySelectorAll(
      ".suggerimento-item[data-index]"
    );
    if (items.length === 0 || this.suggerimentiEl.hidden) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      this._indiceAttivo = Math.min(this._indiceAttivo + 1, items.length - 1);
      this._evidenziaSuggerimento(items);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      this._indiceAttivo = Math.max(this._indiceAttivo - 1, 0);
      this._evidenziaSuggerimento(items);
    } else if (e.key === "Enter" && this._indiceAttivo >= 0) {
      e.preventDefault();
      this._selezionaRisultato(this._risultatiCorrenti[this._indiceAttivo]);
    } else if (e.key === "Escape") {
      this._nascondiSuggerimenti();
    }
  }

  _evidenziaSuggerimento(items) {
    items.forEach((li, i) => {
      li.classList.toggle("suggerimento-item--attivo", i === this._indiceAttivo);
    });
    items[this._indiceAttivo]?.scrollIntoView({ block: "nearest" });
  }

  _nascondiSuggerimenti() {
    this.suggerimentiEl.hidden = true;
    this._indiceAttivo = -1;
  }

  /**
   * Applica un risultato di geocoding ai campi e alla mappa.
   * @param {import('./nominatim-geocoder.js').RisultatoGeocoding} risultato
   */
  async _selezionaRisultato(risultato) {
    this._nascondiSuggerimenti();

    const parsed =
      this._ultimoInputParsed || parseInputIndirizzo(this.indirizzoEl.value);
    const comune = risultato.comune || parsed.comune || this.comuneEl.value.trim();
    const via = risultato.via || parsed.via;

    if (parsed.civico && !this.civicoEl.value.trim()) {
      this.civicoEl.value = parsed.civico;
    }

    this._viaCorrente = via;
    this._comuneCorrente = comune;
    this._coordsVia = { lat: risultato.lat, lng: risultato.lng };

    this.indirizzoEl.value = via;
    if (comune) {
      this.comuneEl.value = comune;
    }

    this._posizioneConfermata = true;
    this._inizializzaMappa();
    this._impostaCoordinate(risultato.lat, risultato.lng);
    this._posizionaMarker(risultato.lat, risultato.lng, true);

    await this._applicaGeocodingCivico();
  }

  /**
   * Prova geocoding Via + civico + comune. Il marker trascinabile resta fonte di verità.
   */
  async _applicaGeocodingCivico() {
    if (!this._coordsVia || !this._viaCorrente) return;

    const civico = this.civicoEl.value.trim();
    const { lat: latVia, lng: lngVia } = this._coordsVia;
    const comune = this._comuneCorrente || this.comuneEl.value.trim();

    if (!civico) {
      this._impostaCoordinate(latVia, lngVia);
      this._posizionaMarker(latVia, lngVia, false);
      this._aggiornaStato("trovato");
      return;
    }

    try {
      const preciso = await geocodeConCivico(this._viaCorrente, civico, comune);
      if (preciso?.haCivico) {
        this._impostaCoordinate(preciso.lat, preciso.lng);
        this._posizionaMarker(preciso.lat, preciso.lng, true);
        this._aggiornaStato("trovato");
        return;
      }
    } catch (err) {
      console.warn("[location-picker] geocoding civico non riuscito:", err);
    }

    this._impostaCoordinate(latVia, lngVia);
    this._posizionaMarker(latVia, lngVia, false);
    this._aggiornaStato("attenzione", MSG_CIVICO_NON_TROVATO);
  }

  _impostaCoordinate(lat, lng) {
    this.latEl.value = String(lat);
    this.lngEl.value = String(lng);
  }

  _inizializzaMappa() {
    if (this.mappa) return;

    this.mappa = L.map(this.mappaEl, {
      zoomControl: true,
      attributionControl: true,
    }).setView([CENTRO_BASILICATA.lat, CENTRO_BASILICATA.lng], ZOOM_DEFAULT);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(this.mappa);

    requestAnimationFrame(() => {
      this.mappa?.invalidateSize();
      requestAnimationFrame(() => this.mappa?.invalidateSize());
    });
  }

  _posizionaMarker(lat, lng, centra = false) {
    if (!this.mappa) return;

    if (this.marker) {
      this.marker.setLatLng([lat, lng]);
    } else {
      this.marker = L.marker([lat, lng], { draggable: true }).addTo(this.mappa);
      this.marker.on("dragend", () => this._onMarkerDrag());
    }

    if (centra) {
      this.mappa.setView([lat, lng], ZOOM_MARKER);
    }
  }

  async _onMarkerDrag() {
    if (!this.marker) return;
    const { lat, lng } = this.marker.getLatLng();
    this._impostaCoordinate(lat, lng);
    this._posizioneConfermata = true;
    this._aggiornaStato("trovato");

    const civico = this.civicoEl.value.trim();
    try {
      const risultato = await reverseGeocode(lat, lng);
      if (risultato.comune) {
        this.comuneEl.value = risultato.comune;
        this._comuneCorrente = risultato.comune;
      }
      if (risultato.via) {
        this.indirizzoEl.value = risultato.via;
        this._viaCorrente = risultato.via;
      }
      if (risultato.civico && !civico) {
        this.civicoEl.value = risultato.civico;
      }
    } catch {
      // Coordinate dal marker — fonte di verità
    }
  }

  /**
   * @param {StatoPosizione} stato
   * @param {string} [messaggioCustom]
   */
  _aggiornaStato(stato, messaggioCustom) {
    const messaggi = {
      vuoto: "Inserisci un indirizzo per trovare la posizione",
      trovato: "Posizione trovata",
      attenzione: messaggioCustom || "Controlla la posizione",
    };

    this.statoEl.className = `posizione-stato posizione-stato--${stato}`;
    const icona = stato === "trovato" ? "✓" : "⚠️";
    this.statoEl.innerHTML = `<span class="posizione-stato-icona">${icona}</span> ${messaggi[stato]}`;
  }

  /**
   * @param {{ lat?: number, lng?: number, comune?: string, indirizzo?: string, civico?: string, locale?: string }} dati
   */
  caricaPosizione(dati) {
    if (dati.locale) this.localeEl.value = dati.locale;
    if (dati.comune) {
      this.comuneEl.value = dati.comune;
      this._comuneCorrente = dati.comune;
    }

    const parsed = parseInputIndirizzo(dati.indirizzo || "");
    this.civicoEl.value = dati.civico || parsed.civico || "";
    this.indirizzoEl.value = parsed.via || dati.indirizzo || "";
    this._viaCorrente = parsed.via || this.indirizzoEl.value;

    if (coordinateValide(dati.lat, dati.lng)) {
      this._impostaCoordinate(dati.lat, dati.lng);
      this._coordsVia = { lat: Number(dati.lat), lng: Number(dati.lng) };
      this._posizioneConfermata = true;
      this._inizializzaMappa();
      this._posizionaMarker(Number(dati.lat), Number(dati.lng), true);
      this._aggiornaStato("trovato");
    } else if (dati.indirizzo || dati.comune) {
      this._aggiornaStato("attenzione", "Posizione non valida — cerca di nuovo l'indirizzo");
    } else {
      this.reset();
    }
  }

  reset() {
    clearTimeout(this._debounceTimer);
    clearTimeout(this._debounceCivicoTimer);
    this._ricercaId++;
    this._setSpinner(false);
    this._nascondiSuggerimenti();
    this.latEl.value = "";
    this.lngEl.value = "";
    this._posizioneConfermata = false;
    this._ultimoInputParsed = null;
    this._coordsVia = null;
    this._viaCorrente = "";
    this._comuneCorrente = "";

    if (this.marker && this.mappa) {
      this.mappa.removeLayer(this.marker);
      this.marker = null;
    }
    if (this.mappa) {
      this.mappa.setView([CENTRO_BASILICATA.lat, CENTRO_BASILICATA.lng], ZOOM_DEFAULT);
    }

    this._aggiornaStato("vuoto");
  }

  /**
   * @returns {{ valido: boolean, messaggio?: string }}
   */
  valida() {
    const lat = this.latEl.value;
    const lng = this.lngEl.value;

    if (!this.indirizzoEl.value.trim()) {
      return { valido: false, messaggio: "Inserisci la via o l'indirizzo del locale." };
    }
    if (!this.comuneEl.value.trim()) {
      return { valido: false, messaggio: "Il comune è obbligatorio. Seleziona un suggerimento." };
    }
    if (!coordinateValide(lat, lng)) {
      return {
        valido: false,
        messaggio: "Posizione non valida. Cerca l'indirizzo e seleziona un suggerimento.",
      };
    }
    if (!this.marker) {
      return {
        valido: false,
        messaggio: "Il marker non è presente sulla mappa. Seleziona un indirizzo dai suggerimenti.",
      };
    }
    return { valido: true };
  }

  getDati() {
    const via = this.indirizzoEl.value.trim();
    const civico = this.civicoEl.value.trim();
    const comune = this.comuneEl.value.trim();
    return {
      locale: this.localeEl.value.trim(),
      indirizzo: formattaIndirizzoConCivico(via, civico || null, comune),
      civico,
      comune,
      lat: Number(this.latEl.value),
      lng: Number(this.lngEl.value),
    };
  }

  _escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  invalidateSize() {
    if (this.mappa) {
      requestAnimationFrame(() => this.mappa.invalidateSize());
    }
  }
}
