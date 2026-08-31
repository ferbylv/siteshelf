export type StrengthScore = 0 | 1 | 2 | 3 | 4;

export const STRENGTH_LABELS = ['过短', '弱', '一般', '较好', '强'] as const;

export const STRENGTH_COLOR_VARS = [
  '--danger',
  '--danger',
  '--warn',
  '--ok',
  '--accent',
] as const;

/** Master passwords need at least this score (一般). Login passwords do not. */
export const MIN_MASTER_SCORE: StrengthScore = 2;

const COMMON = new Set(
  [
    'password',
    'password1',
    'passw0rd',
    '123456',
    '1234567',
    '12345678',
    '123456789',
    '1234567890',
    '12345',
    '1234',
    '123123',
    '111111',
    '1111',
    '000000',
    '666666',
    '888888',
    '88888888',
    '654321',
    'qwerty',
    'qwerty123',
    'qwertyuiop',
    'asdfgh',
    'zxcvbn',
    'abc123',
    'admin',
    'admin123',
    'letmein',
    'welcome',
    'iloveyou',
    'monkey',
    'dragon',
    'master',
    'login',
    'root',
    'guest',
    '1q2w3e',
    '密码',
    '密码123',
    'woaini',
    '5201314',
  ].map((s) => s.toLowerCase()),
);

const KEYBOARD_SEQ = [
  'abcdefghijklmnopqrstuvwxyz',
  'zyxwvutsrqponmlkjihgfedcba',
  '0123456789',
  '9876543210',
  'qwertyuiopasdfghjklzxcvbnm',
  'qwertyuiop',
  'asdfghjkl',
  'zxcvbnm',
];

export interface PasswordStrength {
  score: StrengthScore;
  label: (typeof STRENGTH_LABELS)[StrengthScore];
  colorVar: (typeof STRENGTH_COLOR_VARS)[number];
}

function charsetClasses(password: string): number {
  let n = 0;
  if (/[a-z]/.test(password)) n += 1;
  if (/[A-Z]/.test(password)) n += 1;
  if (/\d/.test(password)) n += 1;
  if (/[^A-Za-z0-9]/.test(password)) n += 1;
  return n;
}

function hasRepeatRun(password: string): boolean {
  return /(.)\1{2,}/.test(password);
}

function hasSequence(password: string): boolean {
  const lower = password.toLowerCase();
  for (const seq of KEYBOARD_SEQ) {
    for (let i = 0; i <= seq.length - 3; i++) {
      if (lower.includes(seq.slice(i, i + 3))) return true;
    }
  }
  for (let i = 0; i <= password.length - 3; i++) {
    const a = password.charCodeAt(i);
    const b = password.charCodeAt(i + 1);
    const c = password.charCodeAt(i + 2);
    if (b - a === 1 && c - b === 1) return true;
    if (a - b === 1 && b - c === 1) return true;
  }
  return false;
}

function isCommon(password: string): boolean {
  const lower = password.toLowerCase();
  if (COMMON.has(lower)) return true;
  const stripped = lower.replace(/[\d!@#$%^&*_+=\-]+$/g, '');
  if (stripped && COMMON.has(stripped) && stripped.length >= 4) return true;
  return false;
}

function pack(score: number): PasswordStrength {
  const clamped = Math.max(0, Math.min(4, Math.round(score))) as StrengthScore;
  return {
    score: clamped,
    label: STRENGTH_LABELS[clamped],
    colorVar: STRENGTH_COLOR_VARS[clamped],
  };
}

export function scorePassword(password: string): PasswordStrength {
  if (!password || password.length < 8) return pack(0);

  if (isCommon(password)) {
    return pack(password.length < 10 ? 0 : 1);
  }

  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 10) score += 1;
  if (password.length >= 14) score += 1;
  if (password.length >= 18) score += 1;

  const classes = charsetClasses(password);
  if (classes >= 2) score += 1;
  if (classes >= 3) score += 1;
  if (classes >= 4) score += 1;

  if (hasRepeatRun(password)) score -= 1;
  if (hasSequence(password)) score -= 1;

  if (classes <= 1) score = Math.min(score, 1);
  if (password.length < 10) score = Math.min(score, 1);

  if (password.length >= 18 && classes >= 4) {
    score = Math.max(score, 4);
  }

  return pack(score);
}

export function masterPasswordMeetsPolicy(
  password: string,
  minLength: number,
): boolean {
  return (
    password.length >= minLength && scorePassword(password).score >= MIN_MASTER_SCORE
  );
}
