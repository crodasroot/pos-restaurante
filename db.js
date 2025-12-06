// db.js
// Simple wrapper for IndexedDB using Promises

const DB_NAME = 'pos_restaurante_db';
const DB_VERSION = 1;
let db;

function openDB() {
  return new Promise((resolve, reject) => {
    if (db) return resolve(db);
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const idb = e.target.result;
      if (!idb.objectStoreNames.contains('items')) {
        const s = idb.createObjectStore('items', { keyPath: 'id', autoIncrement: true });
        s.createIndex('byName', 'name', { unique: false });
      }
      if (!idb.objectStoreNames.contains('orders')) {
        idb.createObjectStore('orders', { keyPath: 'id', autoIncrement: true });
      }
      if (!idb.objectStoreNames.contains('sales')) {
        idb.createObjectStore('sales', { keyPath: 'id', autoIncrement: true });
      }
      if (!idb.objectStoreNames.contains('settings')) {
        idb.createObjectStore('settings', { keyPath: 'key' });
      }
    };
    req.onsuccess = () => { db = req.result; resolve(db); };
    req.onerror = (e) => reject(e.target.error);
  });
}

async function tx(storeName, mode = 'readonly') {
  const database = await openDB();
  const t = database.transaction(storeName, mode);
  return t.objectStore(storeName);
}

async function addItem(item) {
  const store = await tx('items', 'readwrite');
  return new Promise((res, rej) => {
    const req = store.add(item);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

async function putItem(item) {
  const store = await tx('items', 'readwrite');
  return new Promise((res, rej) => {
    const req = store.put(item);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

async function getAllItems() {
  const store = await tx('items', 'readonly');
  return new Promise((res, rej) => {
    const req = store.getAll();
    req.onsuccess = () => res(req.result || []);
    req.onerror = () => rej(req.error);
  });
}

async function deleteItem(id) {
  const store = await tx('items', 'readwrite');
  return new Promise((res, rej) => {
    const req = store.delete(Number(id));
    req.onsuccess = () => res(true);
    req.onerror = () => rej(req.error);
  });
}

async function addSale(sale) {
  const store = await tx('sales', 'readwrite');
  return new Promise((res, rej) => {
    const req = store.add(sale);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

async function getAllSales() {
  const store = await tx('sales', 'readonly');
  return new Promise((res, rej) => {
    const req = store.getAll();
    req.onsuccess = () => res(req.result || []);
    req.onerror = () => rej(req.error);
  });
}

// Export / import functions
async function exportAllData() {
  const items = await getAllItems();
  const sales = await getAllSales();
  const exportData = { exportedAt: new Date().toISOString(), items, sales };
  return exportData;
}

async function importData(json) {
  const database = await openDB();
  const promises = [];
  const txAll = database.transaction(['items', 'sales'], 'readwrite');
  const itemsStore = txAll.objectStore('items');
  const salesStore = txAll.objectStore('sales');

  json.items?.forEach(i => {
    // If id exists, use put to avoid duplicates
    promises.push(new Promise((res, rej) => {
      const req = itemsStore.put(i);
      req.onsuccess = () => res();
      req.onerror = () => rej(req.error);
    }));
  });
  json.sales?.forEach(s => {
    promises.push(new Promise((res, rej) => {
      const req = salesStore.put(s);
      req.onsuccess = () => res();
      req.onerror = () => rej(req.error);
    }));
  });

  return Promise.all(promises);
}
