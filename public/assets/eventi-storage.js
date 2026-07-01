// eventi-storage.js
// Upload, compressione e eliminazione copertine evento su Firebase Storage.

import { getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

/** @returns {import('firebase/storage').FirebaseStorage} */
function storage() {
  return getStorage(getApp());
}

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_LATO = 1920;
const UPLOAD_TIMEOUT_MS = 120_000;
const COMPRESS_TIMEOUT_MS = 90_000;
const TIPI_ACCETTATI = new Set(["image/jpeg", "image/png", "image/webp"]);
const ESTENSIONI = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * @param {File} file
 * @returns {{ valido: boolean, messaggio?: string }}
 */
export function validaImmagineEvento(file) {
  if (!file) {
    return { valido: false, messaggio: "Nessun file selezionato." };
  }
  if (!TIPI_ACCETTATI.has(file.type)) {
    return {
      valido: false,
      messaggio: "Formato non supportato. Usa JPG, JPEG, PNG o WEBP.",
    };
  }
  if (file.size > MAX_BYTES) {
    return {
      valido: false,
      messaggio: "L'immagine supera il limite di 5 MB. Scegli un file più leggero.",
    };
  }
  return { valido: true };
}

/**
 * @template T
 * @param {Promise<T>} promise
 * @param {number} ms
 * @param {string} message
 */
function withTimeout(promise, ms, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    }),
  ]);
}

/**
 * @param {File} file
 * @returns {Promise<{ width: number, height: number, draw: (CanvasRenderingContext2D, number, number) => void, cleanup?: () => void }>}
 */
async function preparaSorgenteImmagine(file) {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, {
        resizeWidth: MAX_LATO,
        resizeHeight: MAX_LATO,
        resizeQuality: "high",
      });
      return {
        width: bitmap.width,
        height: bitmap.height,
        draw: (ctx, w, h) => ctx.drawImage(bitmap, 0, 0, w, h),
        cleanup: () => bitmap.close(),
      };
    } catch {
      // fallback sotto
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Impossibile leggere l'immagine selezionata."));
      el.src = url;
    });

    const ratio = Math.min(1, MAX_LATO / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.max(1, Math.round(img.naturalWidth * ratio));
    const height = Math.max(1, Math.round(img.naturalHeight * ratio));

    return {
      width,
      height,
      draw: (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h),
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Ridimensiona e comprime prima dell'upload.
 * @param {File} file
 * @returns {Promise<{ blob: Blob, contentType: string, ext: string }>}
 */
export async function comprimiImmagineEvento(file) {
  return withTimeout(
    comprimiImmagineEventoInner(file),
    COMPRESS_TIMEOUT_MS,
    "Compressione immagine troppo lenta. Prova con un file più piccolo."
  );
}

/**
 * @param {File} file
 */
async function comprimiImmagineEventoInner(file) {
  const sorgente = await preparaSorgenteImmagine(file);
  try {
    const qualita = 0.84;
    let w = sorgente.width;
    let h = sorgente.height;

    if (!w || !h) {
      throw new Error("Immagine non valida.");
    }

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Compressione non supportata dal browser.");
    sorgente.draw(ctx, w, h);

    const preferWebp = file.type !== "image/png";
    const tentativi = preferWebp
      ? [
          { type: "image/webp", ext: "webp", q: qualita },
          { type: "image/jpeg", ext: "jpg", q: qualita },
        ]
      : [
          { type: "image/png", ext: "png", q: undefined },
          { type: "image/jpeg", ext: "jpg", q: qualita },
        ];

    let migliore = null;
    for (const formato of tentativi) {
      const blob = await canvasToBlob(canvas, formato.type, formato.q);
      if (!blob) continue;
      if (!migliore || blob.size < migliore.blob.size) {
        migliore = { blob, contentType: formato.type, ext: formato.ext };
      }
    }

    if (!migliore) {
      throw new Error("Compressione dell'immagine fallita.");
    }

    if (migliore.blob.size > MAX_BYTES) {
      throw new Error(
        "L'immagine resta troppo grande dopo la compressione. Scegli un file più piccolo."
      );
    }

    return migliore;
  } finally {
    sorgente.cleanup?.();
  }
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {string} type
 * @param {number|undefined} quality
 */
function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

/**
 * @param {string} url
 */
export function isUrlStorageCopertina(url) {
  if (!url) return false;
  return (
    url.includes("firebasestorage.googleapis.com") &&
    url.includes("eventi-covers%2F")
  ) || (
    url.includes("firebasestorage.googleapis.com") &&
    url.includes("/eventi-covers/")
  );
}

/**
 * @param {string} url
 * @returns {string|null}
 */
export function estraiPathStorageDaUrl(url) {
  try {
    const parsed = new URL(url);
    const encoded = parsed.pathname.split("/o/")[1];
    if (!encoded) return null;
    const path = decodeURIComponent(encoded.split("?")[0]);
    return path.startsWith("eventi-covers/") ? path : null;
  } catch {
    return null;
  }
}

/**
 * @param {File} file
 * @param {string} eventoId
 * @param {{ onPhase?: (fase: 'compressione'|'upload') => void }} [opts]
 * @returns {Promise<string>}
 */
export async function caricaCopertinaEvento(file, eventoId, opts = {}) {
  const validazione = validaImmagineEvento(file);
  if (!validazione.valido) {
    throw new Error(validazione.messaggio);
  }

  opts.onPhase?.("compressione");
  const { blob, contentType, ext } = await comprimiImmagineEvento(file);
  const nome = `cover-${Date.now()}.${ext}`;
  const path = `eventi-covers/${eventoId}/${nome}`;
  const storageRef = ref(storage(), path);

  opts.onPhase?.("upload");
  await withTimeout(
    uploadBytes(storageRef, blob, {
      contentType,
      cacheControl: "public,max-age=31536000,immutable",
    }),
    UPLOAD_TIMEOUT_MS,
    "Upload copertina scaduto. Controlla la connessione e riprova."
  );

  return getDownloadURL(storageRef);
}

/**
 * @param {string} url
 */
export async function eliminaCopertinaDaUrl(url) {
  if (!isUrlStorageCopertina(url)) return;
  const path = estraiPathStorageDaUrl(url);
  if (!path) return;

  try {
    await deleteObject(ref(storage(), path));
  } catch (err) {
    if (err?.code !== "storage/object-not-found") {
      throw err;
    }
  }
}
