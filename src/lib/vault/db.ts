import {
  META_STORE,
  RECORDS_STORE,
  VAULT_CHANGED_MESSAGE,
  VAULT_DB_NAME,
  VAULT_DB_VERSION,
  type StoredVaultRecord,
  type VaultMeta,
} from './types';

/**
 * Isolated database. Bookmarks live in `siteshelf` / `bookmarks` and must
 * never read or write these stores.
 */
function openVaultDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(VAULT_DB_NAME, VAULT_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(RECORDS_STORE)) {
        db.createObjectStore(RECORDS_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('无法打开保险库'));
  });
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('保险库操作失败'));
  });
}

function waitTx(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('保险库事务失败'));
    tx.onabort = () => reject(tx.error ?? new Error('保险库事务中止'));
  });
}

export function notifyVaultChanged(): void {
  void browser.runtime.sendMessage({ type: VAULT_CHANGED_MESSAGE }).catch(() => {
    /* no listener */
  });
}

export async function getVaultMeta(): Promise<VaultMeta | undefined> {
  const db = await openVaultDb();
  const tx = db.transaction(META_STORE, 'readonly');
  return reqToPromise(tx.objectStore(META_STORE).get('vault'));
}

export async function putVaultMeta(meta: VaultMeta): Promise<void> {
  const db = await openVaultDb();
  const tx = db.transaction(META_STORE, 'readwrite');
  tx.objectStore(META_STORE).put(meta);
  await waitTx(tx);
}

export async function listStoredRecords(): Promise<StoredVaultRecord[]> {
  const db = await openVaultDb();
  const tx = db.transaction(RECORDS_STORE, 'readonly');
  const rows = await reqToPromise(tx.objectStore(RECORDS_STORE).getAll());
  return rows as StoredVaultRecord[];
}

export async function putStoredRecord(row: StoredVaultRecord): Promise<void> {
  const db = await openVaultDb();
  const tx = db.transaction(RECORDS_STORE, 'readwrite');
  tx.objectStore(RECORDS_STORE).put(row);
  await waitTx(tx);
  notifyVaultChanged();
}

export async function deleteStoredRecord(id: string): Promise<void> {
  const db = await openVaultDb();
  const tx = db.transaction(RECORDS_STORE, 'readwrite');
  tx.objectStore(RECORDS_STORE).delete(id);
  await waitTx(tx);
  notifyVaultChanged();
}

export async function replaceAllRecords(
  meta: VaultMeta,
  rows: StoredVaultRecord[],
): Promise<void> {
  const db = await openVaultDb();
  const tx = db.transaction([META_STORE, RECORDS_STORE], 'readwrite');
  tx.objectStore(META_STORE).put(meta);
  const store = tx.objectStore(RECORDS_STORE);
  store.clear();
  for (const row of rows) store.put(row);
  await waitTx(tx);
  notifyVaultChanged();
}

export async function isVaultSetup(): Promise<boolean> {
  const meta = await getVaultMeta();
  return Boolean(meta?.wrappedDek && meta.salt);
}
