import {
  addCategory,
  createMemoryCategoryStore,
  listCategoryNames,
  listCustomCategories,
  removeCategory,
} from '../src/lib/categories.ts';
import {
  mergeBookmarksByNormalizedUrl,
  parseBookmarksImport,
  serializeBookmarksExport,
} from '../src/lib/imex/bookmarks.ts';
import {
  detectVaultImport,
  parseBitwardenJson,
  parsePasswordCsv,
  parseVaultBackup,
  serializeVaultBackup,
} from '../src/lib/imex/vault.ts';
import { masterPasswordMeetsPolicy, scorePassword } from '../src/lib/password-strength.ts';
import { promptApiSessionOptions } from '../src/lib/prompt-api.ts';
import { createVaultMeta, decryptLogin, encryptLogin, unlockDekFromMeta } from '../src/lib/vault/crypto.ts';
import { generatePassword } from '../src/lib/vault/generate.ts';
import { MIN_MASTER_LENGTH, type LoginRecord } from '../src/lib/vault/types.ts';
import type { Bookmark } from '../src/lib/types.ts';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const TEST_PASSWORD = 'correct-horse-test-password-ok';
const LOGIN_SECRET = 'SuperSecretLoginPassw0rd!';

const bwJson = {
  encrypted: false,
  folders: [],
  items: [
    {
      type: 1,
      name: 'GitHub',
      notes: 'dev',
      login: {
        username: 'octocat',
        password: LOGIN_SECRET,
        uris: [{ uri: 'https://github.com/login', match: null }],
      },
    },
    {
      type: 2,
      name: 'note only',
      notes: 'should skip',
    },
    {
      type: 1,
      name: 'empty pass',
      login: { username: 'x', password: '', uris: [{ uri: 'https://example.com' }] },
    },
  ],
};

const { drafts: bwDrafts, skipped: bwSkipped } = parseBitwardenJson(bwJson);
assert(bwDrafts.length === 1, 'bitwarden json should yield one login');
assert(bwDrafts[0]!.host === 'github.com', 'bitwarden json host');
assert(bwDrafts[0]!.scheme === 'https:', 'bitwarden json scheme');
assert(bwDrafts[0]!.username === 'octocat', 'bitwarden json username');
assert(bwDrafts[0]!.password === LOGIN_SECRET, 'bitwarden json password');
assert(bwSkipped >= 2, 'notes and empty password skipped');

let encryptedRejected = false;
try {
  parseBitwardenJson({ encrypted: true, items: [] });
} catch (err) {
  encryptedRejected = err instanceof Error && err.message.includes('未加密');
}
assert(encryptedRejected, 'encrypted bitwarden json must be rejected');

const bwCsv = [
  'folder,favorite,type,name,notes,fields,reprompt,login_uri,login_username,login_password,login_totp',
  ',false,login,GitHub,dev,,0,https://github.com,octocat,' + LOGIN_SECRET + ',',
  ',false,login,Skip,,,0,https://example.com,nobody,,',
].join('\n');
const bwCsvParsed = parsePasswordCsv(bwCsv);
assert(bwCsvParsed.drafts.length === 1, 'bitwarden csv one login');
assert(bwCsvParsed.drafts[0]!.host === 'github.com', 'bitwarden csv host');
assert(bwCsvParsed.drafts[0]!.username === 'octocat', 'bitwarden csv username');
assert(bwCsvParsed.drafts[0]!.password === LOGIN_SECRET, 'bitwarden csv password');

const chromeCsv = [
  'name,url,username,password',
  'GitHub,https://github.com,octocat,' + LOGIN_SECRET,
  '"Acme, Inc","https://acme.example/login","user,name","pass""word"',
].join('\n');
const chromeParsed = parsePasswordCsv(chromeCsv);
assert(chromeParsed.drafts.length === 2, 'chrome csv two logins');
assert(chromeParsed.drafts[0]!.host === 'github.com', 'chrome csv host');
assert(chromeParsed.drafts[1]!.username === 'user,name', 'quoted username');
assert(chromeParsed.drafts[1]!.password === 'pass"word', 'escaped quotes in password');
assert(chromeParsed.drafts[1]!.title === 'Acme, Inc', 'quoted name with comma');

const firefoxCsv = ['url,username,password', 'https://firefox.example,ff,secret-ff'].join('\n');
const ffParsed = parsePasswordCsv(firefoxCsv);
assert(ffParsed.drafts[0]!.host === 'firefox.example', 'firefox csv host');
assert(ffParsed.drafts[0]!.username === 'ff', 'firefox csv username');

console.log('verify-imex parse logins: ok');

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
const backup = serializeVaultBackup(meta, [
  {
    id: record.id,
    iv: blob.iv,
    ciphertext: blob.ciphertext,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  },
]);
assert(backup.kind === 'siteshelf-vault-backup', 'backup kind');
const backupText = JSON.stringify(backup);
assert(!backupText.includes(LOGIN_SECRET), 'backup json must not contain plaintext password');
assert(!backupText.includes(TEST_PASSWORD), 'backup json must not contain master password');

const restored = parseVaultBackup(JSON.parse(backupText));
const dekOk = await unlockDekFromMeta(TEST_PASSWORD, restored.meta);
const roundtrip = await decryptLogin(dekOk, restored.records[0]!.iv, restored.records[0]!.ciphertext);
assert(roundtrip.password === LOGIN_SECRET, 'backup decrypt restores password');
assert(roundtrip.username === 'octocat', 'backup decrypt restores username');

let wrongFailed = false;
try {
  await unlockDekFromMeta('wrong-password-that-is-long', restored.meta);
} catch {
  wrongFailed = true;
}
assert(wrongFailed, 'wrong master password must fail closed on backup');

const detected = detectVaultImport(backupText);
assert(detected.kind === 'backup', 'detect encrypted backup');

console.log('verify-imex vault backup: ok');

const existing: Bookmark[] = [
  {
    id: 'keep-me',
    url: 'https://example.com/a',
    normalizedUrl: 'https://example.com/a',
    title: 'Old',
    description: '',
    favicon: '',
    ogImage: '',
    excerpt: '',
    summary: 'old',
    category: '工具',
    tags: ['x'],
    createdAt: 10,
    updatedAt: 10,
  },
];

const exported = serializeBookmarksExport({
  categories: ['工作台'],
  bookmarks: existing,
});
assert(exported.kind === 'siteshelf-bookmarks', 'bookmark export kind');
assert(!JSON.stringify(exported).includes('password'), 'bookmark export has no password field');

const parsedFile = parseBookmarksImport(JSON.parse(JSON.stringify(exported)));
assert(parsedFile.categories.includes('工作台'), 'export categories roundtrip');
assert(parsedFile.drafts[0]!.normalizedUrl === 'https://example.com/a', 'export bookmark roundtrip');

const incoming = parseBookmarksImport([
  {
    url: 'https://example.com/a',
    title: 'New title',
    password: LOGIN_SECRET,
    username: 'leaked',
    category: '开发',
  },
  { url: 'https://example.com/b', title: 'Second' },
  { url: 'chrome://settings', title: 'restricted' },
]);
assert(
  !JSON.stringify(incoming.drafts).includes(LOGIN_SECRET),
  'bookmark import must drop password',
);
assert(
  incoming.drafts.every((d) => !('password' in d) && !('username' in (d as object))),
  'bookmark drafts have no credential fields',
);
assert(
  incoming.drafts.every((d) => d.url.startsWith('http')),
  'restricted urls skipped',
);

const merged = mergeBookmarksByNormalizedUrl(existing, incoming.drafts, 99);
const kept = merged.find((b) => b.normalizedUrl === 'https://example.com/a');
assert(kept?.id === 'keep-me', 'merge keeps existing id');
assert(kept?.title === 'New title', 'merge updates title');
assert(merged.some((b) => b.normalizedUrl === 'https://example.com/b'), 'merge adds new url');
assert(!merged.some((b) => b.url.includes('chrome:')), 'restricted not merged');

const arrayImport = parseBookmarksImport([{ url: 'https://plain.example', title: 'Plain' }]);
assert(arrayImport.drafts[0]!.title === 'Plain', 'plain array import');

console.log('verify-imex bookmarks: ok');

const weak = scorePassword('123');
assert(weak.score === 0 && weak.label === '过短', '123 is 过短');

const generated = generatePassword(18);
const genScore = scorePassword(generated);
assert(generated.length === 18, 'generated length 18');
assert(genScore.score === 4 && genScore.label === '强', `generated should be 强, got ${genScore.label} (${generated})`);

assert(masterPasswordMeetsPolicy(TEST_PASSWORD, MIN_MASTER_LENGTH), 'test master password meets policy');
assert(!masterPasswordMeetsPolicy('short', MIN_MASTER_LENGTH), 'short master rejected');
assert(!masterPasswordMeetsPolicy('password12', MIN_MASTER_LENGTH), 'common-ish master rejected by score');
assert(scorePassword('password').score <= 1, 'password is weak');

console.log('verify-imex password strength: ok');

const store = createMemoryCategoryStore();
await addCategory('工作台', store);
const names = await listCategoryNames(store);
assert(names.includes('工具'), 'defaults present');
assert(names.includes('其他'), '其他 present');
assert(names.includes('工作台'), 'custom present');
assert(!names.includes('未分类'), '未分类 not in classify list helper');
assert((await listCustomCategories(store)).includes('工作台'), 'custom store');

let remappedFrom = '';
await removeCategory('工作台', {
  store,
  remap: async (from, to) => {
    remappedFrom = `${from}->${to}`;
  },
});
assert(!(await listCustomCategories(store)).includes('工作台'), 'custom removed');
assert(remappedFrom === '工作台->其他', 'remove remaps to 其他');

let builtinBlocked = false;
try {
  await removeCategory('工具', { store });
} catch {
  builtinBlocked = true;
}
assert(builtinBlocked, 'cannot remove built-in');

let dupBlocked = false;
try {
  await addCategory('全部', store);
} catch {
  dupBlocked = true;
}
assert(dupBlocked, 'cannot add 全部');

let uncatBlocked = false;
try {
  await addCategory('未分类', store);
} catch {
  uncatBlocked = true;
}
assert(uncatBlocked, 'cannot add 未分类');

console.log('verify-imex categories: ok');

const opts = promptApiSessionOptions();
assert(opts.expectedOutputs?.[0]?.languages?.[0] === 'en', 'expectedOutputs language en');
assert(opts.expectedInputs?.[0]?.languages?.[0] === 'en', 'expectedInputs language en');
assert(opts.expectedOutputs?.[0]?.type === 'text', 'expectedOutputs type text');

console.log('verify-imex prompt api options: ok');
console.log('verify-imex: ok');
