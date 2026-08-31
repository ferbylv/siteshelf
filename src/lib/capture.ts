import { extractPageMetadata, type ExtractedPage } from './extract';
import { isRestrictedUrl, normalizeUrl } from './url';
import type { PageMetadata } from './types';

export class CaptureError extends Error {
  constructor(
    message: string,
    readonly code: 'restricted' | 'no-tab' | 'inject-failed',
  ) {
    super(message);
    this.name = 'CaptureError';
  }
}

export async function getActiveTab() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    throw new CaptureError('没有可用的当前标签页。', 'no-tab');
  }
  return tab;
}

export async function captureActiveTab(): Promise<PageMetadata> {
  const tab = await getActiveTab();
  if (isRestrictedUrl(tab.url)) {
    throw new CaptureError(
      '当前标签页无法读取（浏览器内部页、扩展商店或受保护页面）。请打开普通网页后再试。',
      'restricted',
    );
  }

  let extracted: ExtractedPage | undefined;
  try {
    const results = await browser.scripting.executeScript({
      target: { tabId: tab.id! },
      func: extractPageMetadata,
    });
    extracted = results[0]?.result as ExtractedPage | undefined;
  } catch {
    throw new CaptureError(
      '无法在此页面运行脚本。请打开普通网页后再试。',
      'inject-failed',
    );
  }

  if (!extracted) {
    throw new CaptureError(
      '无法在此页面运行脚本。请打开普通网页后再试。',
      'inject-failed',
    );
  }

  const url = extracted.url || tab.url || '';
  let title = extracted.title || tab.title || '';
  if (!title) {
    try {
      title = new URL(url).hostname;
    } catch {
      title = '未命名页面';
    }
  }

  return {
    url,
    normalizedUrl: normalizeUrl(url),
    title,
    description: extracted.description || '',
    favicon: extracted.favicon || tab.favIconUrl || '',
    ogImage: extracted.ogImage || '',
    excerpt: extracted.excerpt || '',
  };
}
