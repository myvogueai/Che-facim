/**
 * Verifica stato Storage Firebase (senza credenziali admin).
 * node scripts/verify-storage-ready.mjs
 */
const BUCKET = 'che-facim.firebasestorage.app';
const PROJECT = 'che-facim';

const checks = {};

// Avvio upload resumable senza token: 404 = bucket assente, 401/403 = bucket esiste
try {
  const res = await fetch(
    `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o?name=eventi-covers%2Fprobe%2Ftest.jpg&uploadType=resumable`,
    {
      method: 'POST',
      headers: {
        Authorization: 'Firebase probe-token',
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Goog-Upload-Protocol': 'resumable',
        'X-Goog-Upload-Command': 'start',
        'X-Goog-Upload-Header-Content-Type': 'image/jpeg',
      },
      body: '{}',
    }
  );
  const body = await res.json().catch(() => ({}));
  checks.resumableProbeStatus = res.status;
  checks.bucketExists = res.status !== 404;
  checks.resumableProbeMessage = body?.error?.message || null;
} catch (e) {
  checks.bucketExists = false;
  checks.resumableProbeError = String(e);
}

// Rules deployate: prova lettura pubblica su path inesistente (404 object vs 403 rules)
try {
  const res = await fetch(
    `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/eventi-covers%2Fprobe%2Ftest.jpg`
  );
  const body = await res.json();
  checks.rulesProbeStatus = res.status;
  checks.rulesAllowPublicRead =
    res.status === 404 && body?.error?.message?.includes('Object does not exist');
  checks.rulesProbeMessage = body?.error?.message || null;
} catch (e) {
  checks.rulesError = String(e);
}

// Admin UI + storage module
try {
  const adminHtml = await (await fetch('https://che-facim.web.app/admin/')).text();
  checks.adminHasCopertina = adminHtml.includes('Copertina evento');
  checks.adminHasStorageJs = adminHtml.includes('eventi-storage.js');
} catch (e) {
  checks.adminError = String(e);
}

// Config client: bucket corretto
try {
  const cfg = await (await fetch('https://che-facim.web.app/assets/firebase-config.js')).text();
  checks.configHasBucket = cfg.includes(`storageBucket: "${BUCKET}"`);
} catch (e) {
  checks.configError = String(e);
}

console.log(JSON.stringify({ project: PROJECT, bucket: BUCKET, checks }, null, 2));

const ok =
  checks.bucketExists &&
  checks.adminHasCopertina &&
  checks.configHasBucket &&
  checks.rulesAllowPublicRead;

if (checks.bucketExists && !checks.rulesAllowPublicRead) {
  console.error(
    '\nRegole Storage non applicate al bucket (lettura pubblica su eventi-covers/ negata). ' +
      'Esegui: firebase deploy --only storage --project che-facim'
  );
}

process.exit(ok ? 0 : 1);
