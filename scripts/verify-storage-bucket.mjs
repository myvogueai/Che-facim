/**
 * Verifica (con credenziali GCP) che il bucket Storage Firebase esista.
 * Usato in CI dopo google-github-actions/auth.
 *
 * node scripts/verify-storage-bucket.mjs
 */
import { Storage } from '@google-cloud/storage';

const PROJECT = 'che-facim';
const BUCKET = 'che-facim.firebasestorage.app';

const storage = new Storage({ projectId: PROJECT });

let exists = false;
let error = null;

try {
  const [metadata] = await storage.bucket(BUCKET).getMetadata();
  exists = true;
  console.log(JSON.stringify({
    project: PROJECT,
    bucket: BUCKET,
    exists: true,
    location: metadata.location,
    storageClass: metadata.storageClass,
  }, null, 2));
} catch (e) {
  error = e.message;
  console.log(JSON.stringify({
    project: PROJECT,
    bucket: BUCKET,
    exists: false,
    error: e.message,
    code: e.code,
  }, null, 2));
}

process.exit(exists ? 0 : 1);
