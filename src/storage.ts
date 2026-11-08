import { validProject } from './types';
import type { Project } from './types';

const DB_NAME = 'layerforge-v1';
const STORE = 'session';
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
export async function readSession(): Promise<Project | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).get('latest');
    req.onsuccess = () => { db.close(); resolve(validProject(req.result) ? req.result : null); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}
export async function writeSession(value: Project): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, 'latest');
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}
