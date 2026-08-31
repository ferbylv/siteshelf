import { parsePageTarget, summarize } from './match';
import {
  dismissPending,
  fillPayloadFor,
  matchesForUrl,
  readPending,
  saveLogin,
  stagePending,
  vaultStatus,
} from './service';
import { VAULT_MSG, type PendingSave } from './types';

type Sender = { url?: string; tab?: { id?: number; url?: string }; id?: string };

function senderPageUrl(sender: Sender): string | undefined {
  return sender.url || sender.tab?.url;
}

function isPendingSave(value: unknown): value is PendingSave {
  if (!value || typeof value !== 'object') return false;
  const v = value as PendingSave;
  return (
    typeof v.origin === 'string' &&
    typeof v.host === 'string' &&
    (v.scheme === 'http:' || v.scheme === 'https:') &&
    typeof v.url === 'string' &&
    typeof v.username === 'string' &&
    typeof v.password === 'string' &&
    typeof v.capturedAt === 'number'
  );
}

function pendingFromSender(raw: unknown, sender: Sender): PendingSave | null {
  if (!isPendingSave(raw)) return null;
  const page = parsePageTarget(senderPageUrl(sender));
  if (!page) return null;
  if (raw.host !== page.host || raw.scheme !== page.scheme) return null;
  if (raw.origin !== page.origin) return null;
  return {
    origin: page.origin,
    host: page.host,
    scheme: page.scheme,
    url: page.url,
    username: raw.username,
    password: raw.password,
    capturedAt: Date.now(),
  };
}

export async function handleVaultMessage(
  msg: { type?: string; [k: string]: unknown },
  sender: Sender,
): Promise<unknown> {
  const type = msg?.type;
  if (!type || !Object.values(VAULT_MSG).includes(type as (typeof VAULT_MSG)[keyof typeof VAULT_MSG])) {
    return undefined;
  }

  if (type === VAULT_MSG.STATUS) {
    return vaultStatus();
  }

  if (type === VAULT_MSG.QUERY) {
    const pageUrl = senderPageUrl(sender);
    const status = await vaultStatus();
    if (!pageUrl || !status.unlocked) {
      return { ...status, matches: [], autoFill: false };
    }
    const matches = await matchesForUrl(pageUrl);
    return {
      ...status,
      matches: matches.map(summarize),
      autoFill: matches.length === 1,
    };
  }

  if (type === VAULT_MSG.FILL) {
    const pageUrl = senderPageUrl(sender);
    const id = typeof msg.id === 'string' ? msg.id : '';
    if (!pageUrl || !id) return { ok: false };
    const payload = await fillPayloadFor(id, pageUrl);
    if (!payload) return { ok: false };
    return { ok: true, ...payload };
  }

  if (type === VAULT_MSG.STAGE) {
    const pending = pendingFromSender(msg.pending, sender);
    if (!pending || !pending.username || !pending.password) return { ok: false };
    await stagePending(pending);
    return { ok: true };
  }

  if (type === VAULT_MSG.SAVE) {
    const pending = pendingFromSender(msg.pending, sender);
    if (!pending) return { ok: false, error: '无法确认当前页面来源。' };
    try {
      await saveLogin({
        title: pending.host,
        origin: pending.origin,
        host: pending.host,
        scheme: pending.scheme,
        url: pending.url,
        username: pending.username,
        password: pending.password,
        notes: '',
      });
      await dismissPending();
      return { ok: true };
    } catch (err) {
      const locked = err instanceof Error && err.message.includes('锁定');
      if (locked) {
        await stagePending(pending);
        return { ok: false, needsUnlock: true };
      }
      return { ok: false };
    }
  }

  if (type === VAULT_MSG.GET_PENDING) {
    return { pending: await readPending() };
  }

  if (type === VAULT_MSG.DISMISS_PENDING) {
    await dismissPending();
    return { ok: true };
  }

  if (type === VAULT_MSG.DO_FILL) {
    return { ok: true };
  }

  return undefined;
}

export { senderPageUrl };
