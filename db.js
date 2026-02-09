const DB_NAME = 'produccionDB';
const STORE = 'registros';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);

    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'fecha' });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function saveDay(data) {
  return openDB().then(db => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(data);
  });
}

function getAllDays() {
  return openDB().then(db => {
    return new Promise((resolve, reject) => {
      const req = db.transaction(STORE, 'readonly')
        .objectStore(STORE)
        .getAll();

      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  });
}
