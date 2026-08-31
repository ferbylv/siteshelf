import {
  VAULT_MSG,
  VAULT_PENDING_MESSAGE,
  VAULT_SESSION_MESSAGE,
  type LoginSummary,
  type PendingSave,
} from '../lib/vault/types';

interface QueryResult {
  setup: boolean;
  unlocked: boolean;
  matches: LoginSummary[];
  autoFill: boolean;
}

const ROOT_ID = 'siteshelf-vault-host';
const STYLE = `
:host { all: initial; }
.wrap {
  font-family: "PingFang SC","Hiragino Sans GB","Noto Sans SC",system-ui,sans-serif;
  font-size: 13px; color: #2c241b; pointer-events: none;
}
.fab, .panel, .toast, .infobar, .btn, .field input { pointer-events: auto; }
.fab {
  position: fixed; right: 18px; bottom: 18px; z-index: 2147483646;
  border: 0; border-radius: 999px; padding: 10px 14px;
  background: #c45c26; color: #fff; font-weight: 650; cursor: pointer;
  box-shadow: 0 10px 24px rgba(44,36,27,.22);
}
.fab:hover { background: #a84b1c; }
.panel {
  position: fixed; right: 18px; bottom: 64px; z-index: 2147483646;
  width: 320px; max-width: calc(100vw - 24px);
  background: #fffaf2; border: 1px solid #e4d8c6; border-radius: 14px;
  box-shadow: 0 16px 40px rgba(44,36,27,.18); padding: 14px;
}
.panel h2 { margin: 0 0 6px; font-size: 15px; }
.muted { color: #6d6256; font-size: 12px; margin: 0 0 10px; word-break: break-all; }
.row { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
.btn { border: 0; border-radius: 10px; padding: 8px 12px; cursor: pointer; font: inherit; }
.primary { background: #c45c26; color: #fff; font-weight: 600; }
.ghost { background: #fff; border: 1px solid #e4d8c6; }
.danger { background: #f8d7d3; color: #b42318; }
.list { display: flex; flex-direction: column; gap: 6px; margin: 8px 0 0; }
.item {
  text-align: left; width: 100%; border: 1px solid #e4d8c6; background: #fff;
  border-radius: 10px; padding: 8px 10px; cursor: pointer;
}
.item:hover { border-color: #c45c26; }
.item strong { display: block; font-size: 13px; }
.item span { color: #6d6256; font-size: 12px; }
.toast {
  position: fixed; right: 18px; bottom: 18px; z-index: 2147483646;
  background: #d7ecdf; color: #2f6f4e; border-radius: 10px; padding: 8px 12px;
  box-shadow: 0 10px 24px rgba(44,36,27,.12);
}
.field { display: flex; flex-direction: column; gap: 4px; margin: 8px 0; }
.field label { font-size: 12px; color: #6d6256; }
.field input {
  border: 1px solid #e4d8c6; border-radius: 10px; padding: 8px 10px;
  font: inherit; background: #fff;
}
.infobar {
  position: fixed; top: 0; left: 0; right: 0; z-index: 2147483647;
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
  padding: 10px 16px 12px;
  background: #1a1510; color: #fffaf2;
  border-bottom: 3px solid #ffd54a;
  box-shadow: 0 8px 28px rgba(0,0,0,.42);
}
.infobar-mark {
  flex: 0 0 auto; background: #ffd54a; color: #1a1510;
  font-weight: 800; font-size: 12px; letter-spacing: .04em;
  border-radius: 8px; padding: 6px 8px;
}
.infobar-body { flex: 1 1 220px; min-width: 0; }
.infobar h2 { margin: 0 0 2px; font-size: 15px; color: #fff; font-weight: 750; }
.infobar .muted { color: #f0e4d2; margin: 0; font-size: 12.5px; }
.infobar .field { margin: 6px 0 0; max-width: 280px; }
.infobar .field label { color: #e8dcc8; }
.infobar .field input { background: #fff; color: #1a1510; border-color: #ffd54a; }
.infobar .row { margin-top: 0; margin-left: auto; }
.infobar .primary {
  background: #ffd54a; color: #1a1510; font-weight: 800; padding: 10px 16px;
}
.infobar .ghost {
  background: transparent; border: 1px solid #e8dcc8; color: #fffaf2;
}
`;

export default defineContentScript({
  matches: ['https://*/*', 'http://*/*'],
  runAt: 'document_idle',
  allFrames: false,
  main() {
    if (window !== window.top) return;
    void boot();
  },
});

let overlayShadow: ShadowRoot | null = null;
let lastCapture: Omit<PendingSave, 'tabId'> | null = null;

async function boot(): Promise<void> {
  const shadow = ensureOverlay();
  await refresh(shadow);

  const observer = new MutationObserver(() => {
    scheduleRefresh(shadow);
  });
  observer.observe(document.documentElement, { subtree: true, childList: true });

  document.addEventListener('submit', (ev) => onSubmit(ev, shadow), true);
  document.addEventListener(
    'keydown',
    (ev) => {
      if (ev.key !== 'Enter') return;
      const target = ev.target;
      if (!(target instanceof HTMLInputElement) || target.type !== 'password') return;
      captureFromPassword(target, shadow);
    },
    true,
  );

  const flushStage = () => {
    if (!lastCapture) return;
    stageNow(lastCapture);
  };
  window.addEventListener('pagehide', flushStage);
  window.addEventListener('beforeunload', flushStage);

  browser.runtime.onMessage.addListener(
    (msg: { type?: string; username?: string; password?: string; unlocked?: boolean }) => {
      if (msg?.type === VAULT_SESSION_MESSAGE) {
        if (!msg.unlocked) didAutoFill = false;
        void refresh(shadow);
        return;
      }
      if (msg?.type === VAULT_PENDING_MESSAGE) {
        void refresh(shadow);
        return;
      }
      if (
        msg?.type === VAULT_MSG.DO_FILL &&
        typeof msg.username === 'string' &&
        typeof msg.password === 'string'
      ) {
        fillForm(msg.username, msg.password);
        showToast(shadow, '已填充（来自页架）');
        return { ok: true };
      }
      return undefined;
    },
  );
}

let refreshTimer = 0;
function scheduleRefresh(shadow: ShadowRoot): void {
  window.clearTimeout(refreshTimer);
  refreshTimer = window.setTimeout(() => void refresh(shadow), 400);
}

function ensureOverlay(): ShadowRoot {
  if (overlayShadow) return overlayShadow;
  const host = document.createElement('div');
  host.id = ROOT_ID;
  host.style.all = 'initial';
  host.style.position = 'fixed';
  host.style.inset = '0';
  host.style.pointerEvents = 'none';
  host.style.zIndex = '2147483647';
  const shadow = host.attachShadow({ mode: 'closed' });
  const style = document.createElement('style');
  style.textContent = STYLE;
  const wrap = document.createElement('div');
  wrap.className = 'wrap';
  wrap.setAttribute('data-root', '1');
  shadow.append(style, wrap);
  document.documentElement.append(host);
  overlayShadow = shadow;
  return shadow;
}

function wrapOf(shadow: ShadowRoot): HTMLElement {
  return shadow.querySelector('[data-root]') as HTMLElement;
}

async function queryVault(): Promise<QueryResult> {
  try {
    return (await browser.runtime.sendMessage({ type: VAULT_MSG.QUERY })) as QueryResult;
  } catch {
    return { setup: false, unlocked: false, matches: [], autoFill: false };
  }
}

let didAutoFill = false;

async function refresh(shadow: ShadowRoot): Promise<void> {
  // Always restore pending save UI, even when this document has no login form
  // (typical after a redirect). renderIdle must not wipe an existing infobar.
  if (findLoginForm()) {
    const result = await queryVault();
    if (result.unlocked && result.autoFill && result.matches[0] && !didAutoFill) {
      didAutoFill = true;
      const filled = await requestFill(result.matches[0].id);
      if (filled) showToast(shadow, '已自动填充唯一匹配的登录');
    }
    renderFillUi(shadow, result);
  } else {
    renderIdle(shadow);
  }
  await maybeShowPending(shadow);
}

function keepSaveBar(root: HTMLElement): Element[] {
  const save = root.querySelector('[data-dialog="save"]');
  return save ? [save] : [];
}

function renderIdle(shadow: ShadowRoot): void {
  const root = wrapOf(shadow);
  const keep = keepSaveBar(root);
  if (keep.length) {
    root.replaceChildren(...keep);
    return;
  }
  if (root.querySelector('[data-dialog]')) return;
  root.replaceChildren();
}

function renderFillUi(shadow: ShadowRoot, result: QueryResult): void {
  const root = wrapOf(shadow);
  if (root.querySelector('[data-dialog="picker"]')) return;
  const keep = keepSaveBar(root);
  root.replaceChildren(...keep);
  if (!result.setup) return;

  if (!result.unlocked) {
    const fab = document.createElement('button');
    fab.type = 'button';
    fab.className = 'fab';
    fab.textContent = '解锁页架以填充';
    fab.addEventListener('click', () => {
      showDialog(shadow, {
        kind: 'info',
        title: '保险库已锁定',
        body: '请点击工具栏「页架」图标，输入主密码解锁后再填充。主密码绝不会在网页内询问。',
      });
    });
    root.append(fab);
    return;
  }

  if (!result.matches.length) return;

  const fab = document.createElement('button');
  fab.type = 'button';
  fab.className = 'fab';
  fab.textContent =
    result.matches.length === 1 ? '填充页架登录' : `选择要填充的登录（${result.matches.length}）`;
  fab.addEventListener('click', () => {
    if (result.matches.length === 1) {
      void fillById(shadow, result.matches[0]!.id);
    } else {
      showPicker(shadow, result.matches);
    }
  });
  root.append(fab);
}

function showPicker(shadow: ShadowRoot, matches: LoginSummary[]): void {
  const panel = dialogShell('picker', '选择要填充的登录', location.host);
  const list = document.createElement('div');
  list.className = 'list';
  for (const item of matches) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'item';
    const strong = document.createElement('strong');
    strong.textContent = item.username || '（无用户名）';
    const span = document.createElement('span');
    span.textContent = item.title || item.origin;
    btn.append(strong, span);
    btn.addEventListener('click', () => void fillById(shadow, item.id));
    list.append(btn);
  }
  const row = document.createElement('div');
  row.className = 'row';
  row.append(ghostButton('取消', () => panel.remove()));
  panel.append(list, row);
  wrapOf(shadow).append(panel);
}

async function fillById(shadow: ShadowRoot, id: string): Promise<void> {
  const ok = await requestFill(id);
  wrapOf(shadow).querySelector('[data-dialog="picker"]')?.remove();
  if (ok) showToast(shadow, '已填充（来自页架）');
  else
    showDialog(shadow, {
      kind: 'info',
      title: '无法填充',
      body: '请先解锁保险库，并确认当前网站与保存的主机名完全一致。',
    });
}

async function requestFill(id: string): Promise<boolean> {
  try {
    const res = (await browser.runtime.sendMessage({ type: VAULT_MSG.FILL, id })) as {
      ok?: boolean;
      username?: string;
      password?: string;
    };
    if (!res?.ok || typeof res.username !== 'string' || typeof res.password !== 'string') {
      return false;
    }
    fillForm(res.username, res.password);
    return true;
  } catch {
    return false;
  }
}

function findPasswordInputs(): HTMLInputElement[] {
  return [...document.querySelectorAll('input[type="password"]')].filter((el) => {
    if (!(el instanceof HTMLInputElement)) return false;
    if (el.disabled || el.readOnly) return false;
    if (!el.offsetParent && el.getAttribute('aria-hidden') === 'true') return false;
    return true;
  }) as HTMLInputElement[];
}

function findLoginForm(): HTMLFormElement | HTMLInputElement | null {
  const passwords = findPasswordInputs();
  if (!passwords.length) return null;
  const single = passwords.find((el) => {
    const form = el.form;
    if (!form) return true;
    const inForm = [...form.querySelectorAll('input[type="password"]')];
    return inForm.length === 1;
  });
  return single?.form ?? single ?? null;
}

function findUsernameInput(password: HTMLInputElement): HTMLInputElement | null {
  const form = password.form;
  const scope: ParentNode = form ?? document;
  const candidates = [...scope.querySelectorAll('input')].filter((el): el is HTMLInputElement => {
    if (!(el instanceof HTMLInputElement)) return false;
    if (el === password) return false;
    if (el.disabled) return false;
    const type = (el.type || 'text').toLowerCase();
    if (['password', 'hidden', 'submit', 'button', 'checkbox', 'radio', 'file', 'reset'].includes(type)) {
      return false;
    }
    return type === 'text' || type === 'email' || type === 'tel' || type === 'url' || type === 'search' || !type;
  });
  const scored = candidates
    .map((el) => {
      const blob = `${el.autocomplete} ${el.name} ${el.id} ${el.placeholder}`.toLowerCase();
      let score = 0;
      if (/username|user-name|email|login|account|userid/.test(blob)) score += 5;
      if (/user|mail|账号|用户|邮箱/.test(blob)) score += 3;
      if (typeLooksIdentity(el)) score += 2;
      return { el, score };
    })
    .sort((a, b) => b.score - a.score);
  return scored[0]?.el ?? candidates[0] ?? null;
}

function typeLooksIdentity(el: HTMLInputElement): boolean {
  const type = (el.type || 'text').toLowerCase();
  return type === 'email' || el.autocomplete === 'username' || el.autocomplete === 'email';
}

function setNativeValue(el: HTMLInputElement, value: string): void {
  const proto = HTMLInputElement.prototype;
  const desc = Object.getOwnPropertyDescriptor(proto, 'value');
  desc?.set?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
}

function fillForm(username: string, password: string): void {
  const passwords = findPasswordInputs();
  const pass =
    passwords.find((el) => {
      const form = el.form;
      if (!form) return true;
      return form.querySelectorAll('input[type="password"]').length === 1;
    }) ?? passwords[0];
  if (!pass) return;
  const user = findUsernameInput(pass);
  if (user) setNativeValue(user, username);
  setNativeValue(pass, password);
}

function onSubmit(ev: Event, shadow: ShadowRoot): void {
  const form = ev.target;
  if (!(form instanceof HTMLFormElement)) return;
  const passwords = [...form.querySelectorAll('input[type="password"]')].filter(
    (el): el is HTMLInputElement => el instanceof HTMLInputElement,
  );
  if (passwords.length !== 1) return;
  captureFromPassword(passwords[0]!, shadow);
}

function stageNow(pending: Omit<PendingSave, 'tabId'>): void {
  lastCapture = pending;
  // Fire-and-forget: do not await UI or the round-trip. Navigation must not drop credentials.
  void browser.runtime.sendMessage({ type: VAULT_MSG.STAGE, pending }).catch(() => {
    /* background unavailable */
  });
}

function captureFromPassword(pass: HTMLInputElement, shadow: ShadowRoot): void {
  const form = pass.form;
  if (form && form.querySelectorAll('input[type="password"]').length !== 1) return;
  const user = findUsernameInput(pass);
  const username = user?.value?.trim() || '';
  const password = pass.value || '';
  if (!username || !password) return;
  if (location.protocol !== 'https:' && location.protocol !== 'http:') return;

  const pending: Omit<PendingSave, 'tabId'> = {
    origin: location.origin,
    host: location.hostname.toLowerCase(),
    scheme: location.protocol as 'http:' | 'https:',
    url: location.href,
    username,
    password,
    capturedAt: Date.now(),
  };
  stageNow(pending);
  showSavePrompt(shadow, pending);
}

async function maybeShowPending(shadow: ShadowRoot): Promise<void> {
  const existing = wrapOf(shadow).querySelector('[data-dialog="save"]');
  try {
    const res = (await browser.runtime.sendMessage({ type: VAULT_MSG.GET_PENDING })) as {
      pending?: Omit<PendingSave, 'tabId'> & { tabId?: number };
    };
    const pending = res?.pending;
    if (!pending) {
      // Keep a locally shown bar while STAGE is in flight (lastCapture set).
      if (lastCapture) return;
      existing?.remove();
      return;
    }
    if (existing) return;
    showSavePrompt(shadow, pending);
  } catch {
    /* ignore */
  }
}

function showSavePrompt(shadow: ShadowRoot, pending: Omit<PendingSave, 'tabId'>): void {
  wrapOf(shadow).querySelector('[data-dialog="save"]')?.remove();
  const httpWarn =
    pending.scheme === 'http:'
      ? '当前为 HTTP，连接未加密。保存后也只会填充到同一主机的 HTTP 页面。'
      : '';
  const bar = document.createElement('div');
  bar.className = 'infobar';
  bar.dataset.dialog = 'save';
  bar.setAttribute('role', 'dialog');
  bar.setAttribute('aria-live', 'polite');

  const mark = document.createElement('div');
  mark.className = 'infobar-mark';
  mark.textContent = '页架';

  const body = document.createElement('div');
  body.className = 'infobar-body';
  const h = document.createElement('h2');
  h.textContent = '保存到页架？';
  const p = document.createElement('p');
  p.className = 'muted';
  const landing =
    location.origin !== pending.origin ? ` · 当前页 ${location.host}` : '';
  p.textContent = `将保存为 ${pending.origin}（${pending.host}）${landing}`;
  const userField = labeledInput('用户名', pending.username);
  const passLine = document.createElement('p');
  passLine.className = 'muted';
  passLine.textContent = `密码 ${'••••••••'}${httpWarn ? ` · ${httpWarn}` : ''}`;
  body.append(h, p, userField.wrap, passLine);

  const row = document.createElement('div');
  row.className = 'row';
  const saveBtn = primaryButton('保存', async () => {
    saveBtn.disabled = true;
    const next = { ...pending, username: userField.value.trim() || pending.username };
    try {
      const res = (await browser.runtime.sendMessage({
        type: VAULT_MSG.SAVE,
        pending: next,
      })) as { ok?: boolean; needsUnlock?: boolean };
      if (res?.ok) {
        bar.remove();
        lastCapture = null;
        showToast(shadow, '已保存到保险库');
        return;
      }
      saveBtn.disabled = false;
      if (res?.needsUnlock) {
        passLine.textContent = '登录已记在本机会话中。请点击工具栏「页架」解锁后再保存。不会自动写入。';
      } else {
        passLine.textContent = '未保存。请解锁保险库后再试。页架不会在未确认时保存密码。';
      }
    } catch {
      saveBtn.disabled = false;
      passLine.textContent = '未保存。请稍后重试。';
    }
  });
  row.append(
    saveBtn,
    ghostButton('不保存', () => {
      lastCapture = null;
      void browser.runtime.sendMessage({ type: VAULT_MSG.DISMISS_PENDING });
      bar.remove();
    }),
  );
  bar.append(mark, body, row);
  wrapOf(shadow).prepend(bar);
}

function dialogShell(kind: string, title: string, subtitle: string): HTMLElement {
  const panel = document.createElement('div');
  panel.className = 'panel';
  panel.dataset.dialog = kind;
  panel.setAttribute('role', 'dialog');
  const h = document.createElement('h2');
  h.textContent = title;
  const p = document.createElement('p');
  p.className = 'muted';
  p.textContent = subtitle;
  panel.append(h, p);
  return panel;
}

function showDialog(shadow: ShadowRoot, opts: { kind: string; title: string; body: string }): void {
  wrapOf(shadow).querySelector('[data-dialog="info"]')?.remove();
  const panel = dialogShell('info', opts.title, opts.body);
  const row = document.createElement('div');
  row.className = 'row';
  row.append(primaryButton('知道了', () => panel.remove()));
  panel.append(row);
  wrapOf(shadow).append(panel);
}

function showToast(shadow: ShadowRoot, text: string): void {
  wrapOf(shadow).querySelector('.toast')?.remove();
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = text;
  wrapOf(shadow).append(toast);
  window.setTimeout(() => toast.remove(), 2800);
}

function primaryButton(label: string, onClick: () => void): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn primary';
  btn.textContent = label;
  btn.addEventListener('click', onClick);
  return btn;
}

function ghostButton(label: string, onClick: () => void): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn ghost';
  btn.textContent = label;
  btn.addEventListener('click', onClick);
  return btn;
}

function labeledInput(label: string, value: string): HTMLInputElement & { wrap: HTMLElement } {
  const wrap = document.createElement('div');
  wrap.className = 'field';
  const lab = document.createElement('label');
  lab.textContent = label;
  const input = document.createElement('input') as HTMLInputElement & { wrap: HTMLElement };
  input.type = 'text';
  input.value = value;
  input.autocomplete = 'off';
  wrap.append(lab, input);
  input.wrap = wrap;
  return input;
}
