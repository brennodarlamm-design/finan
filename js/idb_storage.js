// js/idb_storage.js — Camada de Armazenamento Nativa em IndexedDB para o FinObra
// Fornece persistência de alta capacidade (centenas de megabytes) sem estourar cotas de LocalStorage.

const IDBStorage = {
  DB_NAME: 'finobra_db',
  DB_VERSION: 1,
  STORE_NAME: 'kv_store',
  _dbPromise: null,

  isSupported() {
    return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
  },

  isAvailable() {
    return this.isSupported();
  },

  _getDB() {
    if (this._dbPromise) return this._dbPromise;
    if (!this.isSupported()) return Promise.reject(new Error('IndexedDB não suportado neste ambiente.'));

    this._dbPromise = new Promise((resolve, reject) => {
      try {
        const req = window.indexedDB.open(this.DB_NAME, this.DB_VERSION);

        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(this.STORE_NAME)) {
            db.createObjectStore(this.STORE_NAME, { keyPath: 'key' });
          }
        };

        req.onsuccess = (e) => {
          const db = e.target.result;
          db.onversionchange = () => {
            try { db.close(); } catch {}
            this._dbPromise = null;
          };
          resolve(db);
        };

        req.onerror = (e) => {
          console.warn('[IDBStorage] Falha ao abrir IndexedDB:', e.target?.error);
          this._dbPromise = null;
          reject(e.target?.error || new Error('Erro ao abrir IndexedDB'));
        };

        req.onblocked = () => {
          console.warn('[IDBStorage] Abertura do IndexedDB bloqueada por outra aba.');
        };
      } catch (err) {
        this._dbPromise = null;
        reject(err);
      }
    });

    return this._dbPromise;
  },

  async getItem(key) {
    if (!key) return null;
    try {
      const db = await this._getDB();
      return new Promise((resolve) => {
        try {
          const tx = db.transaction(this.STORE_NAME, 'readonly');
          const store = tx.objectStore(this.STORE_NAME);
          const req = store.get(String(key));
          req.onsuccess = () => {
            resolve(req.result ? req.result.value : null);
          };
          req.onerror = () => {
            resolve(null);
          };
        } catch {
          resolve(null);
        }
      });
    } catch {
      return null;
    }
  },

  async setItem(key, value) {
    if (!key) return false;
    try {
      const db = await this._getDB();
      return new Promise((resolve) => {
        try {
          const tx = db.transaction(this.STORE_NAME, 'readwrite');
          const store = tx.objectStore(this.STORE_NAME);
          store.put({ key: String(key), value, updatedAt: Date.now() });
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
          tx.onabort = () => resolve(false);
        } catch {
          resolve(false);
        }
      });
    } catch {
      return false;
    }
  },

  async removeItem(key) {
    if (!key) return false;
    try {
      const db = await this._getDB();
      return new Promise((resolve) => {
        try {
          const tx = db.transaction(this.STORE_NAME, 'readwrite');
          const store = tx.objectStore(this.STORE_NAME);
          store.delete(String(key));
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
        } catch {
          resolve(false);
        }
      });
    } catch {
      return false;
    }
  },

  async getAllKeys() {
    try {
      const db = await this._getDB();
      return new Promise((resolve) => {
        try {
          const tx = db.transaction(this.STORE_NAME, 'readonly');
          const store = tx.objectStore(this.STORE_NAME);
          const req = store.getAllKeys();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => resolve([]);
        } catch {
          resolve([]);
        }
      });
    } catch {
      return [];
    }
  },

  async clear() {
    try {
      const db = await this._getDB();
      return new Promise((resolve) => {
        try {
          const tx = db.transaction(this.STORE_NAME, 'readwrite');
          const store = tx.objectStore(this.STORE_NAME);
          store.clear();
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
        } catch {
          resolve(false);
        }
      });
    } catch {
      return false;
    }
  }
};

if (typeof window !== 'undefined') {
  window.IDBStorage = IDBStorage;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = IDBStorage;
}
