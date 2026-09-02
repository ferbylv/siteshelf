import {
  createVaultMeta,
  decryptLogin,
  encryptLogin,
  unlockDekFromMeta,
} from '../src/lib/vault/crypto.ts';
import { bytesToUtf8 } from '../src/lib/vault/encoding.ts';
import { displayHost, parsePageTarget, recordMatchesPage, siteAlreadyInVault } from '../src/lib/vault/match.ts';
import type { LoginRecord } from '../src/lib/vault/types.ts';
import {
  asPendingMap,
  mergePendingForSave,
  pendingForTab,
  pendingMapAfterStage,
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

assert(siteAlreadyInVault(gh, [record]), 'same origin is already in the vault');
assert(
  siteAlreadyInVault(gh, [{ host: 'github.com', scheme: 'https:', origin: 'https://github.com' }]),
  'any login for that origin suppresses, regardless of username',
);
assert(!siteAlreadyInVault(gist, [record]), 'github.com must not suppress gist.github.com');
assert(!siteAlreadyInVault(httpGh, [record]), 'https must not suppress http');
assert(!siteAlreadyInVault(gh, []), 'empty records must not suppress');
assert(
  !siteAlreadyInVault(gh, [{ host: 'github.com', scheme: 'http:', origin: 'http://github.com' }]),
  'http record must not suppress https pending',
);

const lan8080 = parsePageTarget('http://192.168.1.1:8080/login')!;
const lan3000 = parsePageTarget('http://192.168.1.1:3000/login')!;
const recLan8080 = { host: lan8080.host, scheme: lan8080.scheme, origin: lan8080.origin };
assert(lan8080.origin === 'http://192.168.1.1:8080', 'non-default port stays in origin');
assert(lan3000.origin === 'http://192.168.1.1:3000', 'other non-default port is a different origin');
assert(!recordMatchesPage(recLan8080, lan3000), 'same IP different ports must not match/fill');
assert(!siteAlreadyInVault(lan3000, [recLan8080]), 'same IP different ports must not suppress');
assert(recordMatchesPage(recLan8080, lan8080), 'same IP+port should match itself');
assert(displayHost(lan8080) === '192.168.1.1:8080', 'display host includes non-default port');

const loop3000 = parsePageTarget('http://127.0.0.1:3000/')!;
const loopDefault = parsePageTarget('http://127.0.0.1/')!;
const loop80 = parsePageTarget('http://127.0.0.1:80/')!;
const recLoop3000 = { host: loop3000.host, scheme: loop3000.scheme, origin: loop3000.origin };
const recLoopDefault = { host: loopDefault.host, scheme: loopDefault.scheme, origin: loopDefault.origin };
assert(loopDefault.origin === 'http://127.0.0.1', 'http default origin omits :80');
assert(loop80.origin === 'http://127.0.0.1', 'http :80 origin equals omitted port');
assert(loop3000.origin === 'http://127.0.0.1:3000', 'http :3000 origin keeps port');
assert(!recordMatchesPage(recLoop3000, loopDefault), '127.0.0.1:3000 must not match default 80');
assert(!recordMatchesPage(recLoop3000, loop80), '127.0.0.1:3000 must not match :80');
assert(!siteAlreadyInVault(loopDefault, [recLoop3000]), ':3000 must not suppress default 80');
assert(!siteAlreadyInVault(loop80, [recLoop3000]), ':3000 must not suppress :80');

const httpsEx = parsePageTarget('https://example.com/login')!;
const https443 = parsePageTarget('https://example.com:443/login')!;
const recHttpsEx = { host: httpsEx.host, scheme: httpsEx.scheme, origin: httpsEx.origin };
assert(httpsEx.origin === 'https://example.com', 'https default origin omits :443');
assert(https443.origin === 'https://example.com', 'https :443 origin equals omitted port');
assert(recordMatchesPage(recHttpsEx, https443), 'https://example.com must match :443');
assert(siteAlreadyInVault(https443, [recHttpsEx]), 'https default must suppress :443');
assert(displayHost(httpsEx) === 'example.com', 'display host omits default 443');

const httpEx = parsePageTarget('http://example.com/login')!;
const http80 = parsePageTarget('http://example.com:80/login')!;
const recHttpEx = { host: httpEx.host, scheme: httpEx.scheme, origin: httpEx.origin };
assert(httpEx.origin === 'http://example.com', 'http default origin omits :80');
assert(http80.origin === 'http://example.com', 'http :80 origin equals omitted port');
assert(recordMatchesPage(recHttpEx, http80), 'http://example.com must match :80');
assert(siteAlreadyInVault(http80, [recHttpEx]), 'http default must suppress :80');
assert(recordMatchesPage(recLoopDefault, loop80), '127.0.0.1 omitted must match :80');

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

const already = [{ host: loginPending.host, scheme: loginPending.scheme, origin: loginPending.origin }];
const skippedStage = pendingMapAfterStage({ '11': loginPending }, loginPending, siteAlreadyInVault(loginPending, already));
assert(skippedStage.skipped, 'existing site STAGE is skipped');
assert(!skippedStage.map['11'], 'skipped STAGE does not belong in pending map');

const newSiteStage = pendingMapAfterStage({}, loginPending, siteAlreadyInVault(loginPending, []));
assert(!newSiteStage.skipped, 'new site STAGE is not skipped');
assert(newSiteStage.map['11']?.host === 'login.example.com', 'new site STAGE still persists pending');

console.log('verify-vault skip-existing: ok');

import {
  looksLikeCancelActivationLabel,
  looksLikeConfirmOnlyLabel,
  looksLikeLoginActivationLabel,
  normalizeActivationLabel,
  shouldDebounceStage,
} from '../src/lib/vault/capture.ts';

assert(looksLikeLoginActivationLabel('登录'), '登录 is login label');
assert(looksLikeLoginActivationLabel('登陆'), '登陆 is login label');
assert(looksLikeLoginActivationLabel('登入'), '登入 is login label');
assert(looksLikeLoginActivationLabel('Login'), 'Login is login label');
assert(looksLikeLoginActivationLabel('Sign in'), 'Sign in is login label');
assert(looksLikeLoginActivationLabel('Sign In'), 'Sign In is login label');
assert(looksLikeLoginActivationLabel('Log in'), 'Log in is login label');
assert(looksLikeLoginActivationLabel('Submit'), 'Submit is login label');
assert(!looksLikeLoginActivationLabel('确定'), 'bare 确定 is not a login label alone');
assert(looksLikeConfirmOnlyLabel('确定'), '确定 is confirm-only');
assert(looksLikeConfirmOnlyLabel('OK'), 'OK is confirm-only');
assert(looksLikeCancelActivationLabel('取消'), '取消 is cancel');
assert(looksLikeCancelActivationLabel('Cancel'), 'Cancel is cancel');
assert(!looksLikeLoginActivationLabel('取消'), '取消 must not look like login');
assert(normalizeActivationLabel('  Sign   in  ') === 'Sign in', 'normalize collapses space');

let deb = { key: '', at: 0 };
const d1 = shouldDebounceStage(deb, 'https://a.example', 'u', 1000, 1000);
assert(!d1.skip, 'first STAGE is not debounced');
deb = d1.next;
const d2 = shouldDebounceStage(deb, 'https://a.example', 'u', 1500, 1000);
assert(d2.skip, 'duplicate STAGE within 1s is debounced');
const d3 = shouldDebounceStage(deb, 'https://a.example', 'u', 2100, 1000);
assert(!d3.skip, 'STAGE after window is allowed');
const d4 = shouldDebounceStage(d3.next, 'https://a.example', 'other', 2200, 1000);
assert(!d4.skip, 'different username is not debounced');

console.log('verify-vault capture-labels: ok');
