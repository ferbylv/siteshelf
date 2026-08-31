import { useCallback, useEffect, useState } from 'react';
import { PasswordStrength } from './PasswordStrength';
import { saveLogin, vaultStatus, VaultError } from '../lib/vault/service';
import { VAULT_SESSION_MESSAGE } from '../lib/vault/types';

export function BookmarkVaultSave({
  url,
  title,
}: {
  url: string;
  title?: string;
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [tone, setTone] = useState<'ok' | 'warn' | 'danger' | ''>('');
  const [gate, setGate] = useState<{ setup: boolean; unlocked: boolean } | null>(null);

  const refresh = useCallback(async () => {
    try {
      setGate(await vaultStatus());
    } catch {
      setGate({ setup: false, unlocked: false });
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onMessage = (msg: { type?: string }) => {
      if (msg?.type === VAULT_SESSION_MESSAGE) void refresh();
    };
    try {
      browser.runtime.onMessage.addListener(onMessage);
      return () => browser.runtime.onMessage.removeListener(onMessage);
    } catch {
      return undefined;
    }
  }, [refresh]);

  const submit = async () => {
    setBusy(true);
    setMessage('');
    setTone('');
    try {
      const status = await vaultStatus();
      if (!status.setup) {
        setTone('warn');
        setMessage('请先在保险库设置主密码');
        return;
      }
      if (!status.unlocked) {
        setTone('warn');
        setMessage('请先解锁保险库');
        return;
      }
      if (!password) {
        setTone('danger');
        setMessage('请填写密码。');
        return;
      }
      await saveLogin({
        title: title || '',
        url,
        origin: '',
        host: '',
        scheme: 'https:',
        username,
        password,
        notes: '',
      });
      setTone('ok');
      setMessage('已保存到保险库。');
      setPassword('');
    } catch (err) {
      if (err instanceof VaultError && err.code === 'not-setup') {
        setTone('warn');
        setMessage('请先在保险库设置主密码');
      } else if (err instanceof VaultError && err.code === 'locked') {
        setTone('warn');
        setMessage('请先解锁保险库');
      } else {
        setTone('danger');
        setMessage(err instanceof VaultError ? err.message : '保存失败。');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card vault-save">
      <h3>保存到保险库（可选）</h3>
      <p className="muted">手动填写后才会写入。不会发给 AI，也不会随书签导出。</p>
      {gate && !gate.setup && (
        <div className="banner banner-warn">请先在保险库设置主密码</div>
      )}
      {gate?.setup && !gate.unlocked && (
        <div className="banner banner-warn">请先解锁保险库</div>
      )}
      <div className="field">
        <label>用户名</label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="off"
        />
      </div>
      <div className="field">
        <label>密码</label>
        <input
          type={reveal ? 'text' : 'password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
        <PasswordStrength password={password} />
        <button type="button" className="icon-btn" onClick={() => setReveal((v) => !v)}>
          {reveal ? '隐藏密码' : '显示密码'}
        </button>
      </div>
      {message && (
        <div
          className={`banner ${
            tone === 'ok' ? 'banner-ok' : tone === 'danger' ? 'banner-danger' : 'banner-warn'
          }`}
        >
          {message}
        </div>
      )}
      <button
        type="button"
        className="ghost-btn"
        disabled={busy || !url}
        onClick={() => void submit()}
      >
        {busy ? '保存中…' : '保存到保险库'}
      </button>
    </div>
  );
}
