/**
 * Pure-ish helpers for save-on-login activation (SPA button clicks that never
 * fire a native form submit). DOM-touching helpers take Element so content
 * scripts can call them; label matching is unit-tested without jsdom.
 */

const LOGIN_LABEL_RE =
  /^(登录|登陆|登入|登錄|登入帳號|立即登录|立即登陆|马上登录|点击登录|login|log\s*in|sign\s*in|signin|sign\s*on|submit|logon)$/i;

/** Standalone confirm — only treat as login when already in a password form scope. */
const CONFIRM_LABEL_RE = /^(确定|確定|确认|確認|ok|okay)$/i;

const CANCEL_LABEL_RE =
  /^(取消|關閉|关闭|返回|找回|忘记|忘記|重置|清空|clear|cancel|close|back|reset|forgot|register|注册|註冊|sign\s*up|signup)$/i;

export function normalizeActivationLabel(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}

/**
 * True when the visible label / aria / value looks like a login or submit action.
 * Bare「确定」is NOT enough on its own (too common); callers may still allow it
 * for buttons already inside a single-password form.
 */
export function looksLikeLoginActivationLabel(raw: string): boolean {
  const label = normalizeActivationLabel(raw);
  if (!label || label.length > 32) return false;
  if (CANCEL_LABEL_RE.test(label)) return false;
  if (CONFIRM_LABEL_RE.test(label)) return false;
  return LOGIN_LABEL_RE.test(label);
}

export function looksLikeCancelActivationLabel(raw: string): boolean {
  const label = normalizeActivationLabel(raw);
  if (!label) return false;
  return CANCEL_LABEL_RE.test(label);
}

export function looksLikeConfirmOnlyLabel(raw: string): boolean {
  const label = normalizeActivationLabel(raw);
  return CONFIRM_LABEL_RE.test(label);
}

export function activationLabelOf(el: Element): string {
  const aria = el.getAttribute('aria-label') || '';
  if (aria.trim()) return normalizeActivationLabel(aria);
  if (el instanceof HTMLInputElement) {
    const v = el.value || el.getAttribute('value') || '';
    if (v.trim()) return normalizeActivationLabel(v);
  }
  if (el instanceof HTMLButtonElement || el instanceof HTMLAnchorElement || el.getAttribute('role') === 'button') {
    const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (text) return text;
  }
  const title = el.getAttribute('title') || '';
  return normalizeActivationLabel(title);
}

/**
 * True if `el` itself is a clickable login/submit-like control
 * (button, submit/image/button input, role=button, or login-labelled).
 */
export function isActivationControl(el: Element): boolean {
  const tag = el.tagName.toLowerCase();
  if (tag === 'button') return !looksLikeCancelActivationLabel(activationLabelOf(el));
  if (tag === 'input') {
    const type = ((el as HTMLInputElement).type || '').toLowerCase();
    if (type === 'submit' || type === 'image') return true;
    if (type === 'button') {
      const label = activationLabelOf(el);
      if (looksLikeCancelActivationLabel(label)) return false;
      return true;
    }
    return false;
  }
  if (el.getAttribute('role') === 'button') {
    const label = activationLabelOf(el);
    if (looksLikeCancelActivationLabel(label)) return false;
    // role=button outside forms: require login-ish text, or allow confirm
    // only when a later password-scope check will gate it.
    return (
      looksLikeLoginActivationLabel(label) ||
      looksLikeConfirmOnlyLabel(label) ||
      label.length === 0
    );
  }
  // Non-button: only if its own label looks like Login / 登录
  return looksLikeLoginActivationLabel(activationLabelOf(el));
}

/**
 * Walk from the click target up to the nearest activation control.
 * Returns null if the click is inside the vault overlay host or no control found.
 */
export function resolveActivationControl(
  start: EventTarget | null,
  vaultHostId = 'siteshelf-vault-host',
): Element | null {
  if (!(start instanceof Element)) return null;
  let el: Element | null = start;
  while (el) {
    if (el.id === vaultHostId) return null;
    if (typeof (el as Element).closest === 'function' && el.closest(`#${vaultHostId}`)) {
      return null;
    }
    if (isActivationControl(el)) return el;
    el = el.parentElement;
  }
  return null;
}

function isVisiblePassword(el: Element): el is HTMLInputElement {
  if (!(el instanceof HTMLInputElement)) return false;
  if ((el.type || '').toLowerCase() !== 'password') return false;
  if (el.disabled || el.readOnly) return false;
  if (!el.offsetParent && el.getAttribute('aria-hidden') === 'true') return false;
  return true;
}

function visiblePasswordsIn(scope: ParentNode): HTMLInputElement[] {
  return [...scope.querySelectorAll('input[type="password"]')].filter(isVisiblePassword);
}

function controlForm(control: Element): HTMLFormElement | null {
  if (control instanceof HTMLInputElement || control instanceof HTMLButtonElement) {
    if (control.form) return control.form;
  }
  return control.closest('form');
}

/**
 * Find the single login password associated with an activation control.
 * - Prefer the enclosing form when it has exactly one visible password.
 * - Otherwise walk ancestors for a container with exactly one password.
 * - Finally: page has exactly one login password and control shares a
 *   non-trivial ancestor with it.
 * Multi-password forms (registration) → null.
 */
export function findPasswordForActivation(control: Element): HTMLInputElement | null {
  const form = controlForm(control);
  if (form) {
    const inForm = visiblePasswordsIn(form);
    if (inForm.length === 1) return inForm[0]!;
    return null;
  }

  let scope: Element | null = control.parentElement;
  while (scope && scope !== document.documentElement) {
    if (scope === document.body) break;
    const passwords = visiblePasswordsIn(scope);
    if (passwords.length === 1) return passwords[0]!;
    if (passwords.length > 1) return null;
    scope = scope.parentElement;
  }

  const pagePasswords = visiblePasswordsIn(document).filter((p) => {
    if (!p.form) return true;
    return visiblePasswordsIn(p.form).length === 1;
  });
  if (pagePasswords.length !== 1) return null;
  const pass = pagePasswords[0]!;
  if (shareNearbyContainer(control, pass)) return pass;
  return null;
}

function shareNearbyContainer(a: Element, b: Element): boolean {
  let scope: Element | null = b.parentElement;
  let depth = 0;
  while (scope && scope !== document.body && scope !== document.documentElement && depth < 8) {
    if (scope.contains(a)) return true;
    scope = scope.parentElement;
    depth += 1;
  }
  return false;
}

/** Whether a click event should be ignored (our overlay). */
export function isVaultHostEvent(ev: Event, vaultHostId = 'siteshelf-vault-host'): boolean {
  const path = typeof ev.composedPath === 'function' ? ev.composedPath() : [];
  for (const n of path) {
    if (n instanceof Element && n.id === vaultHostId) return true;
  }
  const t = ev.target;
  if (t instanceof Element) {
    if (t.id === vaultHostId) return true;
    if (typeof t.closest === 'function' && t.closest(`#${vaultHostId}`)) return true;
  }
  return false;
}

export type StageDebounceState = { key: string; at: number };

/** Returns true when this STAGE should be skipped as a duplicate within windowMs. */
export function shouldDebounceStage(
  state: StageDebounceState,
  origin: string,
  username: string,
  now = Date.now(),
  windowMs = 1000,
): { skip: boolean; next: StageDebounceState } {
  const key = `${origin}\0${username}`;
  if (state.key === key && now - state.at < windowMs) {
    return { skip: true, next: state };
  }
  return { skip: false, next: { key, at: now } };
}
