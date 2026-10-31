import { DemoPresetFile } from '@/types/socratix';

export interface ActiveContextState {
  courseId: string;
  labId: string;
  activityId?: string;
  studentId: string;
  seatLabel: string;
  sourceMode: 'preset' | 'disk';
  activePresetKey?: string;
}

const CONTEXT_STORAGE_KEY = 'socratix_active_context_v2';
const IDB_DB_NAME = 'socratix_fs_db';
const IDB_STORE_NAME = 'handles';

/**
 * Saves current student workspace navigation context to localStorage.
 */
export function saveActiveContext(context: Partial<ActiveContextState>): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = loadActiveContext() || {};
    const merged = { ...existing, ...context };
    localStorage.setItem(CONTEXT_STORAGE_KEY, JSON.stringify(merged));
  } catch (err) {
    console.warn('[WorkspacePersistence] Failed to save active context:', err);
  }
}

/**
 * Loads student workspace navigation context from localStorage.
 */
export function loadActiveContext(): Partial<ActiveContextState> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CONTEXT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.warn('[WorkspacePersistence] Failed to load active context:', err);
    return null;
  }
}

/**
 * Saves modified files of a Judge Demo Preset to localStorage.
 */
export function savePresetEdits(
  labId: string,
  presetKey: string,
  files: DemoPresetFile[]
): void {
  if (typeof window === 'undefined') return;
  try {
    const key = `socratix_preset_edits_${labId}_${presetKey}`;
    localStorage.setItem(key, JSON.stringify(files));
  } catch (err) {
    console.warn('[WorkspacePersistence] Failed to save preset edits:', err);
  }
}

/**
 * Loads modified files of a Judge Demo Preset from localStorage if previously edited.
 */
export function loadPresetEdits(
  labId: string,
  presetKey: string
): DemoPresetFile[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const key = `socratix_preset_edits_${labId}_${presetKey}`;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.warn('[WorkspacePersistence] Failed to load preset edits:', err);
    return null;
  }
}

/**
 * Clears locally modified files for a preset (restores pristine template).
 */
export function clearPresetEdits(labId: string, presetKey: string): void {
  if (typeof window === 'undefined') return;
  try {
    const key = `socratix_preset_edits_${labId}_${presetKey}`;
    localStorage.removeItem(key);
  } catch (err) {
    console.warn('[WorkspacePersistence] Failed to clear preset edits:', err);
  }
}

/**
 * Opens or initializes IndexedDB database for FileSystemDirectoryHandle persistence.
 */
function openHandleDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      reject(new Error('IndexedDB not supported in this environment.'));
      return;
    }

    const request = indexedDB.open(IDB_DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
        db.createObjectStore(IDB_STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Persists a FileSystemDirectoryHandle into IndexedDB.
 */
export async function saveDirectoryHandle(
  key: string,
  handle: FileSystemDirectoryHandle
): Promise<void> {
  try {
    const db = await openHandleDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
      const store = tx.objectStore(IDB_STORE_NAME);
      const req = store.put(handle, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[WorkspacePersistence] Failed to store directory handle in IndexedDB:', err);
  }
}

/**
 * Retrieves a persisted FileSystemDirectoryHandle from IndexedDB.
 */
export async function loadDirectoryHandle(
  key: string
): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openHandleDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_NAME, 'readonly');
      const store = tx.objectStore(IDB_STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[WorkspacePersistence] Failed to read directory handle from IndexedDB:', err);
    return null;
  }
}

/**
 * Clears a directory handle from IndexedDB.
 */
export async function clearDirectoryHandle(key: string): Promise<void> {
  try {
    const db = await openHandleDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
      const store = tx.objectStore(IDB_STORE_NAME);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[WorkspacePersistence] Failed to delete directory handle from IndexedDB:', err);
  }
}
