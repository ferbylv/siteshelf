import { useState } from 'react';
import { generatePassword } from '../../lib/vault/generate';
import { saveLogin, VaultError } from '../../lib/vault/service';
import type { LoginRecord } from '../../lib/vault/types';

export function LoginEditor({
  initial,
  onSaved,
  onCancel,
}: {
  initial?: Partial<LoginRecord>;
  onSaved: (record: LoginRecord) => void;
  onCancel?: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [url, setUrl] = useState(initial?.url ?? '');
  const [username, setUsername] = useState(initial?.username ?? '');
  const [password, setPassword] = useState(initial?.password ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const saved = await saveLogin({
        id: initial?.id,
        title,
        url,
        origin: initial?.origin ?? '',
        host: initial?.host ?? '',
        scheme: initial?.scheme ?? 'https:',
        username,
        password,
        notes,
      });
      onSaved(saved);
    } catch (err) {
      setError(err instanceof VaultError ? err.message : '保存失败。');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack" style={{ padding: 0 }}>
      <div className="field">
        <label>名称</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例如 GitHub" />
      </div>
      <div className="field">
        <label>登录网址</label>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/login"
          autoComplete="off"
        />
      </div>
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
        <div className="row">
          <button type="button" className="icon-btn" onClick={() => setReveal((v) => !v)}>
            {reveal ? '隐藏密码' : '显示密码'}
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={() => {
              setPassword(generatePassword());
              setReveal(true);
            }}
          >
            生成密码
          </button>
        </div>
      </div>
      <div className="field">
        <label>备注</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="仅保存在加密记录中" />
      </div>
      {error && <div className="banner banner-danger">{error}</div>}
      <div className="row">
        <button type="button" className="primary-btn" disabled={busy} onClick={() => void submit()}>
          {busy ? '保存中…' : '保存'}
        </button>
        {onCancel && (
          <button type="button" className="ghost-btn" onClick={onCancel}>
            取消
          </button>
        )}
      </div>
    </div>
  );
}
