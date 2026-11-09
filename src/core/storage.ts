import { Workspace } from './types';

const DB_NAME = 'KTXH_OFFLINE_STUDIO_DB';
const DB_VERSION = 1;
const STORE_NAME = 'workspaces';
const LOCALSTORAGE_KEY = 'KTXH_OFFLINE_WORKSPACE_CACHE_V2_2';

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function saveWorkspacePersistent(workspace: Workspace): Promise<boolean> {
  // 1. Try LocalStorage first (synchronous & immediate)
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(workspace));
    }
  } catch {
    // Quota exceeded or file:// restriction
  }

  // 2. Try IndexedDB (robust, large capacity)
  try {
    const db = await openDb();
    if (!db) return true;
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put({ id: 'active_workspace', data: workspace, savedAt: new Date().toISOString() });
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

export async function loadWorkspacePersistent(): Promise<Workspace | null> {
  // 1. Try IndexedDB first
  try {
    const db = await openDb();
    if (db) {
      const loaded = await new Promise<{ id: string; data: Workspace } | null>((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get('active_workspace');
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
      if (loaded && loaded.data && loaded.data.formatVersion === 2) {
        return loaded.data;
      }
    }
  } catch {
    // Fall back to localStorage
  }

  // 2. Try LocalStorage
  try {
    if (typeof localStorage !== 'undefined') {
      const cached = localStorage.getItem(LOCALSTORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.formatVersion === 2 && Array.isArray(parsed.sessions)) {
          return parsed;
        }
      }
    }
  } catch {
    // Ignore
  }

  return null;
}
