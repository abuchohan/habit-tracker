let connection: Promise<IDBDatabase> | undefined;
function db() {
  return connection ??= new Promise((resolve, reject) => {
    const request = indexedDB.open('habits-local', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('data');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { connection = undefined; reject(request.error); };
  });
}
export async function getItem(key: string): Promise<string | null> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const tx = database.transaction('data', 'readonly');
    const req = tx.objectStore('data').get(key);
    tx.oncomplete = () => resolve(req.result ?? null);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
export async function setItem(key: string, value: string): Promise<void> {
  const database = await db();
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction('data', 'readwrite');
    tx.objectStore('data').put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
export function requestPersistence() { navigator.storage?.persist?.().catch(() => {}); }
