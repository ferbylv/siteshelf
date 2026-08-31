import {
  createVaultMeta,
  decryptLogin,
  encryptLogin,
  rotateDekAndReencrypt,
  unlockDekFromMeta,
} from './crypto';
import {
  deleteStoredRecord,
  getVaultMeta,
  isVaultSetup,
  listStoredRecords,
  putStoredRecord,
  putVaultMeta,
  replaceAllRecords,
} from './db';
import { parsePageTarget, recordMatchesPage, summarize, toLoginTarget } from './match';
import { isFreshPending, pendingForTab } from './pending';
import {
  clearPendingSave,
  getPendingSaveForTab,
  isUnlocked,
  loadSessionDek,
  lockVault,
  notifyPendingChanged,
  persistDek,
  setPendingSave,
  touchActivity,
} from './session';
import {
  MIN_MASTER_LENGTH,
  type LoginDraft,
  type LoginRecord,
  type LoginSummary,
  type PendingSave,
  type StoredVaultRecord,
} from './types';

export class VaultError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'not-setup'
      | 'locked'
      | 'wrong-password'
      | 'weak-password'
      | 'mismatch'
      | 'invalid-url'
      | 'corrupt',
  ) {
    super(message);
    this.name = 'VaultError';
  }
}

const WRONG = '主密码不正确，请重试。';

function assertStrong(password: string): void {
  if (password.length < MIN_MASTER_LENGTH) {
    throw new VaultError(`主密码至少 ${MIN_MASTER_LENGTH} 位。`, 'weak-password');
  }
}

async function requireDek(): Promise<CryptoKey> {
  const dek = await loadSessionDek();
  if (!dek) throw new VaultError('保险库已锁定。', 'locked');
  await touchActivity();
  return dek;
}

export async function vaultStatus(): Promise<{
  setup: boolean;
  unlocked: boolean;
}> {
  const setup = await isVaultSetup();
  if (!setup) return { setup: false, unlocked: false };
  return { setup: true, unlocked: await isUnlocked() };
}

export async function setupVault(password: string, confirm: string): Promise<void> {
  if (await isVaultSetup()) {
    throw new VaultError('保险库已初始化。', 'corrupt');
  }
  assertStrong(password);
  if (password !== confirm) {
    throw new VaultError('两次输入的主密码不一致。', 'mismatch');
  }
  const { meta, dek } = await createVaultMeta(password);
  await putVaultMeta(meta);
  await persistDek(dek);
}

export async function unlockVault(password: string): Promise<void> {
  const meta = await getVaultMeta();
  if (!meta) throw new VaultError('尚未设置主密码。', 'not-setup');
  try {
    const dek = await unlockDekFromMeta(password, meta);
    await persistDek(dek);
  } catch {
    throw new VaultError(WRONG, 'wrong-password');
  }
}

export async function lockVaultNow(): Promise<void> {
  await lockVault();
}

export async function changeMasterPassword(
  oldPassword: string,
  nextPassword: string,
  confirm: string,
): Promise<void> {
  assertStrong(nextPassword);
  if (nextPassword !== confirm) {
    throw new VaultError('两次输入的主密码不一致。', 'mismatch');
  }
  const meta = await getVaultMeta();
  if (!meta) throw new VaultError('尚未设置主密码。', 'not-setup');

  let oldDek: CryptoKey;
  try {
    oldDek = await unlockDekFromMeta(oldPassword, meta);
  } catch {
    throw new VaultError(WRONG, 'wrong-password');
  }

  const records = await decryptAll(oldDek);
  const { meta: nextMeta, dek, encrypted } = await rotateDekAndReencrypt(
    oldDek,
    records,
    nextPassword,
  );
  const rows: StoredVaultRecord[] = encrypted.map((item) => ({
    id: item.record.id,
    iv: item.iv,
    ciphertext: item.ciphertext,
    createdAt: item.record.createdAt,
    updatedAt: item.record.updatedAt,
  }));
  await replaceAllRecords(nextMeta, rows);
  await persistDek(dek);
}

async function decryptAll(dek: CryptoKey): Promise<LoginRecord[]> {
  const rows = await listStoredRecords();
  const out: LoginRecord[] = [];
  for (const row of rows) {
    try {
      out.push(await decryptLogin(dek, row.iv, row.ciphertext));
    } catch {
      throw new VaultError('保险库数据无法解密。', 'corrupt');
    }
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function listLogins(): Promise<LoginRecord[]> {
  const dek = await requireDek();
  return decryptAll(dek);
}

export async function listLoginSummaries(): Promise<LoginSummary[]> {
  const rows = await listLogins();
  return rows.map(summarize);
}

export async function getLogin(id: string): Promise<LoginRecord | undefined> {
  const rows = await listLogins();
  return rows.find((row) => row.id === id);
}

export async function saveLogin(draft: LoginDraft): Promise<LoginRecord> {
  const dek = await requireDek();
  const target = toLoginTarget(draft.url, draft.title);
  if (!target) throw new VaultError('网址无效，只支持 http(s) 地址。', 'invalid-url');

  const now = Date.now();
  let existing: LoginRecord | undefined;
  const all = await decryptAll(dek);
  if (draft.id) existing = all.find((row) => row.id === draft.id);
  if (!existing) {
    existing = all.find(
      (row) =>
        row.host === target.host &&
        row.scheme === target.scheme &&
        row.username === draft.username,
    );
  }

  const record: LoginRecord = {
    id: existing?.id ?? crypto.randomUUID(),
    title: (draft.title || target.title).trim() || target.host,
    origin: target.origin,
    host: target.host,
    scheme: target.scheme,
    url: target.url,
    username: draft.username,
    password: draft.password,
    notes: draft.notes ?? '',
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  const blob = await encryptLogin(dek, record);
  await putStoredRecord({
    id: record.id,
    iv: blob.iv,
    ciphertext: blob.ciphertext,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
  return record;
}

export async function deleteLogin(id: string): Promise<void> {
  await requireDek();
  await deleteStoredRecord(id);
}

export async function matchesForUrl(pageUrl: string): Promise<LoginRecord[]> {
  const page = parsePageTarget(pageUrl);
  if (!page) return [];
  const dek = await loadSessionDek();
  if (!dek) return [];
  await touchActivity();
  const all = await decryptAll(dek);
  return all.filter((row) => recordMatchesPage(row, page, 'host'));
}

export async function fillPayloadFor(
  id: string,
  pageUrl: string,
): Promise<{ username: string; password: string } | null> {
  const page = parsePageTarget(pageUrl);
  if (!page) return null;
  const dek = await loadSessionDek();
  if (!dek) return null;
  await touchActivity();
  const record = (await decryptAll(dek)).find((row) => row.id === id);
  if (!record) return null;
  if (!recordMatchesPage(record, page, 'host')) return null;
  return { username: record.username, password: record.password };
}

export async function stagePending(pending: PendingSave): Promise<void> {
  await setPendingSave(pending);
  await syncPendingBadge(pending.tabId);
  notifyPendingChanged(pending.tabId);
}

export async function readPending(tabId: number): Promise<PendingSave | undefined> {
  const pending = await getPendingSaveForTab(tabId);
  if (!pending) return undefined;
  const scoped = pendingForTab({ [String(tabId)]: pending }, tabId);
  if (!scoped || !isFreshPending(scoped)) {
    await clearPendingSave(tabId);
    return undefined;
  }
  return scoped;
}

export async function dismissPending(tabId: number): Promise<void> {
  await clearPendingSave(tabId);
  await syncPendingBadge();
  notifyPendingChanged(tabId);
}

export async function confirmPendingSave(tabId: number): Promise<LoginRecord | undefined> {
  const pending = await readPending(tabId);
  if (!pending) return undefined;
  const saved = await saveLogin({
    title: pending.host,
    origin: pending.origin,
    host: pending.host,
    scheme: pending.scheme,
    url: pending.url,
    username: pending.username,
    password: pending.password,
    notes: '',
  });
  await dismissPending(tabId);
  return saved;
}

async function activeTabId(): Promise<number | undefined> {
  try {
    const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
    return tab?.id;
  } catch {
    return undefined;
  }
}

/** Badge "1" when the current tab has a pending save. */
export async function syncPendingBadge(activeTabIdHint?: number): Promise<void> {
  try {
    const live = await activeTabId();
    const tabId = live ?? (typeof activeTabIdHint === 'number' ? activeTabIdHint : undefined);
    const pending = typeof tabId === 'number' ? await readPending(tabId) : undefined;
    await browser.action.setBadgeText({ text: pending ? '1' : '' });
    if (pending) {
      await browser.action.setBadgeBackgroundColor({ color: '#c45c26' });
      const action = browser.action as {
        setBadgeTextColor?: (details: { color: string }) => Promise<void>;
      };
      await action.setBadgeTextColor?.({ color: '#ffffff' });
    }
  } catch {
    /* tests / no action API */
  }
}
