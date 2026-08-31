import { useState } from 'react';
import { PasswordStrength } from '../PasswordStrength';
import { masterPasswordMeetsPolicy } from '../../lib/password-strength';
import { MIN_MASTER_LENGTH } from '../../lib/vault/types';
import { changeMasterPassword, VaultError } from '../../lib/vault/service';

export function ChangePasswordForm({ onDone }: { onDone?: () => void }) {
  const [oldPassword, setOldPassword] = useState('');
  const [nextPassword, setNextPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError('');
    setOk(false);
    try {
      await changeMasterPassword(oldPassword, nextPassword, confirm);
      setOldPassword('');
      setNextPassword('');
      setConfirm('');
      setOk(true);
      onDone?.();
    } catch (err) {
      setError(err instanceof VaultError ? err.message : '无法更改主密码。');
    } finally {
      setBusy(false);
    }
  };

  const strongEnough = masterPasswordMeetsPolicy(nextPassword, MIN_MASTER_LENGTH);

  return (
    <div className="stack" style={{ padding: 0 }}>
      <p className="muted">
        更改主密码会生成新的数据密钥并重新加密全部记录。旧主密码随即失效。
      </p>
      <div className="field">
        <label>当前主密码</label>
        <input
          type="password"
          autoComplete="off"
          value={oldPassword}
          onChange={(e) => setOldPassword(e.target.value)}
        />
      </div>
      <div className="field">
        <label>新主密码（至少 {MIN_MASTER_LENGTH} 位，强度一般以上）</label>
        <input
          type="password"
          autoComplete="off"
          value={nextPassword}
          onChange={(e) => setNextPassword(e.target.value)}
        />
        <PasswordStrength password={nextPassword} />
      </div>
      <div className="field">
        <label>确认新主密码</label>
        <input
          type="password"
          autoComplete="off"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>
      {error && <div className="banner banner-danger">{error}</div>}
      {ok && <div className="banner banner-ok">主密码已更新，记录已重新加密。</div>}
      <button
        type="button"
        className="primary-btn"
        disabled={busy || !strongEnough}
        onClick={() => void submit()}
      >
        {busy ? '正在重新加密…' : '更改主密码'}
      </button>
    </div>
  );
}
