import {
  createVaultMeta,
  decryptLogin,
  encryptLogin,
  unlockDekFromMeta,
} from '../src/lib/vault/crypto.ts';
import { bytesToUtf8 } from '../src/lib/vault/encoding.ts';
import { parsePageTarget, recordMatchesPage } from '../src/lib/vault/match.ts';
import type { LoginRecord } from '../src/lib/vault/types.ts';
import {
  asPendingMap,
  mergePendingForSave,
  pendingForTab,
  stagePendingFromSender,
} from '../src/lib/vault/pending.ts';

const TEST_PASSWORD = 'correct-horse-test-password-ok';
const LOGIN_SECRET = 'SuperSecretLoginPassw0rd!';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const record: LoginRecord = {
  id: 'rec-1',
  title: 'Test Site',
  origin: 'https://github.com',
  host: 'github.com',
  scheme: 'https:',
  url: 'https://github.com/login',
  username: 'octocat',
  password: LOGIN_SECRET,
  notes: 'do-not-leak',
  createdAt: 1,
  updatedAt: 1,
};

const { meta, dek } = await createVaultMeta(TEST_PASSWORD);
const blob = await encryptLogin(dek, record);

const cipherText = bytesToUtf8(new Uint8Array(blob.ciphertext)).replace(/\0/g, '');
assert(!cipherText.includes(LOGIN_SECRET), 'ciphertext must not contain the login password');
assert(!cipherText.includes(TEST_PASSWORD), 'ciphertext must not contain the master password');
assert(
  !new Uint8Array(meta.wrappedDek).length ||
    !bytesToUtf8(new Uint8Array(meta.wrappedDek)).includes(TEST_PASSWORD),
  'wrapped DEK must not contain the master password',
);

const roundtrip = await decryptLogin(dek, blob.iv, blob.ciphertext);
assert(roundtrip.password === LOGIN_SECRET, 'decrypt must restore the password');
assert(roundtrip.username === 'octocat', 'decrypt must restore the username');

let wrongFailed = false;
try {
  await unlockDekFromMeta('wrong-password-that-is-long', meta);
} catch {
  wrongFailed = true;
}
assert(wrongFailed, 'wrong master password must fail closed');

const dek2 = await unlockDekFromMeta(TEST_PASSWORD, meta);
const again = await decryptLogin(dek2, blob.iv, blob.ciphertext);
assert(again.password === LOGIN_SECRET, 'unlock with correct password must work');

const gh = parsePageTarget('https://github.com/login')!;
const gist = parsePageTarget('https://gist.github.com')!;
const httpGh = parsePageTarget('http://github.com/login')!;
const sub = parsePageTarget('https://a.evil.com/')!;
const evil = parsePageTarget('https://evil.com/')!;

assert(recordMatchesPage(record, gh), 'exact host https should match');
assert(!recordMatchesPage(record, gist), 'github.com must not fill gist.github.com');
assert(!recordMatchesPage(record, httpGh), 'https record must not fill http');
assert(
  !recordMatchesPage({ host: 'evil.com', scheme: 'https:', origin: 'https://evil.com' }, sub),
  'evil.com must not fill a.evil.com',
);
assert(
  recordMatchesPage({ host: 'evil.com', scheme: 'https:', origin: 'https://evil.com' }, evil),
  'exact evil.com should match itself',
);

console.log('verify-vault: ok');

const now = Date.now();
const loginPending = {
  origin: 'https://login.example.com',
  host: 'login.example.com',
  scheme: 'https:' as const,
  url: 'https://login.example.com/signin',
  username: 'tester',
  password: LOGIN_SECRET,
  capturedAt: now,
  tabId: 11,
};

const map = asPendingMap({
  '11': loginPending,
  '12': { ...loginPending, tabId: 12, origin: 'https://other.example.com', host: 'other.example.com' },
  '99': { ...loginPending, tabId: 11 },
});
assert(pendingForTab(map, 11)?.host === 'login.example.com', 'tab 11 should see its pending');
assert(!pendingForTab(map, 12) || pendingForTab(map, 12)?.host === 'other.example.com', 'tab 12 is isolated');
assert(pendingForTab(map, 12)?.host === 'other.example.com', 'tab 12 should see only its own host');
assert(!pendingForTab(map, 7), 'other tabs must not see pending');
assert(!map['99'], 'mismatched tabId in payload must be dropped');

const staged = stagePendingFromSender(
  { ...loginPending, tabId: 99 },
  11,
  'https://login.example.com/signin',
  now,
);
assert(staged?.tabId === 11, 'STAGE tabId comes from sender, not payload');
assert(staged?.origin === 'https://login.example.com', 'STAGE keeps login origin');
assert(
  !stagePendingFromSender(loginPending, 11, 'https://app.example.com/home', now),
  'STAGE must reject when the sending page origin does not match the capture',
);

const afterRedirect = mergePendingForSave(
  { ...loginPending, tabId: 11 },
  {
    ...loginPending,
    origin: 'https://app.example.com',
    host: 'app.example.com',
    url: 'https://app.example.com/dashboard',
    username: 'tester',
  },
  11,
  'https://app.example.com/dashboard',
  now,
);
assert(afterRedirect?.origin === 'https://login.example.com', 'SAVE after redirect keeps captured origin');
assert(afterRedirect?.host === 'login.example.com', 'SAVE after redirect keeps captured host');
assert(afterRedirect?.tabId === 11, 'SAVE stays on the capturing tab');
assert(
  !mergePendingForSave(loginPending, loginPending, 12, 'https://login.example.com/signin', now),
  'SAVE must not apply another tab pending',
);
assert(
  !mergePendingForSave(
    undefined,
    {
      ...loginPending,
      origin: 'https://login.example.com',
      host: 'login.example.com',
    },
    11,
    'https://app.example.com/dashboard',
    now,
  ),
  'unstaged SAVE after redirect must fail closed',
);

console.log('verify-vault pending: ok');
