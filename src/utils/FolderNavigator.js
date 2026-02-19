import { EventBus } from './EventBus.js';

const DB_NAME = 'charviewer';
const DB_STORE = 'settings';
const DIR_HANDLE_KEY = 'savedDirHandle';

/**
 * Folder navigation using File System Access API.
 * Persists directory handle in IndexedDB for session restore.
 */
export class FolderNavigator {
  constructor(app) {
    this.app = app;
    this.dirHandle = null;
    this.dirFileHandles = [];
    this.dirIndex = -1;
    this._pendingDirHandle = null;

    this.setupSetFolder();
    this.setupNavButtons();
    this.setupKeyboardNav();
  }

  // ── IndexedDB helpers ──

  static _openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(DB_STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  static async saveDirHandle(dirHandle) {
    const db = await this._openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readwrite');
      tx.objectStore(DB_STORE).put(dirHandle, DIR_HANDLE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  static async loadSavedDirHandle() {
    try {
      const db = await this._openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(DB_STORE, 'readonly');
        const req = tx.objectStore(DB_STORE).get(DIR_HANDLE_KEY);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return null;
    }
  }

  // ── Restore saved folder on startup ──

  async tryRestoreSavedFolder() {
    const dirHandle = await FolderNavigator.loadSavedDirHandle();
    if (!dirHandle) return false;

    const perm = await dirHandle.queryPermission({ mode: 'read' });
    if (perm === 'granted') {
      await this.openDirectoryHandle(dirHandle, { save: false });
      return true;
    }

    this._pendingDirHandle = dirHandle;
    return false;
  }

  async tryRequestPendingPermission() {
    if (!this._pendingDirHandle) return false;
    try {
      const perm = await this._pendingDirHandle.requestPermission({ mode: 'read' });
      if (perm === 'granted') {
        await this.openDirectoryHandle(this._pendingDirHandle, { save: false });
        this._pendingDirHandle = null;
        return true;
      }
    } catch { /* user denied or error */ }
    this._pendingDirHandle = null;
    return false;
  }

  // ── Set Folder button ──

  setupSetFolder() {
    // We'll reuse the topbar's Open button as primary, but also add Set Folder support
    // via the prev/next nav buttons becoming active when a folder is set
  }

  async pickFolder() {
    if (this._pendingDirHandle) {
      const restored = await this.tryRequestPendingPermission();
      if (restored) return;
    }

    if (!window.showDirectoryPicker) {
      this.app.toast.show('Folder selection requires Chrome or Edge');
      return;
    }

    try {
      const dirHandle = await window.showDirectoryPicker({
        id: 'model-folder',
        mode: 'read'
      });
      await this.openDirectoryHandle(dirHandle);
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn('Directory picker failed:', err);
      }
    }
  }

  async openDirectoryHandle(dirHandle, { save = true } = {}) {
    this.dirHandle = dirHandle;
    this.dirFileHandles = [];

    for await (const entry of dirHandle.values()) {
      if (entry.kind !== 'file') continue;
      const ext = entry.name.split('.').pop().toLowerCase();
      if (ext === 'glb') {
        this.dirFileHandles.push(entry);
      }
    }

    if (this.dirFileHandles.length === 0) {
      this.app.toast.show('No .glb files found in folder');
      return;
    }

    this.dirFileHandles.sort((a, b) => a.name.localeCompare(b.name));
    this.dirIndex = 0;

    console.log(`Folder opened: ${this.dirFileHandles.length} models`);

    if (save) {
      try {
        await FolderNavigator.saveDirHandle(dirHandle);
      } catch (err) {
        console.warn('Could not save folder handle:', err);
      }
    }

    this.updateNavUI();
    await this.loadByIndex(0);
  }

  async loadByIndex(index) {
    if (index < 0 || index >= this.dirFileHandles.length) return;
    this.dirIndex = index;
    const handle = this.dirFileHandles[index];
    const file = await handle.getFile();
    await this.app.loadFromFile(file);
    this.updateNavUI();
  }

  async loadPrev() {
    if (this.dirFileHandles.length === 0) return;
    const newIndex = this.dirIndex > 0 ? this.dirIndex - 1 : this.dirFileHandles.length - 1;
    await this.loadByIndex(newIndex);
  }

  async loadNext() {
    if (this.dirFileHandles.length === 0) return;
    const newIndex = this.dirIndex < this.dirFileHandles.length - 1 ? this.dirIndex + 1 : 0;
    await this.loadByIndex(newIndex);
  }

  updateNavUI() {
    const prevBtn = document.getElementById('prevModel');
    const nextBtn = document.getElementById('nextModel');
    const fileNameEl = document.getElementById('fileName');

    const hasFolder = this.dirFileHandles.length > 0;
    prevBtn.disabled = !hasFolder;
    nextBtn.disabled = !hasFolder;

    if (hasFolder) {
      const name = this.dirFileHandles[this.dirIndex]?.name || '';
      fileNameEl.textContent = `${name} ${this.dirIndex + 1}/${this.dirFileHandles.length}`;
    }
  }

  // ── Nav button wiring ──

  setupNavButtons() {
    document.getElementById('prevModel')?.addEventListener('click', () => this.loadPrev());
    document.getElementById('nextModel')?.addEventListener('click', () => this.loadNext());
  }

  // ── Arrow key shortcuts ──

  setupKeyboardNav() {
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); this.loadPrev(); }
      if (e.key === 'ArrowRight') { e.preventDefault(); this.loadNext(); }
    });
  }
}
