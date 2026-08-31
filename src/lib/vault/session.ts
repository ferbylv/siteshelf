import { importDekRaw, exportDekRaw } from './crypto';
import { zeroBytes } from './encoding';
import { asPendingMap, PENDING_SESSION_KEY, type PendingMap } from './pending';
import { loadVaultSettings } from './settings';
import { VAULT_PENDING_MESSAGE, VAULT_SESSION_MESSAGE, type PendingSave } from './types';

const DEK_KEY = 'siteshelf.vault.dek';
const ACTIVITY_KEY = 'siteshelf.vault.activity';

function sessionArea(): typeof browser.storage.local {
  const area = (browser.storage as { session?: typeof browser.storage.local }).session;
  if (!area) {
    throw new Error('当前浏览器不支持会话存储，无法保持解锁状态');
  }
  return area;
}

export function notifyVaultSession(unlocked: boolean): void {
  const payload = { type: VAULT_SESSION_MESSAGE, unlocked };
  void browser.runtime.sendMessage(payload).catch(() => {
    /* no extension-page listener */
  });
  void browser.tabs.query({}).then((tabs) => {
    for (const tab of tabs) {
      if (tab.id == null) continue;
      void browser.tabs.sendMessage(tab.id, payload).catch(() => {
        /* no content script */
      });
    }
  });
}

export async function persistDek(dek: CryptoKey): Promise<void> {
  const raw = await exportDekRaw(dek);
  try {
    await sessionArea().set({
      [DEK_KEY]: Array.from(raw),
      [ACTIVITY_KEY]: Date.now(),
    });
  } finally {
    zeroBytes(raw);
  }
  notifyVaultSession(true);
}

export async function touchActivity(): Promise<void> {
  try {
    const area = sessionArea();
    const cur = await area.get(DEK_KEY);
    if (!cur[DEK_KEY]) return;
    await area.set({ [ACTIVITY_KEY]: Date.now() });
  } catch {
    /* ignore */
  }
}

export async function lockVault(): Promise<void> {
  try {
    await sessionArea().remove([DEK_KEY, ACTIVITY_KEY]);
  } catch {
    /* ignore */
  }
  notifyVaultSession(false);
}

export async function loadSessionDek(): Promise<CryptoKey | null> {
  let stored: Record<string, unknown>;
  try {
    stored = await sessionArea().get([DEK_KEY, ACTIVITY_KEY]);
  } catch {
    return null;
  }
  const arr = stored[DEK_KEY] as number[] | undefined;
  if (!arr || arr.length < 16) return null;

  const settings = await loadVaultSettings();
  const last = stored[ACTIVITY_KEY] as number | undefined;
  if (
    settings.idleMinutes > 0 &&
    typeof last === 'number' &&
    Date.now() - last > settings.idleMinutes * 60_000
  ) {
    await lockVault();
    return null;
  }

  try {
    return await importDekRaw(new Uint8Array(arr), true);
  } catch {
    await lockVault();
    return null;
  }
}

export async function isUnlocked(): Promise<boolean> {
  return Boolean(await loadSessionDek());
}

export function notifyPendingChanged(tabId?: number): void {
  const payload = { type: VAULT_PENDING_MESSAGE, tabId };
  void browser.runtime.sendMessage(payload).catch(() => {
    /* no extension-page listener */
  });
  if (typeof tabId === 'number') {
    void browser.tabs.sendMessage(tabId, payload).catch(() => {
      /* no content script */
    });
  }
}

export async function readPendingMap(): Promise<PendingMap> {
  const stored = await sessionArea().get(PENDING_SESSION_KEY);
  return asPendingMap(stored[PENDING_SESSION_KEY]);
}

export async function setPendingSave(pending: PendingSave): Promise<void> {
  const area = sessionArea();
  const stored = await area.get(PENDING_SESSION_KEY);
  const map = asPendingMap(stored[PENDING_SESSION_KEY]);
  map[String(pending.tabId)] = pending;
  await area.set({ [PENDING_SESSION_KEY]: map });
}

export async function getPendingSaveForTab(tabId: number): Promise<PendingSave | undefined> {
  const map = await readPendingMap();
  return map[String(tabId)];
}

export async function clearPendingSave(tabId: number): Promise<void> {
  const area = sessionArea();
  const stored = await area.get(PENDING_SESSION_KEY);
  const map = asPendingMap(stored[PENDING_SESSION_KEY]);
  delete map[String(tabId)];
  if (Object.keys(map).length === 0) {
    await area.remove(PENDING_SESSION_KEY);
  } else {
    await area.set({ [PENDING_SESSION_KEY]: map });
  }
}
