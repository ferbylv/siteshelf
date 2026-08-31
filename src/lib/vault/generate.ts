const ALPHABET =
  'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%^&*+-_=';

/** Optional helper. Not required for save/fill. */
export function generatePassword(length = 18): string {
  const size = Math.min(64, Math.max(12, length));
  const out: string[] = [];
  while (out.length < size) {
    const buf = crypto.getRandomValues(new Uint8Array(size));
    for (const byte of buf) {
      if (byte! >= Math.floor(256 / ALPHABET.length) * ALPHABET.length) continue;
      out.push(ALPHABET[byte! % ALPHABET.length]!);
      if (out.length >= size) break;
    }
  }
  return out.join('');
}
