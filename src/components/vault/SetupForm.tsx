import { useState } from 'react';
import { MIN_MASTER_LENGTH } from '../../lib/vault/types';
import { setupVault, VaultError } from '../../lib/vault/service';

export function SetupForm({ onReady }: { onReady: () => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      await setupVault(password, confirm);
      onReady();
    } catch (err) {
      setError(err instanceof VaultError ? err.message : '无法创建保险库。');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack" style={{ padding: 0 }}>
      <div className="card vault-hero">
        <h2>设置主密码</h2>
        <p className="muted">
          保险库只存在本机。主密码用于派生加密密钥，不会被保存，也无法找回。请另外记在安全的地方。
        </p>
      </div>
      <div className="field">
        <label htmlFor="siteshelf-setup-pass">主密码（至少 {MIN_MASTER_LENGTH} 位）</label>
        <input
          id="siteshelf-setup-pass"
          type="password"
          autoComplete="off"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="siteshelf-setup-confirm">再输入一次</label>
        <input
          id="siteshelf-setup-confirm"
          type="password"
          autoComplete="off"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void submit();
          }}
        />
      </div>
      {error && <div className="banner banner-danger">{error}</div>}
      <button
        type="button"
        className="primary-btn"
        disabled={busy || password.length < MIN_MASTER_LENGTH}
        onClick={() => void submit()}
      >
        {busy ? '正在创建保险库…' : '创建保险库'}
      </button>
      <p className="muted">
        登录密码只在你确认「保存到页架」后写入加密记录，不会发给 AI，也不会自动上传。
      </p>
    </div>
  );
}
