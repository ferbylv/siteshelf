/** AI-assigned categories. 未分类 is reserved for failed classification. */
export const CATEGORIES = [
  '工具',
  '开发',
  '资讯',
  '购物',
  '社交',
  '娱乐',
  '金融',
  '学习',
  '其他',
] as const;

export const UNCATEGORIZED = '未分类';

export const DEFAULT_CATEGORIES: readonly string[] = CATEGORIES;

export type Category = string;

export interface PageMetadata {
  url: string;
  normalizedUrl: string;
  title: string;
  description: string;
  favicon: string;
  ogImage: string;
  excerpt: string;
}

export interface Bookmark {
  id: string;
  url: string;
  normalizedUrl: string;
  title: string;
  description: string;
  favicon: string;
  ogImage: string;
  excerpt: string;
  summary: string;
  category: Category;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export interface AiClassification {
  summary: string;
  category: Category;
  tags: string[];
}

export interface AiSettings {
  /** auto: Prompt API first, then OpenAI-compatible fallback */
  provider: 'auto' | 'prompt-api' | 'openai-compatible';
  apiKey: string;
  baseUrl: string;
  model: string;
}

export const DEFAULT_AI_SETTINGS: AiSettings = {
  provider: 'auto',
  apiKey: '',
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini',
};

export const BOOKMARKS_CHANGED_MESSAGE = 'siteshelf:bookmarks-changed' as const;
