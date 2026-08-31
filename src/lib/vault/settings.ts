import {
  DEFAULT_VAULT_SETTINGS,
  type VaultIdleMinutes,
  type VaultSettings,
} from './types';

const STORAGE_KEY = 'siteshelf.vault.settings';

export async function loadVaultSettings(): Promise<VaultSettings> {
  const stored = await browser.storage.local.get(STORAGE_KEY);
  const value = stored[STORAGE_KEY] as Partial<VaultSettings> | undefined;
  const idle = value?.idleMinutes;
  const idleMinutes: VaultIdleMinutes =
    idle === 0 || idle === 5 || idle === 15 || idle === 30
      ? idle
      : DEFAULT_VAULT_SETTINGS.idleMinutes;
  return { idleMinutes };
}

export async function saveVaultSettings(settings: VaultSettings): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEY]: settings });
}
