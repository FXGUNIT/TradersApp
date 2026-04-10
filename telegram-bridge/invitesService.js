/**
 * Invites Service — Firestore + local JSON fallback
 * Migrated from CommonJS to ESM (I08)
 */
import { resolve } from 'node:path';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getDb } from './firebaseAdmin.js';

const __filename = fileURLToPath(import.meta.url);
const invitesPath = resolve(__filename, '..', 'invites.json');

function ensureLocalInvites() {
  if (!existsSync(invitesPath)) {
    writeFileSync(invitesPath, JSON.stringify([], null, 2));
  }
  try {
    return JSON.parse(readFileSync(invitesPath, 'utf8'));
  } catch {
    return [];
  }
}

function writeLocalInvites(list) {
  writeFileSync(invitesPath, JSON.stringify(list, null, 2));
}

async function createInvite({ email, name }) {
  const invite = {
    id: 'INV-' + Date.now(),
    email,
    name: name || email,
    status: 'PENDING',
    createdAt: Date.now(),
  };
  const firestore = getDb();
  if (firestore) {
    const ref = await firestore.collection('invites').add({
      id: invite.id, email: invite.email, name: invite.name, status: invite.status, createdAt: invite.createdAt,
    });
    invite.docRef = ref.id;
  } else {
    const list = ensureLocalInvites();
    list.unshift(invite);
    writeLocalInvites(list);
  }
  return invite;
}

async function findInviteById(id, _db) {
  const firestore = _db || getDb();
  if (firestore) {
    try {
      const q = await firestore.collection('invites').where('id', '==', id).limit(1).get();
      if (q.empty) return null;
      return q.docs[0].data();
    } catch (e) {
      console.error('findInviteById Firestore error', e);
      return null;
    }
  }
  const items = ensureLocalInvites();
  return items.find(i => i.id === id) || null;
}

async function approveInvite(id, _db) {
  const firestore = _db || getDb();
  if (firestore) {
    const q = await firestore.collection('invites').where('id', '==', id).limit(1).get();
    if (q.empty) return null;
    const doc = q.docs[0];
    await doc.ref.update({ status: 'APPROVED', approvedAt: Date.now() });
    const updated = {
      id: doc.data().id, email: doc.data().email, name: doc.data().name,
      status: 'APPROVED', approvedAt: Date.now(),
    };
    return updated;
  } else {
    const list = ensureLocalInvites();
    const idx = list.findIndex(i => i.id === id);
    if (idx < 0) return null;
    list[idx].status = 'APPROVED';
    list[idx].approvedAt = Date.now();
    writeLocalInvites(list);
    return list[idx];
  }
}

async function getInvites(_db) {
  const firestore = _db || getDb();
  if (firestore) {
    try {
      const snapshot = await firestore.collection('invites').orderBy('createdAt', 'desc').get();
      return snapshot.docs.map(d => d.data());
    } catch (e) {
      console.error('getInvites Firestore error', e);
    }
  }
  return ensureLocalInvites();
}

export { createInvite, findInviteById, approveInvite, getInvites };
