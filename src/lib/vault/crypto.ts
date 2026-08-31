import { asBufferSource, bytesToUtf8, toArrayBuffer, utf8ToBytes, zeroBytes } from './encoding';
import {
  IV_BYTES,
  KEY_BITS,
  PBKDF2_ITERATIONS,
  SALT_BYTES,
  type LoginRecord,
  type VaultMeta,
} from './types';

const AES = { name: 'AES-GCM', length: KEY_BITS } as const;

function randomBytes(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n));
}

export async function deriveKek(
  masterPassword: string,
  salt: Uint8Array,
  iterations: number,
): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    asBufferSource(utf8ToBytes(masterPassword)),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: asBufferSource(salt),
      iterations,
      hash: 'SHA-256',
    },
    material,
    AES,
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function generateDek(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(AES, true, ['encrypt', 'decrypt']);
}

export async function exportDekRaw(dek: CryptoKey): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.exportKey('raw', dek));
}

export async function importDekRaw(raw: Uint8Array, extractable = true): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', asBufferSource(raw), AES, extractable, [
    'encrypt',
    'decrypt',
  ]);
}

export async function encryptBytes(
  key: CryptoKey,
  plaintext: Uint8Array,
): Promise<{ iv: Uint8Array; ciphertext: Uint8Array }> {
  const iv = randomBytes(IV_BYTES);
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: asBufferSource(iv) },
    key,
    asBufferSource(plaintext),
  );
  return { iv, ciphertext: new Uint8Array(ct) };
}

export async function decryptBytes(
  key: CryptoKey,
  iv: Uint8Array,
  ciphertext: Uint8Array,
): Promise<Uint8Array> {
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: asBufferSource(iv) },
    key,
    asBufferSource(ciphertext),
  );
  return new Uint8Array(pt);
}

export async function wrapDek(
  kek: CryptoKey,
  dek: CryptoKey,
): Promise<{ iv: Uint8Array; wrapped: Uint8Array }> {
  const raw = await exportDekRaw(dek);
  try {
    const { iv, ciphertext } = await encryptBytes(kek, raw);
    return { iv, wrapped: ciphertext };
  } finally {
    zeroBytes(raw);
  }
}

export async function unwrapDek(
  kek: CryptoKey,
  iv: Uint8Array,
  wrapped: Uint8Array,
): Promise<CryptoKey> {
  const raw = await decryptBytes(kek, iv, wrapped);
  try {
    return await importDekRaw(raw, true);
  } finally {
    zeroBytes(raw);
  }
}

export async function createVaultMeta(masterPassword: string): Promise<{
  meta: VaultMeta;
  dek: CryptoKey;
}> {
  const salt = randomBytes(SALT_BYTES);
  const dek = await generateDek();
  const kek = await deriveKek(masterPassword, salt, PBKDF2_ITERATIONS);
  const { iv, wrapped } = await wrapDek(kek, dek);
  const meta: VaultMeta = {
    id: 'vault',
    version: 1,
    kdf: 'PBKDF2-SHA-256',
    iterations: PBKDF2_ITERATIONS,
    salt: toArrayBuffer(salt),
    wrappedDek: toArrayBuffer(wrapped),
    wrappedDekIv: toArrayBuffer(iv),
  };
  return { meta, dek };
}

export async function unlockDekFromMeta(
  masterPassword: string,
  meta: VaultMeta,
): Promise<CryptoKey> {
  const kek = await deriveKek(
    masterPassword,
    new Uint8Array(meta.salt),
    meta.iterations || PBKDF2_ITERATIONS,
  );
  return unwrapDek(kek, new Uint8Array(meta.wrappedDekIv), new Uint8Array(meta.wrappedDek));
}

export async function rewrapDek(
  dek: CryptoKey,
  newPassword: string,
): Promise<VaultMeta> {
  const salt = randomBytes(SALT_BYTES);
  const kek = await deriveKek(newPassword, salt, PBKDF2_ITERATIONS);
  const { iv, wrapped } = await wrapDek(kek, dek);
  return {
    id: 'vault',
    version: 1,
    kdf: 'PBKDF2-SHA-256',
    iterations: PBKDF2_ITERATIONS,
    salt: toArrayBuffer(salt),
    wrappedDek: toArrayBuffer(wrapped),
    wrappedDekIv: toArrayBuffer(iv),
  };
}

export async function encryptLogin(
  dek: CryptoKey,
  record: LoginRecord,
): Promise<{ iv: ArrayBuffer; ciphertext: ArrayBuffer }> {
  const payload = utf8ToBytes(JSON.stringify(record));
  try {
    const { iv, ciphertext } = await encryptBytes(dek, payload);
    return { iv: toArrayBuffer(iv), ciphertext: toArrayBuffer(ciphertext) };
  } finally {
    zeroBytes(payload);
  }
}

export async function decryptLogin(
  dek: CryptoKey,
  iv: ArrayBuffer,
  ciphertext: ArrayBuffer,
): Promise<LoginRecord> {
  const bytes = await decryptBytes(dek, new Uint8Array(iv), new Uint8Array(ciphertext));
  try {
    const parsed = JSON.parse(bytesToUtf8(bytes)) as LoginRecord;
    if (!parsed || typeof parsed.id !== 'string' || typeof parsed.password !== 'string') {
      throw new Error('invalid-record');
    }
    return parsed;
  } finally {
    zeroBytes(bytes);
  }
}

export async function rotateDekAndReencrypt(
  oldDek: CryptoKey,
  records: LoginRecord[],
  newPassword: string,
): Promise<{ meta: VaultMeta; dek: CryptoKey; encrypted: { record: LoginRecord; iv: ArrayBuffer; ciphertext: ArrayBuffer }[] }> {
  const dek = await generateDek();
  const meta = await rewrapDek(dek, newPassword);
  const encrypted = [];
  for (const record of records) {
    const blob = await encryptLogin(dek, record);
    encrypted.push({ record, ...blob });
  }
  void oldDek;
  return { meta, dek, encrypted };
}
