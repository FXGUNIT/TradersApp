/**
 * Firebase Admin — Firestore initialization for Telegram Bridge
 * Migrated from CommonJS to ESM (I08)
 */
import admin from 'firebase-admin';

let db = null;
let initialized = false;

function initFirestore() {
  if (initialized) return db;
  try {
    const sa = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    const dbURL = process.env.FIREBASE_DATABASE_URL || '';
    if (sa) {
      const serviceAccount = typeof sa === 'string' ? JSON.parse(sa) : sa;
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount), databaseURL: dbURL });
    } else {
      admin.initializeApp();
    }
    db = admin.firestore();
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
