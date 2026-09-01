import type { LoginScheme, LoginRecord } from './types';

export interface PageTarget {
  url: string;
  origin: string;
  host: string;
  scheme: LoginScheme;
}

export type SiteIdentity = Pick<PageTarget, 'origin' | 'host' | 'scheme'>;

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
 * Hostname plus :port when the port is non-default.
 * Default 80 (http) / 443 (https) are omitted, matching URL origin.
 */
export function displayHost(page: Pick<SiteIdentity, 'host' | 'origin'>): string {
  if (!page.origin) return page.host;
  try {
    const port = new URL(page.origin).port;
    return port ? `${page.host}:${port}` : page.host;
  } catch {
    return page.host;
  }
}

/**
 * Exact origin match: scheme + host + port (URL origin semantics).
 * Non-default ports are distinct (8080 ≠ 3000).
 * Default ports equal omitted: https://example.com === https://example.com:443;
 * http://host === http://host:80.
 * github.com does not fill gist.github.com.
 * evil.com does not fill a.evil.com.
 * https records never fill http pages.
 * No substring / suffix / eTLD+1 matching.
 */
export function recordMatchesPage(
  record: Pick<LoginRecord, 'host' | 'scheme' | 'origin'>,
  page: SiteIdentity,
): boolean {
  if (!record.origin || !page.origin) return false;
  if (record.origin !== page.origin) return false;
  if (record.host !== page.host) return false;
  if (record.scheme !== page.scheme) return false;
  return true;
}

/**
 * Exact origin only (same rule as autofill).
 * Any login for that origin means the site is already in the vault:
 * github.com does not cover gist.github.com; https does not cover http;
 * :8080 does not cover :3000.
 */
export function siteAlreadyInVault(
  pending: SiteIdentity,
  records: Array<Pick<LoginRecord, 'host' | 'scheme' | 'origin'>>,
): boolean {
  return records.some((row) => recordMatchesPage(row, pending));
}

export function toLoginTarget(
  rawUrl: string,
  title?: string,
): Omit<LoginRecord, 'id' | 'username' | 'password' | 'notes' | 'createdAt' | 'updatedAt'> | null {
  const page = parsePageTarget(rawUrl);
  if (!page) return null;
  let derivedTitle = title?.trim() || '';
  if (!derivedTitle) derivedTitle = displayHost(page);
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
