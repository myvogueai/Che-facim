/**
 * Test E2E copertina evento su produzione.
 * Richiede: ADMIN_EMAIL, ADMIN_PASSWORD
 * Esegui: ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/test-copertina-e2e.mjs
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = 'https://che-facim.web.app';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const POSTER = join(__dirname, 'fixtures/locandina-test-verticale.jpg');

const report = { steps: [], errors: [], eventoId: null, immagineUrl: null };

function log(step, ok, detail = '') {
  report.steps.push({ step, ok, detail });
  console.log(`${ok ? '✓' : '✗'} ${step}${detail ? ': ' + detail : ''}`);
}

async function urlRaggiungibile(url) {
  if (!url) return false;
  try {
    const res = await fetch(url, { method: 'HEAD' });
    return res.ok;
  } catch {
    return false;
  }
}

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('Imposta ADMIN_EMAIL e ADMIN_PASSWORD per il test E2E admin.');
  process.exit(1);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const jsErrors = [];
page.on('pageerror', (e) => jsErrors.push(String(e)));

try {
  // 1. Login admin
  await page.goto(`${BASE}/admin/`, { waitUntil: 'domcontentloaded' });
  await page.fill('#login-email', ADMIN_EMAIL);
  await page.fill('#login-password', ADMIN_PASSWORD);
  await page.click('#bottone-login');
  await page.waitForSelector('#vista-admin', { state: 'visible', timeout: 15000 });
  log('Login admin', true);

  const titolo = `Test copertina ${Date.now()}`;
  const oggi = new Date().toISOString().slice(0, 10);

  // 2. Compila form nuovo evento
  await page.fill('#titolo', titolo);
  await page.fill('#locale', 'Piazza Test');
  await page.fill('#indirizzo', 'Via Roma');
  await page.fill('#civico', '1');
  await page.fill('#comune', 'Potenza');
  await page.fill('#lat', '40.6404');
  await page.fill('#lng', '15.8056');
  await page.fill('#data', oggi);
  await page.fill('#orario', '21:00');
  await page.selectOption('#categoria', 'sagra');
  await page.fill('#prezzo', 'Gratis');

  await page.locator('#copertina-file').setInputFiles(POSTER);
  await page.waitForSelector('#copertina-preview-wrap:not([hidden])', { timeout: 5000 });
  log('Anteprima copertina in admin', true);

  await page.click('#bottone-salva');
  await page.waitForFunction(
    () => document.querySelector('.toast')?.textContent?.includes('pubblicato'),
    { timeout: 30000 }
  );
  log('Creazione evento con upload', true);

  // Recupera ID evento da Firestore REST (lettura pubblica)
  const apiKey = 'AIzaSyBiEx07creZonLuwRP3HI31e47u42ydDUs';
  const fsRes = await fetch(
    `https://firestore.googleapis.com/v1/projects/che-facim/databases/(default)/documents/eventi?pageSize=20&orderBy=data desc&key=${apiKey}`
  );
  const fsData = await fsRes.json();
  const doc = (fsData.documents || []).find((d) =>
    d.fields?.titolo?.stringValue === titolo
  );
  if (!doc) throw new Error('Evento test non trovato in Firestore');
  report.eventoId = doc.name.split('/').pop();
  report.immagineUrl = doc.fields?.immagine_url?.stringValue || '';
  log('immagine_url in Firestore', !!report.immagineUrl, report.immagineUrl?.slice(0, 80));
  log('URL Storage raggiungibile', await urlRaggiungibile(report.immagineUrl));

  // 3. Home
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    (t) => [...document.querySelectorAll('.evento-card-h-titolo')].some((el) => el.textContent.includes(t)),
    titolo,
    { timeout: 20000 }
  );
  const homeImg = await page.locator('.evento-card-h-img').first();
  const homeSrc = await homeImg.getAttribute('src');
  log('Home mostra copertina', homeSrc?.includes('firebasestorage'), homeSrc?.slice(0, 60));

  // 4. Mappa + carosello
  await page.click('#bottone-mappa-espandi');
  await page.waitForTimeout(1500);
  const mapImg = await page.locator('#carosello-mappa .evento-card-h-img').first().getAttribute('src');
  log('Carosello mappa mostra copertina', !!mapImg && mapImg.includes('firebasestorage'), mapImg?.slice(0, 60));
  await page.click('#modal-mappa-chiudi');

  // 5. Dettaglio
  await page.goto(`${BASE}/evento.html?id=${report.eventoId}`, { waitUntil: 'domcontentloaded' });
  const heroSrc = await page.locator('#img-hero').getAttribute('src');
  log('Dettaglio mostra copertina', heroSrc?.includes('firebasestorage'), heroSrc?.slice(0, 60));

  // 6. Preferiti
  await page.click('#bottone-preferito');
  await page.goto(`${BASE}/preferiti.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  const prefSrc = await page.locator('.locandina').first().getAttribute('src').catch(() => null);
  log('Preferiti mostra copertina', prefSrc?.includes('firebasestorage'), prefSrc?.slice(0, 60));

  const urlPrima = report.immagineUrl;

  // 7. Modifica — sostituisci copertina
  await page.goto(`${BASE}/admin/`, { waitUntil: 'domcontentloaded' });
  await page.click('#tab-lista');
  await page.waitForSelector('.admin-lista-item', { timeout: 10000 });
  await page.locator(`[data-modifica="${report.eventoId}"]`).click();
  await page.locator('#copertina-file').setInputFiles(join(__dirname, 'fixtures/copertina-test.png'));
  await page.click('#bottone-salva');
  await page.waitForFunction(
    () => document.querySelector('.toast')?.textContent?.includes('aggiornato'),
    { timeout: 30000 }
  );

  const fsRes2 = await fetch(
    `https://firestore.googleapis.com/v1/projects/che-facim/databases/(default)/documents/eventi/${report.eventoId}?key=${apiKey}`
  );
  const doc2 = await fsRes2.json();
  const urlDopo = doc2.fields?.immagine_url?.stringValue || '';
  log('Sostituzione copertina', urlDopo !== urlPrima && !!urlDopo, urlDopo?.slice(0, 60));
  log('Vecchia copertina rimossa da Storage', !(await urlRaggiungibile(urlPrima)));

  report.immagineUrl = urlDopo;

  // 8. Elimina evento
  await page.click('#tab-lista');
  await page.waitForSelector(`[data-elimina="${report.eventoId}"]`, { timeout: 10000 });
  page.once('dialog', (d) => d.accept());
  await page.click(`[data-elimina="${report.eventoId}"]`);
  await page.waitForFunction(
    () => document.querySelector('.toast')?.textContent?.includes('eliminato'),
    { timeout: 15000 }
  );
  log('Eliminazione evento', true);
  log('Copertina rimossa da Storage dopo delete', !(await urlRaggiungibile(urlDopo)));

} catch (err) {
  report.errors.push(String(err));
  log('Errore', false, String(err));
} finally {
  await browser.close();
}

const failed = report.steps.filter((s) => !s.ok).length + report.errors.length;
console.log('\n--- REPORT ---');
console.log(JSON.stringify({ ...report, jsErrors }, null, 2));
process.exit(failed > 0 ? 1 : 0);
