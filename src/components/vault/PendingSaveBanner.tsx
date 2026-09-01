import { useState } from 'react';
import { maskPassword } from '../../lib/vault/encoding';
import { displayHost } from '../../lib/vault/match';
import { confirmPendingSave, dismissPending } from '../../lib/vault/service';
import type { PendingSave } from '../../lib/vault/types';

export function PendingSaveBanner({
  pending,
  gate,
  onChanged,
}: {
  pending: PendingSave;
  gate: 'setup' | 'locked' | 'open';
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const canSave = gate === 'open';

  return (
    <div className="pending-banner">
      <h2>保存到页架</h2>
      <p>
        将写入 <strong>{pending.origin}</strong>（{displayHost(pending)}）
        <br />
        用户名 {pending.username} · 密码 {maskPassword(pending.password)}
      </p>
      {gate === 'locked' && (
        <p className="pending-note">请先解锁保险库后再保存。不会自动写入。</p>
      )}
      {gate === 'setup' && (
        <p className="pending-note">请先设置主密码后再保存。不会自动写入。</p>
      )}
      {message && <p className="pending-note">{message}</p>}
      <div className="item-actions">
        <button
          type="button"
          className="primary-btn"
          disabled={!canSave || busy}
          onClick={() => {
            setBusy(true);
            setMessage('');
            void confirmPendingSave(pending.tabId)
              .then((saved) => {
                if (saved) onChanged();
                else setMessage('没有可保存的登录，或已过期。');
              })
              .catch((err: unknown) => {
                const text = err instanceof Error ? err.message : '保存失败。';
                setMessage(text);
              })
              .finally(() => setBusy(false));
          }}
        >
          {busy ? '保存中…' : '保存到页架'}
        </button>
        <button
          type="button"
          className="ghost-btn"
          disabled={busy}
          onClick={() => {
            void dismissPending(pending.tabId).then(() => onChanged());
          }}
        >
          不保存
        </button>
      </div>
    </div>
  );
}
