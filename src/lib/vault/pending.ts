import { parsePageTarget } from './match';
import type { PendingSave } from './types';

/** Drop staged credentials after 15 minutes, or when the browser session ends. */
export const PENDING_TTL_MS = 15 * 60_000;

export const PENDING_SESSION_KEY = 'siteshelf.vault.pendingByTab';

export type PendingMap = Record<string, PendingSave>;

export function isPendingPayload(
  value: unknown,
): value is Omit<PendingSave, 'tabId'> & { tabId?: number } {
  if (!value || typeof value !== 'object') return false;
  const v = value as PendingSave;
  return (
    typeof v.origin === 'string' &&
    typeof v.host === 'string' &&
    (v.scheme === 'http:' || v.scheme === 'https:') &&
    typeof v.url === 'string' &&
    typeof v.username === 'string' &&
    typeof v.password === 'string' &&
    typeof v.capturedAt === 'number' &&
    (v.tabId === undefined || typeof v.tabId === 'number')
  );
}

export function isFreshPending(
  pending: Pick<PendingSave, 'capturedAt'>,
  now = Date.now(),
): boolean {
  return typeof pending.capturedAt === 'number' && now - pending.capturedAt <= PENDING_TTL_MS;
}

export function asPendingMap(value: unknown, now = Date.now()): PendingMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: PendingMap = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!isPendingPayload(raw)) continue;
    const fromKey = Number(key);
    const tabId = typeof raw.tabId === 'number' ? raw.tabId : fromKey;
    if (!Number.isInteger(tabId) || tabId < 0) continue;
    if (!isFreshPending(raw, now)) continue;
    if (typeof raw.tabId === 'number' && raw.tabId !== tabId) continue;
    out[String(tabId)] = {
      origin: raw.origin,
      host: raw.host,
      scheme: raw.scheme,
      url: raw.url,
      username: raw.username,
      password: raw.password,
      capturedAt: raw.capturedAt,
      tabId,
    };
  }
  return out;
}

export function pendingForTab(
  map: PendingMap,
  tabId: number,
  now = Date.now(),
): PendingSave | undefined {
  if (!Number.isInteger(tabId) || tabId < 0) return undefined;
  const pending = map[String(tabId)];
  if (!pending || pending.tabId !== tabId) return undefined;
  if (!isFreshPending(pending, now)) return undefined;
  return pending;
}

/**
 * STAGE: captured origin/host/scheme must match the page that sent the form.
 * tabId is taken from the sender, never from the page payload.
 */
export function stagePendingFromSender(
  raw: unknown,
  tabId: number,
  senderUrl: string | undefined,
  now = Date.now(),
): PendingSave | null {
  if (!isPendingPayload(raw) || !Number.isInteger(tabId) || tabId < 0) return null;
  const page = parsePageTarget(senderUrl);
  if (!page) return null;
  if (raw.host !== page.host || raw.scheme !== page.scheme || raw.origin !== page.origin) {
    return null;
  }
  if (!raw.username || !raw.password) return null;
  const capturedAt = isFreshPending(raw, now) ? raw.capturedAt : now;
  return {
    origin: page.origin,
    host: page.host,
    scheme: page.scheme,
    url: raw.url || page.url,
    username: raw.username,
    password: raw.password,
    capturedAt,
    tabId,
  };
}

/**
 * SAVE after redirect: keep the captured login origin. Never replace it with
 * the landing page. Reject another tab's staged record.
 * Unstaged SAVE is only allowed when the sender page still matches the payload
 * (same-tab form, STAGE not yet flushed).
 */
export function mergePendingForSave(
  staged: PendingSave | undefined,
  raw: unknown,
  tabId: number,
  senderUrl?: string,
  now = Date.now(),
): PendingSave | null {
  if (!Number.isInteger(tabId) || tabId < 0) return null;
  const fromRaw = isPendingPayload(raw) ? raw : undefined;
  let base: PendingSave | undefined;
  if (staged) {
    if (staged.tabId !== tabId) return null;
    base = staged;
  } else if (fromRaw && fromRaw.username && fromRaw.password) {
    const page = parsePageTarget(senderUrl);
    if (
      !page ||
      fromRaw.host !== page.host ||
      fromRaw.scheme !== page.scheme ||
      fromRaw.origin !== page.origin
    ) {
      return null;
    }
    base = {
      origin: page.origin,
      host: page.host,
      scheme: page.scheme,
      url: fromRaw.url || page.url,
      username: fromRaw.username,
      password: fromRaw.password,
      capturedAt: fromRaw.capturedAt,
      tabId,
    };
  }
  if (!base) return null;
  if (base.tabId !== tabId) return null;
  if (!isFreshPending(base, now)) return null;
  if (!base.origin || !base.host || !base.username || !base.password) return null;
  const username = fromRaw?.username?.trim() || base.username;
  if (!username) return null;
  return {
    origin: base.origin,
    host: base.host,
    scheme: base.scheme,
    url: base.url,
    username,
    password: base.password,
    capturedAt: base.capturedAt,
    tabId,
  };
}

/**
 * Pure STAGE persist decision. If the site is already in the vault, drop any
 * pending for this tab (so maybeShowPending cannot revive the save prompt).
 * New sites keep the capture in the map. Runtime I/O (IndexedDB / session) is
 * not used here so tests can cover the skip invariant without a browser.
 */
export function pendingMapAfterStage(
  map: PendingMap,
  pending: PendingSave,
  alreadySaved: boolean,
): { map: PendingMap; skipped: boolean } {
  const next: PendingMap = { ...map };
  if (alreadySaved) {
    delete next[String(pending.tabId)];
    return { map: next, skipped: true };
  }
  next[String(pending.tabId)] = pending;
  return { map: next, skipped: false };
}
