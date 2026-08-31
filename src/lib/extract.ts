export interface ExtractedPage {
  url: string;
  title: string;
  description: string;
  favicon: string;
  ogImage: string;
  excerpt: string;
}

/**
 * Runs in the page (via scripting.executeScript).
 * Must be self-contained: Chrome only injects this function body.
 * Captures public metadata only — never input values, password fields,
 * hidden fields, or credential-looking snippets.
 */
export function extractPageMetadata(): ExtractedPage {
  const abs = (href: string | null | undefined): string => {
    if (!href) return '';
    try {
      return new URL(href, document.baseURI).href;
    } catch {
      return '';
    }
  };

  const fromSelectors = (selectors: string[], attr: 'content' | 'href'): string => {
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      const value = el?.getAttribute(attr)?.trim();
      if (value) return value;
    }
    return '';
  };

  const title =
    fromSelectors(
      ['meta[property="og:title"]', 'meta[name="twitter:title"]'],
      'content',
    ) ||
    document.title?.trim() ||
    '';

  const description = fromSelectors(
    [
      'meta[property="og:description"]',
      'meta[name="description"]',
      'meta[name="twitter:description"]',
    ],
    'content',
  );

  const ogImage = abs(
    fromSelectors(
      ['meta[property="og:image"]', 'meta[name="twitter:image"]'],
      'content',
    ),
  );

  const favicon = abs(
    fromSelectors(
      [
        'link[rel="apple-touch-icon"]',
        'link[rel="icon"]',
        'link[rel="shortcut icon"]',
      ],
      'href',
    ) || '/favicon.ico',
  );

  const blockedTags = new Set([
    'SCRIPT',
    'STYLE',
    'NOSCRIPT',
    'SVG',
    'CANVAS',
    'IFRAME',
    'OBJECT',
    'INPUT',
    'TEXTAREA',
    'SELECT',
    'BUTTON',
    'OPTION',
    'DATALIST',
  ]);

  const looksCredential = (text: string): boolean => {
    const t = text.trim();
    if (!t) return true;
    return (
      /(?:password|passwd|口令|密码|secret|api[_-]?key|access[_-]?token|bearer\s+[a-z0-9._-]{12,}|authorization:)/i.test(
        t,
      ) && t.length < 240
    );
  };

  const isHiddenOrSensitive = (el: Element): boolean => {
    if (!(el instanceof HTMLElement)) return false;
    if (el.hidden || el.getAttribute('aria-hidden') === 'true') return true;
    if (el.closest('[hidden], [aria-hidden="true"]')) return true;
    if (el.closest('input, textarea, select, option')) return true;
    const form = el.closest('form');
    if (form?.querySelector('input[type="password"]')) return true;
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return true;
    }
    return false;
  };

  const chunks: string[] = [];
  const add = (text: string) => {
    const clean = text.replace(/\s+/g, ' ').trim();
    if (clean.length < 8) return;
    if (looksCredential(clean)) return;
    chunks.push(clean);
  };

  const preferred = document.querySelectorAll('h1, h2, h3, article p, main p, p');
  preferred.forEach((el) => {
    if (blockedTags.has(el.tagName) || isHiddenOrSensitive(el)) return;
    add(el.textContent || '');
  });

  if (chunks.join(' ').length < 80 && document.body) {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const parent = node.parentElement;
      if (!parent || blockedTags.has(parent.tagName) || isHiddenOrSensitive(parent)) {
        continue;
      }
      add(node.textContent || '');
      if (chunks.join(' ').length > 800) break;
    }
  }

  return {
    url: location.href,
    title,
    description,
    favicon,
    ogImage,
    excerpt: chunks.join(' ').slice(0, 500),
  };
}
