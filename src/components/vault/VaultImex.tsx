import { useRef, useState } from 'react';
import { datedFilename, downloadTextFile } from '../../lib/imex/download';
import { detectVaultImport, loginsToBitwarden, serializeVaultBackup } from '../../lib/imex/vault';
import {
  exportVaultCipher,
  listLogins,
  restoreVaultBackup,
  saveLogin,
  VaultError,
} from '../../lib/vault/service';

export function VaultImex({ onChanged }: { onChanged: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const exportEncrypted = async () => {
    setError('');
    setMessage('');
    try {
      const { meta, records } = await exportVaultCipher();
      const payload = serializeVaultBackup(meta, records);
      downloadTextFile(
        datedFilename('siteshelf-vault-backup', 'json'),
        JSON.stringify(payload, null, 2),
      );
      setMessage(`已导出加密备份（${records.length} 条密文）。`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '导出失败。');
    }
  };

  const exportBitwarden = async () => {
    setError('');
    setMessage('');
    if (
      !window.confirm(
        '未加密 JSON 含有明文密码，请妥善保管，不要发给他人或上传到不可信位置。继续导出？',
      )
    ) {
      return;
    }
    try {
      const logins = await listLogins();
      const payload = loginsToBitwarden(logins);
      downloadTextFile(
        datedFilename('siteshelf-bitwarden', 'json'),
        JSON.stringify(payload, null, 2),
      );
      setMessage(`已导出未加密 JSON（${logins.length} 条）。`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '导出失败。');
    }
  };

  const importFile = async (file: File) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const text = await file.text();
      const parsed = detectVaultImport(text);
      if (parsed.kind === 'backup') {
        if (
          !window.confirm(
            '将用备份替换本机保险库全部记录。之后需使用备份时的主密码解锁。确定？',
          )
        ) {
          return;
        }
        await restoreVaultBackup(parsed.meta, parsed.records);
        setMessage('已恢复备份。请使用备份时的主密码解锁。');
        onChanged();
        return;
      }
      let imported = 0;
      for (const draft of parsed.drafts) {
        await saveLogin(draft);
        imported += 1;
      }
      setMessage(
        `已导入 ${imported} 条登录${parsed.skipped ? `，跳过 ${parsed.skipped} 条` : ''}。`,
      );
      onChanged();
    } catch (err) {
      setError(err instanceof VaultError ? err.message : err instanceof Error ? err.message : '导入失败。');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack" style={{ padding: 0, gap: 8 }}>
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <button type="button" className="ghost-btn" onClick={() => void exportEncrypted()}>
          导出加密备份
        </button>
        <button type="button" className="ghost-btn" onClick={() => void exportBitwarden()}>
          导出未加密 JSON
        </button>
        <button
          type="button"
          className="ghost-btn"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          {busy ? '导入中…' : '导入'}
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
      </div>
      <p className="muted">
        加密备份是密文，恢复会整库替换。未加密 JSON / CSV 含明文密码，导入时按主机+协议+用户名合并。
      </p>
      {message && <div className="banner banner-ok">{message}</div>}
      {error && <div className="banner banner-danger">{error}</div>}
    </div>
  );
}
