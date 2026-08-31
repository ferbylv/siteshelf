import {
  BOOKMARKS_CHANGED_MESSAGE,
  type Bookmark,
} from './types';

/**
 * Bookmarks live in their own IndexedDB database/store.
 * Vault credentials use a separate database (`siteshelf-vault`) and must
 * never be mixed into `bookmarks` or read as plaintext from here.
 */
const DB_NAME = 'siteshelf';
const DB_VERSION = 1;
const BOOKMARKS_STORE = 'bookmarks';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(BOOKMARKS_STORE)) {
        const store = db.createObjectStore(BOOKMARKS_STORE, { keyPath: 'id' });
        store.createIndex('normalizedUrl', 'normalizedUrl', { unique: true });
        store.createIndex('category', 'category', { unique: false });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('无法打开本地数据库'));
  });
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('数据库操作失败'));
  });
}

function waitTx(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('数据库事务失败'));
    tx.onabort = () => reject(tx.error ?? new Error('数据库事务中止'));
  });
}

export function notifyBookmarksChanged(): void {
  void browser.runtime.sendMessage({ type: BOOKMARKS_CHANGED_MESSAGE }).catch(() => {
    /* no listener yet */
  });
}

export async function listBookmarks(): Promise<Bookmark[]> {
  const db = await openDb();
  const tx = db.transaction(BOOKMARKS_STORE, 'readonly');
  const rows = await reqToPromise(tx.objectStore(BOOKMARKS_STORE).getAll());
  return [...rows].sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getBookmark(id: string): Promise<Bookmark | undefined> {
  const db = await openDb();
  const tx = db.transaction(BOOKMARKS_STORE, 'readonly');
  return reqToPromise(tx.objectStore(BOOKMARKS_STORE).get(id));
}

export async function getByNormalizedUrl(
  normalizedUrl: string,
): Promise<Bookmark | undefined> {
  const db = await openDb();
  const tx = db.transaction(BOOKMARKS_STORE, 'readonly');
  return reqToPromise(
    tx.objectStore(BOOKMARKS_STORE).index('normalizedUrl').get(normalizedUrl),
  );
}

export async function upsertBookmark(
  input: Omit<Bookmark, 'id' | 'createdAt' | 'updatedAt'> & {
    id?: string;
  },
): Promise<{ bookmark: Bookmark; duplicated: boolean }> {
  const existing = await getByNormalizedUrl(input.normalizedUrl);
  const now = Date.now();
  const bookmark: Bookmark = existing
    ? {
        ...existing,
        ...input,
        id: existing.id,
        createdAt: existing.createdAt,
        updatedAt: now,
      }
    : {
        ...input,
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
      };

  const db = await openDb();
  const tx = db.transaction(BOOKMARKS_STORE, 'readwrite');
  await reqToPromise(tx.objectStore(BOOKMARKS_STORE).put(bookmark));
  notifyBookmarksChanged();
  return { bookmark, duplicated: Boolean(existing) };
}

export async function updateBookmark(
  id: string,
  patch: Partial<
    Pick<Bookmark, 'title' | 'summary' | 'category' | 'tags' | 'description'>
  >,
): Promise<Bookmark | undefined> {
  const current = await getBookmark(id);
  if (!current) return undefined;
  const bookmark: Bookmark = { ...current, ...patch, updatedAt: Date.now() };
  const db = await openDb();
  const tx = db.transaction(BOOKMARKS_STORE, 'readwrite');
  await reqToPromise(tx.objectStore(BOOKMARKS_STORE).put(bookmark));
  notifyBookmarksChanged();
  return bookmark;
}

export async function deleteBookmark(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(BOOKMARKS_STORE, 'readwrite');
  await reqToPromise(tx.objectStore(BOOKMARKS_STORE).delete(id));
  notifyBookmarksChanged();
}

export async function remapCategory(from: string, to: string): Promise<void> {
  if (!from || from === to) return;
  const db = await openDb();
  const tx = db.transaction(BOOKMARKS_STORE, 'readwrite');
  const store = tx.objectStore(BOOKMARKS_STORE);
  const rows = (await reqToPromise(store.getAll())) as Bookmark[];
  const now = Date.now();
  let changed = false;
  for (const row of rows) {
    if (row.category === from) {
      store.put({ ...row, category: to, updatedAt: now });
      changed = true;
    }
  }
  await waitTx(tx);
  if (changed) notifyBookmarksChanged();
}

