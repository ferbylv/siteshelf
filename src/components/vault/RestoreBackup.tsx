import { useRef, useState } from 'react';
import { detectVaultImport } from '../../lib/imex/vault';
import { restoreVaultBackup, VaultError } from '../../lib/vault/service';

export function RestoreBackup({ onRestored }: { onRestored?: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const importFile = async (file: File) => {
    setBusy(true);
    setMessage('');
    setError('');
    try {
      const text = await file.text();
      const parsed = detectVaultImport(text);
      if (parsed.kind !== 'backup') {
        setError('请选择页架加密备份。未加密 JSON / CSV 需先解锁后再导入。');
        return;
      }
      if (
        !window.confirm(
          '将用备份替换本机保险库全部记录。之后需使用备份时的主密码解锁。确定？',
        )
      ) {
        return;
      }
      await restoreVaultBackup(parsed.meta, parsed.records);
      setMessage('已恢复备份。请使用备份时的主密码解锁。');
      onRestored?.();
    } catch (err) {
      setError(err instanceof VaultError ? err.message : err instanceof Error ? err.message : '恢复失败。');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack" style={{ padding: 0, gap: 8 }}>
      <button
        type="button"
        className="ghost-btn"
        disabled={busy}
        onClick={() => fileRef.current?.click()}
      >
        {busy ? '恢复中…' : '从加密备份恢复'}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".json,.csv"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void importFile(file);
        }}
      />
      <p className="muted">加密备份会整库替换。恢复后请用备份时的主密码解锁。</p>
      {message && <div className="banner banner-ok">{message}</div>}
      {error && <div className="banner banner-danger">{error}</div>}
    </div>
  );
}
