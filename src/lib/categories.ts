import { remapCategory } from './db';
import { CATEGORIES, UNCATEGORIZED } from './types';

export const DEFAULT_CATEGORIES: readonly string[] = CATEGORIES;
export { UNCATEGORIZED };

export const CATEGORIES_STORAGE_KEY = 'siteshelf.categories';
export const ALL_FILTER = '全部';
export const FALLBACK_CATEGORY = '其他';

export interface CategoryStore {
  getCustom(): Promise<string[]>;
  setCustom(names: string[]): Promise<void>;
}

export function createMemoryCategoryStore(initial: string[] = []): CategoryStore {
  let data = sanitizeCustomList(initial);
  return {
    async getCustom() {
      return [...data];
    },
    async setCustom(names) {
      data = sanitizeCustomList(names);
    },
  };
}

function reservedNames(): Set<string> {
  return new Set<string>([...DEFAULT_CATEGORIES, UNCATEGORIZED, ALL_FILTER]);
}

export function sanitizeCustomList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = reservedNames();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const name = item.trim();
    if (name.length < 1 || name.length > 12) continue;
    if (seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}

export function normalizeCategoryName(raw: string): string | null {
  const name = raw.trim();
  if (name.length < 1 || name.length > 12) return null;
  return name;
}

async function loadCustom(store?: CategoryStore): Promise<string[]> {
  if (store) return sanitizeCustomList(await store.getCustom());
  try {
    const stored = await browser.storage.local.get(CATEGORIES_STORAGE_KEY);
    return sanitizeCustomList(stored[CATEGORIES_STORAGE_KEY]);
  } catch {
    return [];
  }
}

async function saveCustom(names: string[], store?: CategoryStore): Promise<void> {
  const clean = sanitizeCustomList(names);
  if (store) {
    await store.setCustom(clean);
    return;
  }
  await browser.storage.local.set({ [CATEGORIES_STORAGE_KEY]: clean });
}

export async function listCustomCategories(store?: CategoryStore): Promise<string[]> {
  return loadCustom(store);
}

/** Built-in defaults plus user-created names. Does not include 未分类 or 全部. */
export async function listCategoryNames(store?: CategoryStore): Promise<string[]> {
  const custom = await loadCustom(store);
  return [...DEFAULT_CATEGORIES, ...custom];
}

/** Categories allowed in AI output (defaults + custom, always includes 其他). */
export async function listClassifyCategories(store?: CategoryStore): Promise<string[]> {
  const names = await listCategoryNames(store);
  if (!names.includes(FALLBACK_CATEGORY)) names.push(FALLBACK_CATEGORY);
  return names;
}

export async function addCategory(name: string, store?: CategoryStore): Promise<string> {
  const normalized = normalizeCategoryName(name);
  if (!normalized) throw new Error('分类名需为 1 到 12 个字符。');
  if (reservedNames().has(normalized)) throw new Error('该分类已存在。');
  const custom = await loadCustom(store);
  if (custom.includes(normalized)) throw new Error('该分类已存在。');
  await saveCustom([...custom, normalized], store);
  return normalized;
}

export async function removeCategory(
  name: string,
  opts?: { store?: CategoryStore; remap?: (from: string, to: string) => Promise<void> },
): Promise<void> {
  const normalized = name.trim();
  if (reservedNames().has(normalized)) {
    throw new Error('不能删除内置分类。');
  }
  const custom = await loadCustom(opts?.store);
  const next = custom.filter((item) => item !== normalized);
  await saveCustom(next, opts?.store);
  if (opts?.remap) {
    await opts.remap(normalized, FALLBACK_CATEGORY);
    return;
  }
  try {
    await remapCategory(normalized, FALLBACK_CATEGORY);
  } catch {
    /* unit tests / no IndexedDB */
  }
}
