const DB_NAME = "tradersapp-draft-vault";
const STORE_NAME = "drafts";
const KEY_PREFIX = "tradersapp:draft:";
const LOCALSTORAGE_MAX_BYTES = 64 * 1024;

let dbPromise = null;

export const getDraftStorageKey = (key) => `${KEY_PREFIX}${key}`;

const safeJsonParse = (raw, fallback) => {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const supportsIndexedDb = () =>
  typeof indexedDB !== "undefined" && indexedDB !== null;

const openDatabase = () => {
  if (!supportsIndexedDb()) {
    return Promise.resolve(null);
  }

  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, 1);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "key" });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });

  return dbPromise;
};

const withStore = async (mode, handler) => {
  const db = await openDatabase();
  if (!db) {
    return null;
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);

    let settled = false;
    const finish = (value, isError = false) => {
      if (settled) {
        return;
      }
      settled = true;
      if (isError) {
        reject(value);
      } else {
        resolve(value);
      }
    };

    transaction.oncomplete = () => finish(null);
    transaction.onerror = () =>
      finish(transaction.error || new Error("Draft transaction failed."), true);

    try {
      handler(store, finish);
    } catch (error) {
      finish(error, true);
    }
  });
};

export const readDraftSync = (key, fallback = null) =>
  typeof localStorage === "undefined"
    ? fallback
    : safeJsonParse(localStorage.getItem(getDraftStorageKey(key)), fallback);

export const writeDraftSync = (key, value) => {
  if (typeof localStorage === "undefined") {
    return false;
  }

  try {
    const serialized = JSON.stringify(value);
    if (serialized.length > LOCALSTORAGE_MAX_BYTES) {
      localStorage.removeItem(getDraftStorageKey(key));
      return false;
    }
    localStorage.setItem(getDraftStorageKey(key), serialized);
    return true;
  } catch {
    return false;
  }
};

export const clearDraftSync = (key) => {
  if (typeof localStorage === "undefined") {
    return;
  }

  try {
    localStorage.removeItem(getDraftStorageKey(key));
  } catch {
    // Ignore storage failures.
  }
};

export async function readDraft(key, fallback = null) {
  const storageKey = getDraftStorageKey(key);
  try {
    const record = await withStore("readonly", (store, finish) => {
      const request = store.get(storageKey);
      request.onsuccess = () => finish(request.result || null);
      request.onerror = () => finish(null);
    });

    if (record?.value !== undefined) {
      return record.value;
    }
  } catch {
    // Ignore IndexedDB read failures and fall back to sync storage.
  }

  return readDraftSync(key, fallback);
}

export async function writeDraft(key, value) {
  const storageKey = getDraftStorageKey(key);
  writeDraftSync(key, value);

  try {
    await withStore("readwrite", (store, finish) => {
      const request = store.put({
        key: storageKey,
        value,
        updatedAt: new Date().toISOString(),
      });
      request.onsuccess = () => finish(true);
      request.onerror = () => finish(false);
    });
  } catch {
    // Ignore IndexedDB write failures; localStorage fallback already happened.
  }
}

export async function clearDraft(key) {
  const storageKey = getDraftStorageKey(key);
  clearDraftSync(key);

  try {
    await withStore("readwrite", (store, finish) => {
      const request = store.delete(storageKey);
      request.onsuccess = () => finish(true);
      request.onerror = () => finish(false);
    });
  } catch {
    // Ignore IndexedDB clear failures.
  }
}

export async function clearDraftsByPrefix(prefix) {
  if (typeof localStorage !== "undefined") {
    try {
      const matchPrefix = getDraftStorageKey(prefix);
      const keysToDelete = [];
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (String(key || "").startsWith(matchPrefix)) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach((key) => localStorage.removeItem(key));
    } catch {
      // Ignore storage failures.
    }
  }

  const db = await openDatabase();
  if (!db) {
    return;
  }

  await new Promise((resolve) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.openCursor();
    const matchPrefix = getDraftStorageKey(prefix);

    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve();
        return;
      }

      if (String(cursor.key || "").startsWith(matchPrefix)) {
        store.delete(cursor.key);
      }
      cursor.continue();
    };

    request.onerror = () => resolve();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => resolve();
  });
}

export function formatDraftSavedAt(timestamp) {
  if (!timestamp) {
    return "Not saved yet";
  }

  try {
    return new Intl.DateTimeFormat("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(new Date(timestamp));
  } catch {
    return "Saved";
  }
}

export default {
  getDraftStorageKey,
  readDraftSync,
  writeDraftSync,
  clearDraftSync,
  readDraft,
  writeDraft,
  clearDraft,
  clearDraftsByPrefix,
  formatDraftSavedAt,
};
