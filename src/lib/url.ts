const TRACKING_PARAM =
  /^(utm_|utm$|fbclid|gclid|gclsrc|dclid|msclkid|mc_eid|mc_cid|igshid|si|spm|from$|clid|yclid|wickedid|twclid|ref$|ref_src|ref_url)$/i;

export function normalizeUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return raw.trim();
  }

  url.hash = '';
  url.hostname = url.hostname.toLowerCase();

  if (
    (url.protocol === 'http:' && url.port === '80') ||
    (url.protocol === 'https:' && url.port === '443')
  ) {
    url.port = '';
  }

  const params = new URLSearchParams(url.search);
  for (const key of [...params.keys()]) {
    if (TRACKING_PARAM.test(key)) params.delete(key);
  }
  const qs = params.toString();
  url.search = qs ? `?${qs}` : '';

  if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
    url.pathname = url.pathname.slice(0, -1);
  }

  return url.toString();
}

export function isRestrictedUrl(raw: string | undefined | null): boolean {
  if (!raw) return true;
  try {
    const u = new URL(raw);
    if (
      [
        'chrome:',
        'chrome-extension:',
        'edge:',
        'about:',
        'devtools:',
        'view-source:',
        'data:',
        'blob:',
        'file:',
        'javascript:',
      ].includes(u.protocol)
    ) {
      return true;
    }
    if (u.hostname === 'chrome.google.com' && u.pathname.includes('webstore')) {
      return true;
    }
    if (u.hostname === 'chromewebstore.google.com') return true;
    return false;
  } catch {
    return true;
  }
}

export function hostnameOf(raw: string): string {
  try {
    return new URL(raw).hostname;
  } catch {
    return raw;
  }
}
