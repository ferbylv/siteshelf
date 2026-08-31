const LOWER = 'abcdefghijkmnopqrstuvwxyz';
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGITS = '23456789';
const SYMBOLS = '!@#$%^&*+-_=';
const ALPHABET = LOWER + UPPER + DIGITS + SYMBOLS;

function pickIndex(max: number): number {
  const cap = Math.floor(256 / max) * max;
  while (true) {
    const byte = crypto.getRandomValues(new Uint8Array(1))[0]!;
    if (byte < cap) return byte % max;
  }
}

function pickChar(alphabet: string): string {
  return alphabet[pickIndex(alphabet.length)]!;
}

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = pickIndex(i + 1);
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}

/** Optional helper. Not required for save/fill. Always includes 4 character classes. */
export function generatePassword(length = 18): string {
  const size = Math.min(64, Math.max(12, length));
  const out: string[] = [
    pickChar(LOWER),
    pickChar(UPPER),
    pickChar(DIGITS),
    pickChar(SYMBOLS),
  ];
  while (out.length < size) out.push(pickChar(ALPHABET));
  return shuffle(out).join('');
}
