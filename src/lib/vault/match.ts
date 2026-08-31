import type { LoginScheme, LoginRecord } from './types';

export interface PageTarget {
  url: string;
  origin: string;
  host: string;
  scheme: LoginScheme;
}

export function parsePageTarget(raw: string | undefined | null): PageTarget | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (!url.hostname) return null;
    return {
      url: url.href,
      origin: url.origin,
      host: url.hostname.toLowerCase(),
      scheme: url.protocol,
    };
  } catch {
    return null;
  }
}

/**
 * Exact hostname + scheme match only.
 * github.com does not fill gist.github.com.
 * evil.com does not fill a.evil.com.
 * https records never fill http pages.
 * No substring / suffix / eTLD+1 matching.
 */
export function recordMatchesPage(
  record: Pick<LoginRecord, 'host' | 'scheme' | 'origin'>,
  page: PageTarget,
  mode: 'host' | 'origin' = 'host',
): boolean {
  if (record.host !== page.host) return false;
  if (record.scheme !== page.scheme) return false;
  if (mode === 'origin' && record.origin !== page.origin) return false;
  return true;
}

/**
 * Exact hostname + scheme only (same rule as autofill).
 * Any login for that host+scheme means the site is already in the vault:
 * github.com does not cover gist.github.com; https does not cover http.
 */
export function siteAlreadyInVault(
  pending: Pick<PageTarget, 'host' | 'scheme'>,
  records: Array<Pick<LoginRecord, 'host' | 'scheme'>>,
): boolean {
  return records.some((row) => row.host === pending.host && row.scheme === pending.scheme);
}

export function toLoginTarget(
  rawUrl: string,
  title?: string,
): Omit<LoginRecord, 'id' | 'username' | 'password' | 'notes' | 'createdAt' | 'updatedAt'> | null {
  const page = parsePageTarget(rawUrl);
  if (!page) return null;
  let derivedTitle = title?.trim() || '';
  if (!derivedTitle) derivedTitle = page.host;
  return {
    title: derivedTitle,
    origin: page.origin,
    host: page.host,
    scheme: page.scheme,
    url: page.url,
  };
}

export function summarize(
  record: LoginRecord,
): Pick<LoginRecord, 'id' | 'title' | 'origin' | 'host' | 'scheme' | 'url' | 'username'> {
  return {
    id: record.id,
    title: record.title,
    origin: record.origin,
    host: record.host,
    scheme: record.scheme,
    url: record.url,
    username: record.username,
  };
}
