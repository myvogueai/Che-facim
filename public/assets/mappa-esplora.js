// mappa-esplora.js
// Mappa + lista home + carosello modal sincronizzati (marker ↔ card).

import { CATEGORIE } from "./eventi-data.js";

const CENTRO_POTENZA = [40.6404, 15.8056];
const ZOOM_DEFAULT = 10;
const SOGLIA_DRAG_CAROSELLO = 8;

const ICONE_CATEGORIA = {
  musica: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
  sagra: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3l2.5 7.5H22l-6 4.5 2.5 7.5L12 18l-6.5 4.5 2.5-7.5-6-4.5h7.5z"/></svg>',
  nightlife: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>',
  teatro: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 19h16M6 15v4M18 15v4M8 11h8l2 8H6l2-8zM12 3l3 8H9l3-8z"/></svg>',
  sport: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18M3 12h18"/></svg>',
  altro: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="5" width="16" height="14" rx="2"/><path d="M8 9h8M8 13h5"/></svg>',
};

/**
 * @param {boolean} selezionato
 */
function iconaMarker(selezionato) {
  return L.divIcon({
    className: "marker-esplora-icon",
    html: `<div class="pin-mappa${selezionato ? " selezionato" : ""}"></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

export class MappaEsplora {
  /**
   * @param {Object} opts
   * @param {HTMLElement} opts.mappaEl
   * @param {HTMLElement} opts.listaEl
   * @param {HTMLButtonElement} opts.cercaZonaBtn
   * @param {HTMLElement} [opts.mappaModalEl]
   * @param {HTMLElement} [opts.caroselloEl]
   * @param {Array<{id: string, label: string}>} [opts.categorie]
   * @param {(ev: object) => string} [opts.formattaOrario]
   * @param {(stats: { carosello: number, mappa: number, totaliGiorno: number }) => void} [opts.onConteggio]
   * @param {() => void} [opts.onRimuoviFiltroCategoria]
   */
  constructor(opts) {
    this.mappaEl = opts.mappaEl;
    this.mappaModalEl = opts.mappaModalEl || null;
    this.listaEl = opts.listaEl;
    this.caroselloEl = opts.caroselloEl || null;
    this.cercaZonaBtn = opts.cercaZonaBtn;
    this.onConteggio = opts.onConteggio || (() => {});
    this.onRimuoviFiltroCategoria = opts.onRimuoviFiltroCategoria || (() => {});

    this._categorie = opts.categorie || CATEGORIE;
    this._labelCategoria = Object.fromEntries(
      this._categorie.map((c) => [c.id, c.label])
    );

    /** @type {import('leaflet').Map|null} */
    this.mappa = null;
    /** @type {import('leaflet').Map|null} */
    this.mappaModal = null;
    /** @type {Map<string, { marker: import('leaflet').Marker, markerModal: import('leaflet').Marker|null, evento: object }>} */
    this._markers = new Map();

    this._eventiGiornoRaw = [];
    this._eventiGiorno = [];
    this._eventiVisibili = [];
    this._categoriaFiltro = null;
    this._idSelezionato = null;
    this._zonaConfermata = false;
    this._mappaSpostata = false;
    this._muoviProgrammatico = false;
    this._modalAperta = false;
    this._scrollSyncLock = false;
    this._scrollEndTimer = null;
    this._scrollUnlockTimer = null;
    this._scrollRaf = 0;
    this._ultimoPanId = null;
    this._caroselloDirty = false;
    this._hasScrollEnd = "onscrollend" in window;
    this._caroselloPointer = { moved: false };
    this._caroselloDrag = {
      active: false,
      pointerId: null,
      startX: 0,
      startScrollLeft: 0,
      moved: false,
      isMouse: false,
    };

    this._formattaOrario = opts.formattaOrario || ((ev) => ev.orario || "");
  }

  init() {
    if (this.mappa) return;

    this.mappa = L.map(this.mappaEl, {
      zoomControl: false,
      attributionControl: true,
      dragging: true,
      scrollWheelZoom: false,
    }).setView(CENTRO_POTENZA, ZOOM_DEFAULT);

    L.control.zoom({ position: "topright" }).addTo(this.mappa);

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: "© OpenStreetMap, © CARTO",
      maxZoom: 19,
    }).addTo(this.mappa);

    this.mappa.on("movestart", () => {
      if (this._muoviProgrammatico || this._eventiGiorno.length === 0) return;
      this._mappaSpostata = true;
    });

    this.mappa.on("moveend", () => {
      if (this._muoviProgrammatico) {
        this._muoviProgrammatico = false;
        return;
      }
      if (!this._modalAperta && this._mappaSpostata && !this._zonaConfermata) {
        this.cercaZonaBtn.hidden = false;
      }
    });

    this.cercaZonaBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.confermaZona();
    });

    this.listaEl.addEventListener("click", (e) => {
      const card = e.target.closest(".evento-card-h");
      if (!card || card.closest(".carosello-eventi")) return;
      this.seleziona(card.dataset.id, { centraMappa: true, scrollLista: false });
    });

    if (this.caroselloEl) {
      this._bindCaroselloInterazioni();
    }

    requestAnimationFrame(() => {
      this.mappa?.invalidateSize();
      requestAnimationFrame(() => this.mappa?.invalidateSize());
    });
  }

  _bindCaroselloInterazioni() {
    const el = this.caroselloEl;
    if (!el) return;

    el.addEventListener("scroll", () => this._onCaroselloScroll(), { passive: true });

    if (this._hasScrollEnd) {
      el.addEventListener("scrollend", () => this._onCaroselloScrollEnd(), { passive: true });
    }

    el.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;

      this._caroselloDrag = {
        active: true,
        pointerId: e.pointerId,
        startX: e.clientX,
        startScrollLeft: el.scrollLeft,
        moved: false,
        isMouse: e.pointerType === "mouse",
      };

      if (this._caroselloDrag.isMouse) {
        el.setPointerCapture(e.pointerId);
        el.classList.add("carosello-trascinamento");
        el.style.scrollSnapType = "none";
      }
    });

    el.addEventListener(
      "pointermove",
      (e) => {
        const d = this._caroselloDrag;
        if (!d.active || e.pointerId !== d.pointerId) return;

        const dx = e.clientX - d.startX;
        if (Math.abs(dx) > SOGLIA_DRAG_CAROSELLO) d.moved = true;

        if (d.isMouse && d.moved) {
          e.preventDefault();
          el.scrollLeft = d.startScrollLeft - dx;
        }
      },
      { passive: false }
    );

    const fineTrascinamento = (e) => {
      const d = this._caroselloDrag;
      if (!d.active || e.pointerId !== d.pointerId) return;

      if (d.isMouse) {
        el.releasePointerCapture(e.pointerId);
        el.classList.remove("carosello-trascinamento");
        el.style.scrollSnapType = "";
      }

      this._caroselloPointer = { moved: d.moved };
      d.active = false;
      d.pointerId = null;
    };

    el.addEventListener("pointerup", fineTrascinamento);
    el.addEventListener("pointercancel", fineTrascinamento);

    el.addEventListener("click", (e) => {
      const card = e.target.closest(".carosello-card");
      if (!card) return;

      if (this._caroselloPointer.moved) {
        e.preventDefault();
        this._caroselloPointer.moved = false;
        return;
      }

      const href = card.dataset.href;
      if (href) {
        window.location.href = href;
      }
    });

    el.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const card = e.target.closest(".carosello-card");
      if (!card?.dataset.href) return;
      e.preventDefault();
      window.location.href = card.dataset.href;
    });
  }

  apriMappaModal() {
    if (!this.mappaModalEl) return;
    this._modalAperta = true;
    this._mappaSpostata = false;
    this.cercaZonaBtn.hidden = true;

    if (!this.mappaModal) {
      this.mappaModal = L.map(this.mappaModalEl, {
        zoomControl: true,
        attributionControl: true,
      }).setView(this.mappa.getCenter(), this.mappa.getZoom());

      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: "© OpenStreetMap, © CARTO",
        maxZoom: 19,
      }).addTo(this.mappaModal);

      this.mappaModal.on("movestart", () => {
        if (this._muoviProgrammatico || this._eventiGiorno.length === 0) return;
        this._mappaSpostata = true;
      });

      this.mappaModal.on("moveend", () => {
        if (this._muoviProgrammatico) {
          this._muoviProgrammatico = false;
          return;
        }
        if (this._mappaSpostata && !this._zonaConfermata) {
          this.cercaZonaBtn.hidden = false;
        }
        this._muoviProgrammatico = true;
        this.mappa.setView(this.mappaModal.getCenter(), this.mappaModal.getZoom(), { animate: false });
      });

      this._renderMarkersModal();
    }

    this._syncVistaModal();
    this._renderCarosello();
    if (this._idSelezionato) {
      this._scrollAllaCardCarosello(this._idSelezionato, false);
    }
    requestAnimationFrame(() => {
      this.mappaModal?.invalidateSize();
      this._syncVistaModal();
      this._renderCarosello();
      if (this._idSelezionato) {
        this._scrollAllaCardCarosello(this._idSelezionato, false);
      }
    });
  }

  chiudiMappaModal() {
    this._modalAperta = false;
  }

  _syncVistaModal() {
    if (!this.mappa || !this.mappaModal) return;
    const center = this.mappa.getCenter();
    const zoom = this.mappa.getZoom();
    this.mappaModal.setView(center, zoom, { animate: false });
  }

  /** @param {object[]} eventi */
  impostaEventi(eventi) {
    this._eventiGiornoRaw = eventi;
    this._eventiGiorno = eventi.filter((e) => e.lat && e.lng);
    this._zonaConfermata = false;
    this._mappaSpostata = false;
    this._idSelezionato = null;
    this._ultimoPanId = null;
    this.cercaZonaBtn.hidden = true;
    this._applicaFiltri();
    this._adattaVista();
    this.ridimensiona();
  }

  /** @param {string|null|undefined} val */
  _idCategoriaEvento(val) {
    const raw = String(val || "altro").trim().toLowerCase();
    const match = this._categorie.find(
      (c) => c.id === raw || c.label.toLowerCase() === raw
    );
    return match ? match.id : raw;
  }

  /** Categorie presenti negli eventi del giorno (id Firestore, non label UI). */
  getCategoriePresenti() {
    const ids = new Set(
      this._eventiGiorno.map((e) => this._idCategoriaEvento(e.categoria))
    );
    return this._categorie.filter((c) => ids.has(c.id));
  }

  getEventiGiornoCount() {
    return this._eventiGiorno.length;
  }

  getCategoriaFiltro() {
    return this._categoriaFiltro;
  }

  /** @param {string|null} categoriaId */
  impostaCategoria(categoriaId) {
    this._categoriaFiltro = categoriaId;
    this._zonaConfermata = false;
    this._mappaSpostata = false;
    this.cercaZonaBtn.hidden = true;
    this._applicaFiltri();
    this._adattaVista();
  }

  confermaZona() {
    this._zonaConfermata = true;
    this._mappaSpostata = false;
    this.cercaZonaBtn.hidden = true;
    this._applicaFiltri();
  }

  _eventiFiltrati() {
    let lista = this._eventiGiornoRaw;
    if (this._categoriaFiltro) {
      lista = lista.filter(
        (e) => this._idCategoriaEvento(e.categoria) === this._categoriaFiltro
      );
    }
    const mappaAttiva = this._modalAperta && this.mappaModal ? this.mappaModal : this.mappa;
    if (this._zonaConfermata && mappaAttiva) {
      const bounds = mappaAttiva.getBounds();
      lista = lista.filter((e) => e.lat && e.lng && bounds.contains([e.lat, e.lng]));
    }
    return lista;
  }

  _eventiConCoordinate(lista) {
    return lista.filter((e) => e.lat && e.lng);
  }

  _messaggioVuoto() {
    const totali = this._eventiGiornoRaw.length;
    if (totali === 0) {
      return "Nessun evento per questo giorno.";
    }

    let lista = this._eventiGiornoRaw;
    if (this._categoriaFiltro) {
      lista = lista.filter(
        (e) => this._idCategoriaEvento(e.categoria) === this._categoriaFiltro
      );
      if (lista.length === 0) {
        return "Nessun evento in questa categoria per il giorno selezionato.";
      }
    }

    const mappaAttiva = this._modalAperta && this.mappaModal ? this.mappaModal : this.mappa;
    if (this._zonaConfermata && mappaAttiva) {
      const bounds = mappaAttiva.getBounds();
      const inZona = lista.filter((e) => e.lat && e.lng && bounds.contains([e.lat, e.lng]));
      if (inZona.length === 0) {
        return "Nessun evento in questa zona per il giorno selezionato.";
      }
    }

    return "Nessun evento corrisponde ai filtri selezionati.";
  }

  _applicaFiltri() {
    this._eventiVisibili = this._eventiFiltrati();
    const suMappa = this._eventiConCoordinate(this._eventiVisibili);
    this.onConteggio({
      carosello: this._eventiVisibili.length,
      mappa: suMappa.length,
      totaliGiorno: this._eventiGiornoRaw.length,
    });
    this._renderMarkers();
    this._renderLista();
    this._renderCarosello();

    if (this._eventiVisibili.length > 0) {
      const ancoraValido = this._eventiVisibili.some((e) => e.id === this._idSelezionato);
      const id = ancoraValido ? this._idSelezionato : this._eventiVisibili[0].id;
      this.seleziona(id, {
        centraMappa: !ancoraValido && suMappa.some((e) => e.id === id),
        scrollLista: !ancoraValido && !this._modalAperta,
        scrollCarosello: !ancoraValido || this._modalAperta,
      });
    } else {
      this._idSelezionato = null;
      this._ultimoPanId = null;
      this._aggiornaMarkerAttivi();
    }
  }

  _adattaVista() {
    const suMappa = this._eventiConCoordinate(this._eventiVisibili);
    if (!this.mappa || suMappa.length === 0) {
      this.mappa?.setView(CENTRO_POTENZA, ZOOM_DEFAULT, { animate: false });
      return;
    }
    const bounds = L.latLngBounds(suMappa.map((e) => [e.lat, e.lng]));
    if (bounds.isValid()) {
      this._muoviProgrammatico = true;
      this.mappa.fitBounds(bounds, { padding: [40, 40], maxZoom: 13, animate: true });
    }
  }

  _renderMarkers() {
    if (!this.mappa) return;

    this._markers.forEach(({ marker, markerModal }) => {
      this.mappa.removeLayer(marker);
      if (markerModal && this.mappaModal) {
        this.mappaModal.removeLayer(markerModal);
      }
    });
    this._markers.clear();

    this._eventiConCoordinate(this._eventiVisibili).forEach((ev) => {
      const marker = L.marker([ev.lat, ev.lng], {
        icon: iconaMarker(false),
        interactive: true,
        keyboard: false,
      })
        .addTo(this.mappa)
        .on("click", (e) => {
          L.DomEvent.stopPropagation(e);
          this.seleziona(ev.id, {
            centraMappa: true,
            scrollLista: !this._modalAperta,
            scrollCarosello: this._modalAperta,
          });
        });

      this._markers.set(ev.id, { marker, markerModal: null, evento: ev });
    });

    this._aggiornaMarkerAttivi();
    if (this.mappaModal) this._renderMarkersModal();
  }

  _renderMarkersModal() {
    if (!this.mappaModal) return;

    this._markers.forEach((entry) => {
      if (entry.markerModal) {
        this.mappaModal.removeLayer(entry.markerModal);
        entry.markerModal = null;
      }
    });

    this._eventiVisibili.forEach((ev) => {
      const entry = this._markers.get(ev.id);
      if (!entry) return;

      const markerModal = L.marker([ev.lat, ev.lng], {
        icon: iconaMarker(ev.id === this._idSelezionato),
        interactive: true,
      })
        .addTo(this.mappaModal)
        .on("click", () => {
          this.seleziona(ev.id, { centraMappa: true, scrollCarosello: true });
        });

      entry.markerModal = markerModal;
    });
  }

  _aggiornaMarkerAttivi() {
    this._markers.forEach(({ marker, markerModal }, id) => {
      const attivo = id === this._idSelezionato;
      marker.setIcon(iconaMarker(attivo));
      marker.setZIndexOffset(attivo ? 1000 : 0);
      if (markerModal) {
        markerModal.setIcon(iconaMarker(attivo));
        markerModal.setZIndexOffset(attivo ? 1000 : 0);
      }
    });
  }

  _renderLista() {
    if (this._eventiVisibili.length === 0) {
      if (this._categoriaFiltro && this._eventiGiorno.length > 0) {
        this.listaEl.innerHTML = `
        <div class="stato-vuoto">
          <p>Nessun evento trovato per il filtro selezionato.</p>
          <button type="button" class="filtri-bottone bottone-rimuovi-filtro">Rimuovi filtro</button>
        </div>`;
        this.listaEl
          .querySelector(".bottone-rimuovi-filtro")
          ?.addEventListener("click", () => this.onRimuoviFiltroCategoria());
        return;
      }

      this.listaEl.innerHTML = `
        <div class="stato-vuoto">
          <p>Nessun evento per il giorno selezionato.</p>
          <p class="stato-vuoto-sotto">Prova un altro giorno o rimuovi i filtri.</p>
        </div>`;
      return;
    }

    this.listaEl.innerHTML = this._eventiVisibili
      .map((ev) => this._htmlCard(ev))
      .join("");
  }

  _renderCarosello() {
    if (!this.caroselloEl) return;

    if (!this._modalAperta) {
      this._caroselloDirty = true;
      return;
    }
    this._caroselloDirty = false;

    if (this._eventiVisibili.length === 0) {
      this.caroselloEl.innerHTML = `
        <div class="carosello-vuoto">
          <p>${this._escape(this._messaggioVuoto())}</p>
        </div>`;
      return;
    }

    this.caroselloEl.innerHTML = this._eventiVisibili
      .map((ev) => this._htmlCard(ev, { carousel: true }))
      .join("");
  }

  /**
   * @param {object} ev
   * @param {{ carousel?: boolean }} [opts]
   */
  _htmlCard(ev, opts = {}) {
    const { carousel = false } = opts;
    const cat = ev.categoria || "altro";
    const prezzoRaw = ev.prezzo ?? "Gratis";
    const prezzoTesto = String(prezzoRaw);
    const gratis =
      prezzoTesto.toLowerCase().includes("gratis") ||
      prezzoTesto.toLowerCase().includes("gratuit");
    const prezzoLabel = gratis ? "Gratis" : prezzoTesto;
    const attivo = ev.id === this._idSelezionato ? " attiva" : "";
    const href = `evento.html?id=${encodeURIComponent(ev.id)}`;
    const labelCat = this._labelCategoria[cat] || "Evento";
    const orario = this._formattaOrario(ev);
    const comune = ev.comune || "";
    const icona = ICONE_CATEGORIA[cat] || ICONE_CATEGORIA.altro;

    const media = ev.immagine_url
      ? `<img class="evento-card-h-img" src="${this._escape(ev.immagine_url)}" alt="" loading="lazy"${carousel ? ' draggable="false"' : ""} />`
      : `<div class="evento-card-h-placeholder cat-${this._escape(cat)}">${icona}</div>`;

    const contenuto = `
      <div class="evento-card-h-media">${media}</div>
      <div class="evento-card-h-body">
        <div class="evento-card-h-testa">
          <h3 class="evento-card-h-titolo">${this._escape(ev.titolo)}</h3>
          <div class="evento-card-h-badge-riga">
            <span class="evento-card-h-badge">${this._escape(labelCat)}</span>
            ${ev.in_evidenza ? '<span class="evento-card-h-evidenza">In evidenza</span>' : ""}
          </div>
        </div>
        <div class="evento-card-h-dettagli">
          <span class="evento-card-h-orario">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>
            ${this._escape(orario)}
          </span>
          <span class="evento-card-h-luogo">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 21s7-7.5 7-12a7 7 0 1 0-14 0c0 4.5 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>
            ${this._escape(comune)}
          </span>
        </div>
        <div class="evento-card-h-footer">
          <span class="evento-card-h-prezzo${gratis ? " gratis" : ""}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M17 7a5 5 0 0 0-8 4 5 5 0 0 0 8 4M5 10h7M5 14h6"/></svg>
            ${this._escape(prezzoLabel)}
          </span>
        </div>
      </div>
      <span class="evento-card-h-azione" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M9 18l6-6-6-6"/></svg>
      </span>`;

    if (carousel) {
      return `
        <article class="carosello-card evento-card-h cat-${this._escape(cat)}${attivo}" data-id="${this._escape(ev.id)}" data-href="${href}" tabindex="0" aria-label="Apri ${this._escape(ev.titolo)}">
          <div class="carosello-card-link evento-card-h-link">${contenuto}</div>
        </article>`;
    }

    return `
      <article class="evento-card-h cat-${this._escape(cat)}${attivo}" data-id="${this._escape(ev.id)}">
        <a class="evento-card-h-link" href="${href}">${contenuto}</a>
      </article>`;
  }

  /**
   * @param {string} id
   * @param {{ centraMappa?: boolean, scrollLista?: boolean, scrollCarosello?: boolean }} [opts]
   */
  seleziona(id, opts = {}) {
    const { centraMappa = false, scrollLista = false, scrollCarosello = false } = opts;
    if (!this._eventiVisibili.some((e) => e.id === id)) return;

    this._syncVisuale(id);

    if (scrollLista) {
      this._scrollAllaCardLista(id);
    }

    if (scrollCarosello) {
      this._scrollAllaCardCarosello(id);
    }

    if (centraMappa) {
      this._centraMappaSuEvento(id);
    }
  }

  /** @param {string} id */
  _syncVisuale(id) {
    if (this._idSelezionato === id) {
      this._aggiornaCardAttive();
      return;
    }
    this._idSelezionato = id;
    this._aggiornaMarkerAttivi();
    this._aggiornaCardAttive();
  }

  /** @returns {string|null} */
  _idCardCentrale() {
    if (!this.caroselloEl) return null;

    const cards = this.caroselloEl.querySelectorAll(".carosello-card");
    if (cards.length === 0) return null;

    const centro = this.caroselloEl.scrollLeft + this.caroselloEl.clientWidth / 2;
    let migliore = null;
    let distMin = Infinity;

    cards.forEach((card) => {
      const cardCentro = card.offsetLeft + card.offsetWidth / 2;
      const dist = Math.abs(centro - cardCentro);
      if (dist < distMin) {
        distMin = dist;
        migliore = card.dataset.id;
      }
    });

    return migliore;
  }

  _centraMappaSuEvento(id) {
    const ev = this._eventiVisibili.find((e) => e.id === id);
    if (!ev?.lat || !ev?.lng) return;

    if (this._ultimoPanId === id) return;

    this._ultimoPanId = id;
    const mappaAttiva = this._modalAperta && this.mappaModal ? this.mappaModal : this.mappa;
    if (!mappaAttiva) return;

    const zoom = Math.max(mappaAttiva.getZoom(), 11);
    this._muoviProgrammatico = true;
    mappaAttiva.flyTo([ev.lat, ev.lng], zoom, {
      duration: 0.55,
      easeLinearity: 0.25,
    });

    if (this._modalAperta && this.mappaModal && this.mappa) {
      this.mappa.flyTo([ev.lat, ev.lng], zoom, {
        duration: 0.55,
        easeLinearity: 0.25,
      });
    } else if (!this._modalAperta && this.mappaModal) {
      this.mappaModal.flyTo([ev.lat, ev.lng], zoom, {
        duration: 0.55,
        easeLinearity: 0.25,
      });
    }
  }

  _aggiornaCardAttive() {
    this.listaEl.querySelectorAll(".evento-card-h").forEach((card) => {
      if (card.closest(".carosello-eventi")) return;
      card.classList.toggle("attiva", card.dataset.id === this._idSelezionato);
    });

    this.caroselloEl?.querySelectorAll(".carosello-card").forEach((card) => {
      card.classList.toggle("attiva", card.dataset.id === this._idSelezionato);
    });
  }

  _scrollAllaCardLista(id) {
    const card = this.listaEl.querySelector(
      `.evento-card-h[data-id="${CSS.escape(id)}"]`
    );
    card?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  /**
   * @param {string} id
   * @param {boolean} [smooth=true]
   */
  _scrollAllaCardCarosello(id, smooth = true) {
    if (!this.caroselloEl) return;

    const card = this.caroselloEl.querySelector(
      `.carosello-card[data-id="${CSS.escape(id)}"]`
    );
    if (!card) return;

    clearTimeout(this._scrollEndTimer);
    this._scrollEndTimer = null;
    clearTimeout(this._scrollUnlockTimer);
    this._scrollUnlockTimer = null;

    const target =
      card.offsetLeft - (this.caroselloEl.clientWidth - card.offsetWidth) / 2;

    if (!smooth) {
      this.caroselloEl.scrollTo({ left: target, behavior: "auto" });
      return;
    }

    this._scrollSyncLock = true;
    this.caroselloEl.scrollTo({
      left: target,
      behavior: "smooth",
    });

    if (!this._hasScrollEnd) {
      this._scrollUnlockTimer = setTimeout(() => {
        this._scrollSyncLock = false;
      }, 500);
    }
  }

  _onCaroselloScroll() {
    if (this._scrollSyncLock || !this._modalAperta) return;

    if (!this._scrollRaf) {
      this._scrollRaf = requestAnimationFrame(() => {
        this._scrollRaf = 0;
        const id = this._idCardCentrale();
        if (id) this._syncVisuale(id);
      });
    }

    if (!this._hasScrollEnd) {
      clearTimeout(this._scrollEndTimer);
      this._scrollEndTimer = setTimeout(() => this._onCaroselloScrollEnd(), 180);
    }
  }

  _onCaroselloScrollEnd() {
    if (this._scrollSyncLock) {
      this._scrollSyncLock = false;
      clearTimeout(this._scrollUnlockTimer);
      this._scrollUnlockTimer = null;
      return;
    }
    if (!this._modalAperta) return;

    const id = this._idCardCentrale();
    if (!id) return;

    this.seleziona(id, { centraMappa: true, scrollCarosello: false });
  }

  ridimensiona() {
    requestAnimationFrame(() => {
      this.mappa?.invalidateSize();
      if (this._modalAperta) {
        this.mappaModal?.invalidateSize();
      }
    });
  }

  _escape(str) {
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  }
}
