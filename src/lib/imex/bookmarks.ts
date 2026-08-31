import { UNCATEGORIZED, type Bookmark } from '../types';
import { isRestrictedUrl, normalizeUrl, parseHttpUrl } from '../url';

export const BOOKMARKS_EXPORT_KIND = 'siteshelf-bookmarks' as const;

export interface BookmarksExportFile {
  kind: typeof BOOKMARKS_EXPORT_KIND;
  version: 1;
  exportedAt: string;
  categories: string[];
  bookmarks: Bookmark[];
}

export type BookmarkImportDraft = Omit<Bookmark, 'id' | 'createdAt' | 'updatedAt'> & {
  id?: string;
  createdAt?: number;
  updatedAt?: number;
};

export interface ParsedBookmarksImport {
  categories: string[];
  drafts: BookmarkImportDraft[];
  skipped: number;
}

const BOOKMARK_FIELDS = [
  'url',
  'normalizedUrl',
  'title',
  'description',
  'favicon',
  'ogImage',
  'excerpt',
  'summary',
  'category',
  'tags',
] as const;

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((t): t is string => typeof t === 'string')
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 12)
    .map((t) => t.slice(0, 16));
}

function pickBookmark(raw: unknown): BookmarkImportDraft | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const urlRaw = asString(row.url);
  const parsed = parseHttpUrl(urlRaw);
  if (!parsed) return null;
  const href = parsed.toString();
  if (isRestrictedUrl(href)) return null;

  const normalized =
    asString(row.normalizedUrl) || normalizeUrl(href);

  const category = asString(row.category) || UNCATEGORIZED;
  const title = asString(row.title) || parsed.hostname;

  const draft: BookmarkImportDraft = {
    url: href,
    normalizedUrl: normalized,
    title,
    description: asString(row.description),
    favicon: asString(row.favicon),
    ogImage: asString(row.ogImage),
    excerpt: asString(row.excerpt),
    summary: asString(row.summary),
    category,
    tags: asTags(row.tags),
  };

  if (typeof row.id === 'string' && row.id) draft.id = row.id;
  if (typeof row.createdAt === 'number') draft.createdAt = row.createdAt;
  if (typeof row.updatedAt === 'number') draft.updatedAt = row.updatedAt;

  void BOOKMARK_FIELDS;
  return draft;
}

export function serializeBookmarksExport(input: {
  categories: string[];
  bookmarks: Bookmark[];
  exportedAt?: string;
}): BookmarksExportFile {
  return {
    kind: BOOKMARKS_EXPORT_KIND,
    version: 1,
    exportedAt: input.exportedAt ?? new Date().toISOString(),
    categories: [...input.categories],
    bookmarks: input.bookmarks.map((item) => ({
      id: item.id,
      url: item.url,
      normalizedUrl: item.normalizedUrl,
      title: item.title,
      description: item.description,
      favicon: item.favicon,
      ogImage: item.ogImage,
      excerpt: item.excerpt,
      summary: item.summary,
      category: item.category,
      tags: [...item.tags],
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    })),
  };
}

export function parseBookmarksImport(raw: unknown): ParsedBookmarksImport {
  let categories: string[] = [];
  let rows: unknown[] = [];

  if (Array.isArray(raw)) {
    rows = raw;
  } else if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if (obj.kind != null && obj.kind !== BOOKMARKS_EXPORT_KIND) {
      throw new Error('不是页架书签导出文件。');
    }
    if (Array.isArray(obj.bookmarks)) {
      rows = obj.bookmarks;
    } else {
      throw new Error('书签文件缺少 bookmarks 数组。');
    }
    if (Array.isArray(obj.categories)) {
      categories = obj.categories.filter((c): c is string => typeof c === 'string');
    }
  } else {
    throw new Error('无法解析书签文件。');
  }

  const drafts: BookmarkImportDraft[] = [];
  let skipped = 0;
  for (const row of rows) {
    const draft = pickBookmark(row);
    if (!draft) {
      skipped += 1;
      continue;
    }
    drafts.push(draft);
  }
  return { categories, drafts, skipped };
}

export function mergeBookmarksByNormalizedUrl(
  existing: Bookmark[],
  incoming: BookmarkImportDraft[],
  now = Date.now(),
): Bookmark[] {
  const byNorm = new Map(existing.map((item) => [item.normalizedUrl, item]));
  const usedIds = new Set(existing.map((item) => item.id));
  const result = existing.map((item) => ({ ...item, tags: [...item.tags] }));

  for (const draft of incoming) {
    const prev = byNorm.get(draft.normalizedUrl);
    if (prev) {
      const merged: Bookmark = {
        ...prev,
        url: draft.url || prev.url,
        normalizedUrl: prev.normalizedUrl,
        title: draft.title || prev.title,
        description: draft.description || prev.description,
        favicon: draft.favicon || prev.favicon,
        ogImage: draft.ogImage || prev.ogImage,
        excerpt: draft.excerpt || prev.excerpt,
        summary: draft.summary || prev.summary,
        category: draft.category || prev.category,
        tags: draft.tags.length ? draft.tags : prev.tags,
        id: prev.id,
        createdAt: prev.createdAt,
        updatedAt: now,
      };
      const idx = result.findIndex((row) => row.id === prev.id);
      if (idx >= 0) result[idx] = merged;
      byNorm.set(merged.normalizedUrl, merged);
      continue;
    }

    let id = draft.id && !usedIds.has(draft.id) ? draft.id : crypto.randomUUID();
    usedIds.add(id);
    const created: Bookmark = {
      id,
      url: draft.url,
      normalizedUrl: draft.normalizedUrl,
      title: draft.title,
      description: draft.description,
      favicon: draft.favicon,
      ogImage: draft.ogImage,
      excerpt: draft.excerpt,
      summary: draft.summary,
      category: draft.category,
      tags: [...draft.tags],
      createdAt: draft.createdAt ?? now,
      updatedAt: now,
    };
    result.push(created);
    byNorm.set(created.normalizedUrl, created);
  }
  return result;
}
