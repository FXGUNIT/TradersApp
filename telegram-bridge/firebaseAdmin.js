/**
 * Firestore initialization for Telegram Bridge.
 */
import { Firestore } from '@google-cloud/firestore';

let db = null;
let initialized = false;

function parseServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
}

function initFirestore() {
  if (initialized) return db;
  try {
    const serviceAccount = parseServiceAccount();
    const projectId =
      process.env.FIREBASE_PROJECT_ID ||
      process.env.GOOGLE_CLOUD_PROJECT ||
      process.env.GCLOUD_PROJECT ||
      serviceAccount?.project_id;

    const options = {};
    if (projectId) options.projectId = projectId;
    if (serviceAccount?.client_email && serviceAccount?.private_key) {
      options.credentials = {
        client_email: serviceAccount.client_email,
        private_key: serviceAccount.private_key,
      };
    }

    db = new Firestore(options);
    initialized = true;
    console.log('Telegram Bridge: Firestore initialized');
  } catch (err) {
    console.error('Telegram Bridge: Firestore init failed', err);
    db = null;
  }
  return db;
}

function getDb() {
  return db;
}

export { initFirestore, getDb };
