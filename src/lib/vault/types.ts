/** Vault types. Credentials never enter the bookmarks DB or AI prompts. */

export const VAULT_DB_NAME = 'siteshelf-vault';
export const VAULT_DB_VERSION = 1;
export const META_STORE = 'meta';
export const RECORDS_STORE = 'records';

export const MIN_MASTER_LENGTH = 10;
/** OWASP Password Storage Cheat Sheet (2024–2026): PBKDF2-HMAC-SHA-256 ≥ 600,000. */
export const PBKDF2_ITERATIONS = 600_000;
export const SALT_BYTES = 16;
export const IV_BYTES = 12;
export const KEY_BITS = 256;

export const VAULT_CHANGED_MESSAGE = 'siteshelf:vault-changed' as const;
export const VAULT_SESSION_MESSAGE = 'siteshelf:vault-session' as const;
export const VAULT_PENDING_MESSAGE = 'siteshelf:vault-pending' as const;

export type VaultIdleMinutes = 0 | 5 | 15 | 30;

export interface VaultSettings {
  /** 0 = keep unlocked until the browser session ends. */
  idleMinutes: VaultIdleMinutes;
}

export const DEFAULT_VAULT_SETTINGS: VaultSettings = {
  idleMinutes: 15,
};

export type LoginScheme = 'http:' | 'https:';

/** Plaintext login. Only in memory after unlock; never written as-is. */
export interface LoginRecord {
  id: string;
  title: string;
  origin: string;
  host: string;
  scheme: LoginScheme;
  url: string;
  username: string;
  password: string;
  notes: string;
  createdAt: number;
  updatedAt: number;
}

export type LoginDraft = Omit<LoginRecord, 'id' | 'createdAt' | 'updatedAt'> & {
  id?: string;
};

export interface LoginSummary {
  id: string;
  title: string;
  origin: string;
  host: string;
  scheme: LoginScheme;
  url: string;
  username: string;
}

export interface VaultMeta {
  id: 'vault';
  version: 1;
  kdf: 'PBKDF2-SHA-256';
  iterations: number;
  salt: ArrayBuffer;
  wrappedDek: ArrayBuffer;
  wrappedDekIv: ArrayBuffer;
}

export interface StoredVaultRecord {
  id: string;
  iv: ArrayBuffer;
  ciphertext: ArrayBuffer;
  createdAt: number;
  updatedAt: number;
}

export interface PendingSave {
  origin: string;
  host: string;
  scheme: LoginScheme;
  url: string;
  username: string;
  password: string;
  capturedAt: number;
  /** Tab that captured the login. Pending is never shown or saved on another tab. */
  tabId: number;
}

export const VAULT_MSG = {
  QUERY: 'siteshelf:vault:query',
  FILL: 'siteshelf:vault:fill',
  SAVE: 'siteshelf:vault:save',
  STAGE: 'siteshelf:vault:stage',
  DISMISS_PENDING: 'siteshelf:vault:dismiss-pending',
  GET_PENDING: 'siteshelf:vault:get-pending',
  STATUS: 'siteshelf:vault:status',
  DO_FILL: 'siteshelf:vault:do-fill',
} as const;

export type VaultMsgType = (typeof VAULT_MSG)[keyof typeof VAULT_MSG];
