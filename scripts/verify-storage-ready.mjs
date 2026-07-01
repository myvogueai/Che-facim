/**
 * Verifica stato Storage Firebase (senza credenziali admin).
 * node scripts/verify-storage-ready.mjs
 */
const BUCKET = 'che-facim.firebasestorage.app';
const PROJECT = 'che-facim';

const checks = {};

// Bucket risponde (anche 400/403 = esiste)
try {
  const res = await fetch(`https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o?name=test-probe`);
  checks.bucketHttpStatus = res.status;
  checks.bucketReachable = res.status !== 404;
} catch (e) {
  checks.bucketReachable = false;
  checks.bucketError = String(e);
}

// Rules deployate: prova lettura pubblica su path inesistente (404 object vs 403 rules)
try {
  const res = await fetch(
    `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/eventi-covers%2Fprobe%2Ftest.jpg`
  );
  const body = await res.json();
  checks.rulesProbeStatus = res.status;
  checks.rulesAllowPublicRead = res.status === 404 && body?.error?.message?.includes('Object does not exist');
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

console.log(JSON.stringify({ project: PROJECT, bucket: BUCKET, checks }, null, 2));

const ok = checks.bucketReachable && checks.adminHasCopertina;
process.exit(ok ? 0 : 1);
