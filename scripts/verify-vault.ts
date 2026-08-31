import {
  createVaultMeta,
  decryptLogin,
  encryptLogin,
  unlockDekFromMeta,
} from '../src/lib/vault/crypto.ts';
import { bytesToUtf8 } from '../src/lib/vault/encoding.ts';
import { parsePageTarget, recordMatchesPage } from '../src/lib/vault/match.ts';
import type { LoginRecord } from '../src/lib/vault/types.ts';

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
