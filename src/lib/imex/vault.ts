import { csvCell, csvHeaderMap, parseCsv } from './csv';
import { bytesToBase64, base64ToBytes, toArrayBuffer } from '../vault/encoding';
import { parsePageTarget } from '../vault/match';
import type {
  LoginDraft,
  LoginRecord,
  StoredVaultRecord,
  VaultMeta,
} from '../vault/types';

export const VAULT_BACKUP_KIND = 'siteshelf-vault-backup' as const;

export interface VaultBackupFile {
  kind: typeof VAULT_BACKUP_KIND;
  version: 1;
  exportedAt: string;
  meta: {
    id: 'vault';
    version: 1;
    kdf: 'PBKDF2-SHA-256';
    iterations: number;
    salt: string;
    wrappedDek: string;
    wrappedDekIv: string;
  };
  records: Array<{
    id: string;
    iv: string;
    ciphertext: string;
    createdAt: number;
    updatedAt: number;
  }>;
}

export interface BitwardenExportFile {
  encrypted: false;
  folders: [];
  items: Array<{
    type: 1;
    name: string;
    notes: string;
    login: {
      username: string;
      password: string;
      uris: Array<{ uri: string; match: null }>;
    };
  }>;
}

export interface ParsedVaultBackup {
  kind: 'backup';
  meta: VaultMeta;
  records: StoredVaultRecord[];
}

export interface ParsedVaultDrafts {
  kind: 'drafts';
  drafts: LoginDraft[];
  skipped: number;
}

export type ParsedVaultImport = ParsedVaultBackup | ParsedVaultDrafts;

function bufToB64(buf: ArrayBuffer): string {
  return bytesToBase64(new Uint8Array(buf));
}

function b64ToBuf(b64: string): ArrayBuffer {
  if (typeof b64 !== 'string' || !b64) {
    throw new Error('备份字段缺失。');
  }
  return toArrayBuffer(base64ToBytes(b64));
}

export function serializeVaultBackup(
  meta: VaultMeta,
  records: StoredVaultRecord[],
  exportedAt = new Date().toISOString(),
): VaultBackupFile {
  return {
    kind: VAULT_BACKUP_KIND,
    version: 1,
    exportedAt,
    meta: {
      id: 'vault',
      version: 1,
      kdf: 'PBKDF2-SHA-256',
      iterations: meta.iterations,
      salt: bufToB64(meta.salt),
      wrappedDek: bufToB64(meta.wrappedDek),
      wrappedDekIv: bufToB64(meta.wrappedDekIv),
    },
    records: records.map((row) => ({
      id: row.id,
      iv: bufToB64(row.iv),
      ciphertext: bufToB64(row.ciphertext),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })),
  };
}

export function parseVaultBackup(raw: unknown): { meta: VaultMeta; records: StoredVaultRecord[] } {
  if (!raw || typeof raw !== 'object') throw new Error('无法解析保险库备份。');
  const obj = raw as Record<string, unknown>;
  if (obj.kind !== VAULT_BACKUP_KIND) throw new Error('不是页架加密备份。');
  const metaRaw = obj.meta as Record<string, unknown> | undefined;
  if (!metaRaw) throw new Error('备份缺少 meta。');
  const iterations = Number(metaRaw.iterations);
  if (!Number.isFinite(iterations) || iterations < 1) {
    throw new Error('备份迭代次数无效。');
  }
  const meta: VaultMeta = {
    id: 'vault',
    version: 1,
    kdf: 'PBKDF2-SHA-256',
    iterations,
    salt: b64ToBuf(String(metaRaw.salt ?? '')),
    wrappedDek: b64ToBuf(String(metaRaw.wrappedDek ?? '')),
    wrappedDekIv: b64ToBuf(String(metaRaw.wrappedDekIv ?? '')),
  };
  const rows = Array.isArray(obj.records) ? obj.records : [];
  const records: StoredVaultRecord[] = rows.map((row) => {
    const item = row as Record<string, unknown>;
    if (typeof item.id !== 'string' || !item.id) throw new Error('备份记录缺少 id。');
    return {
      id: item.id,
      iv: b64ToBuf(String(item.iv ?? '')),
      ciphertext: b64ToBuf(String(item.ciphertext ?? '')),
      createdAt: typeof item.createdAt === 'number' ? item.createdAt : 0,
      updatedAt: typeof item.updatedAt === 'number' ? item.updatedAt : 0,
    };
  });
  return { meta, records };
}

export function loginsToBitwarden(logins: LoginRecord[]): BitwardenExportFile {
  return {
    encrypted: false,
    folders: [],
    items: logins.map((row) => ({
      type: 1 as const,
      name: row.title || row.host,
      notes: row.notes || '',
      login: {
        username: row.username,
        password: row.password,
        uris: [{ uri: row.url, match: null }],
      },
    })),
  };
}

function firstHttpUri(value: unknown): string {
  const candidates: string[] = [];
  if (typeof value === 'string') candidates.push(value);
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === 'string') candidates.push(item);
      else if (item && typeof item === 'object' && typeof (item as { uri?: unknown }).uri === 'string') {
        candidates.push((item as { uri: string }).uri);
      }
    }
  }
  for (const raw of candidates) {
    for (const piece of raw.split(/[\s,]+/)) {
      const page = parsePageTarget(piece);
      if (page) return page.url;
    }
  }
  return '';
}

function draftFromParts(
  url: string,
  username: string,
  password: string,
  title = '',
  notes = '',
): LoginDraft | null {
  if (!password) return null;
  const page = parsePageTarget(url);
  if (!page) return null;
  return {
    title: title.trim() || page.host,
    origin: page.origin,
    host: page.host,
    scheme: page.scheme,
    url: page.url,
    username,
    password,
    notes,
  };
}

export function parseBitwardenJson(raw: unknown): { drafts: LoginDraft[]; skipped: number } {
  if (!raw || typeof raw !== 'object') throw new Error('无法解析 Bitwarden JSON。');
  const obj = raw as Record<string, unknown>;
  if (obj.encrypted === true) {
    throw new Error('请导出未加密的 JSON。');
  }
  const items = Array.isArray(obj.items) ? obj.items : [];
  const drafts: LoginDraft[] = [];
  let skipped = 0;
  for (const item of items) {
    if (!item || typeof item !== 'object') {
      skipped += 1;
      continue;
    }
    const row = item as Record<string, unknown>;
    const type = row.type;
    if (type !== 1 && type !== 'login' && type !== undefined) {
      skipped += 1;
      continue;
    }
    const login = (row.login ?? {}) as Record<string, unknown>;
    const uri = firstHttpUri(login.uris) || firstHttpUri(login.uri);
    const username = typeof login.username === 'string' ? login.username : '';
    const password = typeof login.password === 'string' ? login.password : '';
    const title = typeof row.name === 'string' ? row.name : '';
    const notes = typeof row.notes === 'string' ? row.notes : '';
    const draft = draftFromParts(uri, username, password, title, notes);
    if (!draft) {
      skipped += 1;
      continue;
    }
    drafts.push(draft);
  }
  return { drafts, skipped };
}

export function parsePasswordCsv(text: string): { drafts: LoginDraft[]; skipped: number } {
  const rows = parseCsv(text);
  if (rows.length < 2) return { drafts: [], skipped: 0 };
  const headers = csvHeaderMap(rows[0]!);
  const has = (name: string) => headers.has(name);
  const isBitwarden = has('login_uri') && has('login_username') && has('login_password');
  const isBrowser = has('url') && has('username') && has('password');
  if (!isBitwarden && !isBrowser) {
    throw new Error('无法识别的 CSV 表头。');
  }

  const drafts: LoginDraft[] = [];
  let skipped = 0;
  for (const row of rows.slice(1)) {
    if (row.every((cell) => !cell.trim())) continue;
    const url = isBitwarden ? csvCell(row, headers, 'login_uri') : csvCell(row, headers, 'url');
    const username = isBitwarden
      ? csvCell(row, headers, 'login_username')
      : csvCell(row, headers, 'username');
    const password = isBitwarden
      ? csvCell(row, headers, 'login_password')
      : csvCell(row, headers, 'password');
    const title = csvCell(row, headers, 'name') || csvCell(row, headers, 'title');
    const notes = csvCell(row, headers, 'notes');
    const draft = draftFromParts(url, username, password, title, notes);
    if (!draft) {
      skipped += 1;
      continue;
    }
    drafts.push(draft);
  }
  return { drafts, skipped };
}

export function detectVaultImport(text: string): ParsedVaultImport {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('文件为空。');
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      throw new Error('JSON 无法解析。');
    }
    if (parsed && typeof parsed === 'object' && (parsed as { kind?: string }).kind === VAULT_BACKUP_KIND) {
      const backup = parseVaultBackup(parsed);
      return { kind: 'backup', ...backup };
    }
    if (parsed && typeof parsed === 'object' && (parsed as { kind?: string }).kind === 'siteshelf-bookmarks') {
      throw new Error('这是页架备份，请在页架中导入。');
    }
    const bw = parseBitwardenJson(parsed);
    return { kind: 'drafts', drafts: bw.drafts, skipped: bw.skipped };
  }
  const csv = parsePasswordCsv(trimmed);
  return { kind: 'drafts', drafts: csv.drafts, skipped: csv.skipped };
}
