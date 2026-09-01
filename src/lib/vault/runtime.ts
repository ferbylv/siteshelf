import { displayHost, summarize } from './match';
import { mergePendingForSave, stagePendingFromSender } from './pending';
import {
  dismissPending,
  fillPayloadFor,
  isSiteAlreadySaved,
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

function senderTabId(sender: Sender): number | undefined {
  const id = sender.tab?.id;
  return typeof id === 'number' && Number.isInteger(id) && id >= 0 ? id : undefined;
}

async function resolveTabId(sender: Sender): Promise<number | undefined> {
  const fromSender = senderTabId(sender);
  if (fromSender != null) return fromSender;
  try {
    const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
    return tab?.id;
  } catch {
    return undefined;
  }
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
    const tabId = senderTabId(sender);
    if (tabId == null) return { ok: false };
    const pending = stagePendingFromSender(msg.pending, tabId, senderPageUrl(sender));
    if (!pending) return { ok: false };
    if (await isSiteAlreadySaved(pending)) {
      await dismissPending(tabId);
      return { ok: true, skipped: true };
    }
    await stagePending(pending);
    return { ok: true };
  }

  if (type === VAULT_MSG.SAVE) {
    const tabId = await resolveTabId(sender);
    if (tabId == null) return { ok: false, error: '无法确认当前标签页。' };
    const staged = await readPending(tabId);
    const pending = mergePendingForSave(staged, msg.pending, tabId, senderPageUrl(sender));
    if (!pending) return { ok: false, error: '没有可保存的登录。' };
    try {
      await saveLogin({
        title: displayHost(pending),
        origin: pending.origin,
        host: pending.host,
        scheme: pending.scheme,
        url: pending.url,
        username: pending.username,
        password: pending.password,
        notes: '',
      });
      await dismissPending(tabId);
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
    const tabId = await resolveTabId(sender);
    if (tabId == null) return { pending: undefined };
    return { pending: await readPending(tabId) };
  }

  if (type === VAULT_MSG.DISMISS_PENDING) {
    const tabId = await resolveTabId(sender);
    if (tabId == null) return { ok: false };
    await dismissPending(tabId);
    return { ok: true };
  }

  if (type === VAULT_MSG.DO_FILL) {
    return { ok: true };
  }

  return undefined;
}

export { senderPageUrl };
export type { PendingSave };
