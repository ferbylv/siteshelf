import { useState } from 'react';
import { RestoreBackup } from './RestoreBackup';
import { unlockVault, VaultError } from '../../lib/vault/service';

export function UnlockForm({ onReady }: { onReady: () => void }) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      await unlockVault(password);
      setPassword('');
      onReady();
    } catch (err) {
      setError(err instanceof VaultError ? err.message : '解锁失败。');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack" style={{ padding: 0 }}>
      <div className="card vault-hero">
        <h2>解锁保险库</h2>
        <p className="muted">主密码不正确时不会有额外提示。服务工作线程休眠后需要重新解锁。</p>
      </div>
      <div className="field">
        <label htmlFor="siteshelf-unlock-pass">主密码</label>
        <input
          id="siteshelf-unlock-pass"
          type="password"
          autoComplete="off"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void submit();
          }}
        />
      </div>
      {error && <div className="banner banner-danger">{error}</div>}
      <button
        type="button"
        className="primary-btn"
        disabled={busy || !password}
        onClick={() => void submit()}
      >
        {busy ? '正在派生密钥…' : '解锁'}
      </button>
      <RestoreBackup onRestored={onReady} />
    </div>
  );
}
