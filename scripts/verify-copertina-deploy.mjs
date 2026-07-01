import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

await page.goto('https://che-facim.web.app/admin/', { waitUntil: 'domcontentloaded' });

const adminUi = await page.evaluate(() => ({
  hasCopertinaLabel: !!document.body.textContent.includes('Copertina evento'),
  hasSeleziona: !!document.getElementById('copertina-seleziona'),
  hasPreview: !!document.getElementById('copertina-preview'),
  hasFileInput: !!document.getElementById('copertina-file'),
  accept: document.getElementById('copertina-file')?.getAttribute('accept'),
  hasOldUrlInput: !!document.querySelector('input[type=url]#immagine_url'),
}));

const cardCss = await page.evaluate(async () => {
  const res = await fetch('https://che-facim.web.app/assets/style.css');
  const css = await res.text();
  return {
    hasCopertinaAdminCss: css.includes('.copertina-preview'),
    hasObjectFitCover: css.includes('.evento-card-h-img') && css.match(/evento-card-h-img[\s\S]*?object-fit:\s*cover/),
    hasDettaglioHeroCover: css.includes('.dettaglio-hero') && css.match(/dettaglio-hero[\s\S]*?object-fit:\s*cover/),
  };
});

console.log(JSON.stringify({ adminUi, cardCss }, null, 2));
await browser.close();
