import { Workspace } from './types';

const DB_NAME = 'KTXH_OFFLINE_STUDIO_DB';
const DB_VERSION = 1;
const STORE_NAME = 'workspaces';
const LOCALSTORAGE_KEY = 'KTXH_OFFLINE_WORKSPACE_CACHE_V2_2';
const LOCALSTORAGE_COMPACT_KEY = 'KTXH_OFFLINE_SESSIONS_COMPACT_V2_2';
const IDB_OPEN_TIMEOUT_MS = 600;
const IDB_TX_TIMEOUT_MS = 1000;

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    let settled = false;
    const finish = (db: IDBDatabase | null) => {
      if (settled) {
        if (db) {
          try {
            db.close();
          } catch {
            // ignore
          }
        }
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve(db);
    };
    const timer = setTimeout(() => finish(null), IDB_OPEN_TIMEOUT_MS);

    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => finish(request.result);
      request.onerror = () => finish(null);
      request.onblocked = () => finish(null);
    } catch {
      finish(null);
    }
  });
}

function saveCompactSessionsToLocalStorage(workspace: Workspace): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const compactPayload = {
      formatVersion: workspace.formatVersion,
      schemaVersion: workspace.schemaVersion,
      name: workspace.name,
      updatedAt: workspace.updatedAt,
      activeSessionId: workspace.activeSessionId,
      localities: workspace.localities,
      sessions: workspace.sessions,
      auditLog: Array.isArray(workspace.auditLog) ? workspace.auditLog.slice(-100) : [],
    };
    localStorage.setItem(LOCALSTORAGE_COMPACT_KEY, JSON.stringify(compactPayload));
  } catch {
    // ignore quota/restricted storage errors
  }
}

function loadFromLocalStorage(): Workspace | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const cached = localStorage.getItem(LOCALSTORAGE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && parsed.formatVersion === 2 && Array.isArray(parsed.sessions)) {
        return parsed;
      }
    }
    const compactRaw = localStorage.getItem(LOCALSTORAGE_COMPACT_KEY);
    if (compactRaw) {
      const compact = JSON.parse(compactRaw);
      if (compact && compact.formatVersion === 2 && Array.isArray(compact.sessions)) {
        return {
          formatVersion: 2,
          schemaVersion: compact.schemaVersion || '2.2',
          name: compact.name || 'Hồ sơ Báo cáo KTXH Offline (MASTER V2.2)',
          updatedAt: compact.updatedAt || new Date().toISOString(),
          unsavedChanges: false,
          localities: Array.isArray(compact.localities) ? compact.localities : [],
          datasets: [],
          sessions: compact.sessions,
          activeSessionId: compact.activeSessionId,
          auditLog: Array.isArray(compact.auditLog) ? compact.auditLog : [],
        };
      }
    }
  } catch {
    // Ignore parse/storage errors
  }
  return null;
}

export async function saveWorkspacePersistent(workspace: Workspace): Promise<boolean> {
  // Always save lightweight session/settings snapshot (<150 KB) first so file:// stays resilient
  saveCompactSessionsToLocalStorage(workspace);

  // 1. Try full LocalStorage cache (works when < ~5 MB)
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(workspace));
    }
  } catch {
    // Quota exceeded (>5MB) or file:// restriction — compact copy above still saved sessions
  }

  // 2. Try IndexedDB (robust, large capacity) with strict timeout & connection close
  try {
    const db = await openDb();
    if (!db) return true;
    return await new Promise((resolve) => {
      let settled = false;
      const done = (ok: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try {
          db.close();
        } catch {
          // ignore
        }
        resolve(ok);
      };
      const timer = setTimeout(() => done(false), IDB_TX_TIMEOUT_MS);
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put({
        id: 'active_workspace',
        data: workspace,
        savedAt: new Date().toISOString(),
      });
      tx.oncomplete = () => done(true);
      tx.onabort = () => done(false);
      tx.onerror = () => done(false);
      req.onerror = () => done(false);
    });
  } catch {
    return false;
  }
}

export async function loadWorkspacePersistent(): Promise<Workspace | null> {
  const lsWorkspace = loadFromLocalStorage();

  // 1. Try IndexedDB (bounded by IDB_OPEN_TIMEOUT_MS + IDB_TX_TIMEOUT_MS)
  try {
    const db = await openDb();
    if (db) {
      const loaded = await new Promise<{ id: string; data: Workspace } | null>((resolve) => {
        let settled = false;
        const done = (val: { id: string; data: Workspace } | null) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          try {
            db.close();
          } catch {
            // ignore
          }
          resolve(val);
        };
        const timer = setTimeout(() => done(null), IDB_TX_TIMEOUT_MS);
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get('active_workspace');
        req.onsuccess = () => done(req.result || null);
        req.onerror = () => done(null);
        tx.onabort = () => done(null);
        tx.onerror = () => done(null);
      });
      if (loaded && loaded.data && loaded.data.formatVersion === 2 && Array.isArray(loaded.data.sessions)) {
        // Prefer localStorage if it has a strictly newer updatedAt timestamp
        if (lsWorkspace && lsWorkspace.updatedAt && loaded.data.updatedAt) {
          const lsTime = Date.parse(lsWorkspace.updatedAt);
          const idbTime = Date.parse(loaded.data.updatedAt);
          if (Number.isFinite(lsTime) && Number.isFinite(idbTime) && lsTime > idbTime) {
            if (lsWorkspace.datasets.length === 0 && loaded.data.datasets.length > 0) {
              return {
                ...lsWorkspace,
                datasets: loaded.data.datasets,
                localities:
                  lsWorkspace.localities.length > 0
                    ? lsWorkspace.localities
                    : loaded.data.localities,
              };
            }
            return lsWorkspace;
          }
        }
        return loaded.data;
      }
    }
  } catch {
    // Fall back to localStorage
  }

  return lsWorkspace;
}
