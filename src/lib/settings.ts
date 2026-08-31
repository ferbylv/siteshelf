import { DEFAULT_AI_SETTINGS, type AiSettings } from './types';

const STORAGE_KEY = 'siteshelf.aiSettings';

export async function loadAiSettings(): Promise<AiSettings> {
  const stored = await browser.storage.local.get(STORAGE_KEY);
  const value = stored[STORAGE_KEY] as Partial<AiSettings> | undefined;
  return { ...DEFAULT_AI_SETTINGS, ...value };
}

export async function saveAiSettings(settings: AiSettings): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEY]: settings });
}
