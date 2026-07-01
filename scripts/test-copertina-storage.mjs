/**
 * Test unitari helper copertina (senza Firebase).
 * Esegui: node scripts/test-copertina-storage.mjs
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Copia inline delle funzioni pure (evita import browser-only)
function isUrlStorageCopertina(url) {
  if (!url) return false;
  return (
    (url.includes("firebasestorage.googleapis.com") && url.includes("eventi-covers%2F")) ||
    (url.includes("firebasestorage.googleapis.com") && url.includes("/eventi-covers/"))
  );
}

function estraiPathStorageDaUrl(url) {
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

const MAX_BYTES = 5 * 1024 * 1024;
const TIPI_ACCETTATI = new Set(["image/jpeg", "image/png", "image/webp"]);

function validaImmagineEvento(file) {
  if (!file) return { valido: false, messaggio: "Nessun file selezionato." };
  if (!TIPI_ACCETTATI.has(file.type)) {
    return { valido: false, messaggio: "Formato non supportato. Usa JPG, JPEG, PNG o WEBP." };
  }
  if (file.size > MAX_BYTES) {
    return { valido: false, messaggio: "L'immagine supera il limite di 5 MB. Scegli un file più leggero." };
  }
  return { valido: true };
}

let pass = 0;
let fail = 0;

function assert(cond, msg) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${msg}`);
  } else {
    fail++;
    console.error(`  ✗ ${msg}`);
  }
}

console.log('Test URL Storage');
const sampleUrl =
  'https://firebasestorage.googleapis.com/v0/b/che-facim.firebasestorage.app/o/eventi-covers%2Fabc123%2Fcover-1.webp?alt=media&token=xyz';
assert(isUrlStorageCopertina(sampleUrl), 'riconosce URL Firebase copertina');
assert(!isUrlStorageCopertina('https://example.com/img.jpg'), 'rifiuta URL esterno');
assert(
  estraiPathStorageDaUrl(sampleUrl) === 'eventi-covers/abc123/cover-1.webp',
  'estrae path storage'
);

console.log('\nTest validazione file');
const tinyPng = new File([readFileSync(join(__dirname, 'fixtures/copertina-test.png'))], 'test.png', {
  type: 'image/png',
});
assert(validaImmagineEvento(tinyPng).valido, 'accetta PNG piccolo');

const fakeBig = new File([new Uint8Array(MAX_BYTES + 1)], 'big.jpg', { type: 'image/jpeg' });
assert(!validaImmagineEvento(fakeBig).valido, 'rifiuta file > 5MB');
assert(
  validaImmagineEvento(fakeBig).messaggio.includes('5 MB'),
  'messaggio errore dimensione chiaro'
);

const gif = new File([new Uint8Array(100)], 'x.gif', { type: 'image/gif' });
assert(!validaImmagineEvento(gif).valido, 'rifiuta GIF');

console.log(`\nRisultato: ${pass} pass, ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
