// mappa-esplora.js
// Mappa protagonista + carosello sincronizzato (marker ↔ card).

const CENTRO_POTENZA = [40.6404, 15.8056];
const ZOOM_DEFAULT = 10;
const SOGLIA_DRAG_CAROSELLO = 8;

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
   * @param {HTMLElement} opts.caroselloEl
   * @param {HTMLButtonElement} opts.cercaZonaBtn
   * @param {(stats: { carosello: number, mappa: number, totaliGiorno: number }) => void} [opts.onConteggio]
   */
  constructor(opts) {
    this.mappaEl = opts.mappaEl;
    this.caroselloEl = opts.caroselloEl;
    this.cercaZonaBtn = opts.cercaZonaBtn;
    this.onConteggio = opts.onConteggio || (() => {});

    /** @type {import('leaflet').Map|null} */
    this.mappa = null;
    /** @type {Map<string, { marker: import('leaflet').Marker, evento: object }>} */
    this._markers = new Map();

    this._eventiGiornoRaw = [];
    this._eventiGiorno = [];
    this._eventiVisibili = [];
    this._categoriaFiltro = null;
    this._idSelezionato = null;
    this._zonaConfermata = false;
    this._mappaSpostata = false;
    this._scrollSyncLock = false;
    this._scrollEndTimer = null;
    this._scrollRaf = 0;
    this._muoviProgrammatico = false;
    this._ultimoPanId = null;
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
    this._placeholderImg = opts.placeholderImg || "assets/placeholder-evento.jpg";
  }

  init() {
    if (this.mappa) return;

    this.mappa = L.map(this.mappaEl, {
      zoomControl: false,
      attributionControl: true,
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
      if (this._mappaSpostata && !this._zonaConfermata) {
        this.cercaZonaBtn.hidden = false;
      }
    });

    this.cercaZonaBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.confermaZona();
    });

    this._bindCaroselloInterazioni();

    requestAnimationFrame(() => {
      this.mappa?.invalidateSize();
      requestAnimationFrame(() => this.mappa?.invalidateSize());
    });
  }

  _bindCaroselloInterazioni() {
    const el = this.caroselloEl;

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
      lista = lista.filter((e) => e.categoria === this._categoriaFiltro);
    }
    if (this._zonaConfermata && this.mappa) {
      const bounds = this.mappa.getBounds();
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
      lista = lista.filter((e) => e.categoria === this._categoriaFiltro);
      if (lista.length === 0) {
        return "Nessun evento in questa categoria per il giorno selezionato.";
      }
    }

    if (this._zonaConfermata && this.mappa) {
      const bounds = this.mappa.getBounds();
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
    this._renderCarosello();

    if (this._eventiVisibili.length > 0) {
      const ancoraValido = this._eventiVisibili.some((e) => e.id === this._idSelezionato);
      const id = ancoraValido ? this._idSelezionato : this._eventiVisibili[0].id;
      this.seleziona(id, {
        centraMappa: !ancoraValido && suMappa.some((e) => e.id === id),
        scrollCarosello: !ancoraValido,
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
      this.mappa.fitBounds(bounds, { padding: [48, 48], maxZoom: 13, animate: true });
    }
  }

  _renderMarkers() {
    if (!this.mappa) return;

    this._markers.forEach(({ marker }) => this.mappa.removeLayer(marker));
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
          this.seleziona(ev.id, { centraMappa: true, scrollCarosello: true });
        });
      this._markers.set(ev.id, { marker, evento: ev });
    });

    this._aggiornaMarkerAttivi();
  }

  _aggiornaMarkerAttivi() {
    this._markers.forEach(({ marker }, id) => {
      const attivo = id === this._idSelezionato;
      marker.setIcon(iconaMarker(attivo));
      if (attivo) marker.setZIndexOffset(1000);
      else marker.setZIndexOffset(0);
    });
  }

  _renderCarosello() {
    if (this._eventiVisibili.length === 0) {
      this.caroselloEl.innerHTML = `
        <div class="carosello-vuoto">
          <p>${this._escape(this._messaggioVuoto())}</p>
        </div>`;
      return;
    }

    this.caroselloEl.innerHTML = this._eventiVisibili
      .map((ev) => this._htmlCard(ev))
      .join("");
  }

  _htmlCard(ev) {
    const prezzo = ev.prezzo || "Gratis";
    const gratis =
      prezzo.toLowerCase().includes("gratis") ||
      prezzo.toLowerCase().includes("gratuit");
    const attivo = ev.id === this._idSelezionato ? " attiva" : "";
    const href = `evento.html?id=${encodeURIComponent(ev.id)}`;

    return `
      <article class="carosello-card${attivo}" data-id="${this._escape(ev.id)}" data-href="${href}" tabindex="0" aria-label="Apri ${this._escape(ev.titolo)}">
        <div class="carosello-card-link">
          <img class="carosello-locandina" src="${this._escape(ev.immagine_url || this._placeholderImg)}" alt="" loading="lazy" draggable="false" />
          <div class="carosello-corpo">
            <h3 class="carosello-titolo">${this._escape(ev.titolo)}</h3>
            ${ev.sottotitolo ? `<p class="carosello-sottotitolo">${this._escape(ev.sottotitolo)}</p>` : ""}
            <p class="carosello-locale">${this._escape(ev.locale || "")}</p>
            <div class="carosello-meta">
              <span>${this._escape(ev.comune || "")}</span>
              <span class="carosello-meta-sep">·</span>
              <span>${this._escape(this._formattaOrario(ev))}</span>
            </div>
            <p class="carosello-prezzo${gratis ? " gratis" : ""}">${this._escape(prezzo)}</p>
          </div>
        </div>
      </article>`;
  }

  /**
   * @param {string} id
   * @param {{ centraMappa?: boolean, scrollCarosello?: boolean }} [opts]
   */
  seleziona(id, opts = {}) {
    const { centraMappa = false, scrollCarosello = false } = opts;
    if (!this._eventiVisibili.some((e) => e.id === id)) return;

    this._syncVisuale(id);

    if (scrollCarosello) {
      this._scrollAllaCard(id);
    }

    if (centraMappa) {
      this._centraMappaSuEvento(id);
    }
  }

  /** @param {string} id */
  _syncVisuale(id) {
    if (this._idSelezionato === id) return;
    this._idSelezionato = id;
    this._aggiornaMarkerAttivi();
    this._aggiornaCardAttive();
  }

  /** @returns {string|null} */
  _idCardCentrale() {
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

  /** @param {string} id */
  _centraMappaSuEvento(id) {
    const ev = this._eventiVisibili.find((e) => e.id === id);
    if (!ev?.lat || !ev?.lng || !this.mappa) return;

    this._ultimoPanId = id;
    const zoom = this.mappa.getZoom();
    this._muoviProgrammatico = true;
    this.mappa.flyTo([ev.lat, ev.lng], zoom, {
      duration: 0.55,
      easeLinearity: 0.25,
    });
  }

  _aggiornaCardAttive() {
    this.caroselloEl.querySelectorAll(".carosello-card").forEach((card) => {
      card.classList.toggle("attiva", card.dataset.id === this._idSelezionato);
    });
  }

  _scrollAllaCard(id) {
    const card = this.caroselloEl.querySelector(`.carosello-card[data-id="${CSS.escape(id)}"]`);
    if (!card) return;

    clearTimeout(this._scrollEndTimer);
    this._scrollEndTimer = null;
    this._scrollSyncLock = true;
    const target =
      card.offsetLeft - (this.caroselloEl.clientWidth - card.offsetWidth) / 2;
    this.caroselloEl.scrollTo({ left: target, behavior: "smooth" });

    if (!this._hasScrollEnd) {
      clearTimeout(this._scrollUnlockTimer);
      this._scrollUnlockTimer = setTimeout(() => {
        this._scrollSyncLock = false;
      }, 500);
    }
  }

  _onCaroselloScroll() {
    if (this._scrollSyncLock) return;

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
      return;
    }

    const id = this._idCardCentrale();
    if (!id) return;

    this._syncVisuale(id);

    if (id !== this._ultimoPanId) {
      this._centraMappaSuEvento(id);
    }
  }

  ridimensiona() {
    requestAnimationFrame(() => {
      this.mappa?.invalidateSize();
    });
  }

  _escape(str) {
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  }
}
