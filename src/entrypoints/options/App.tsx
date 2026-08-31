import { Brand } from '../../components/Brand';
import { SettingsForm } from '../../components/SettingsForm';
import { ChangePasswordForm } from '../../components/vault/ChangePasswordForm';
import { SetupForm } from '../../components/vault/SetupForm';
import { UnlockForm } from '../../components/vault/UnlockForm';
import { useEffect, useState } from 'react';
import { loadVaultSettings, saveVaultSettings } from '../../lib/vault/settings';
import { lockVaultNow, vaultStatus } from '../../lib/vault/service';
import type { VaultIdleMinutes } from '../../lib/vault/types';

export default function App() {
  const [setup, setSetup] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [idleMinutes, setIdleMinutes] = useState<VaultIdleMinutes>(15);
  const [ready, setReady] = useState(false);

  const reload = async () => {
    const status = await vaultStatus();
    setSetup(status.setup);
    setUnlocked(status.unlocked);
    setIdleMinutes((await loadVaultSettings()).idleMinutes);
    setReady(true);
  };

  useEffect(() => {
    void reload();
  }, []);

  return (
    <div className="app-shell">
      <div className="options-wrap">
        <div className="topbar">
          <Brand subtitle="本机设置 · 不含账号" />
        </div>
        <div className="stack">
          <div className="card" style={{ padding: 16 }}>
            <p className="muted" style={{ marginBottom: 12 }}>
              页架只保藏公开网页元数据。分类优先使用 Chrome 内置 Prompt API；也可填写
              OpenAI 兼容接口作为后备。密钥只存在本机。保险库与书签完全分开，登录密码不会进入
              AI 请求。
            </p>
            <SettingsForm />
          </div>
          <div className="card" style={{ padding: 16 }}>
            <h2 style={{ marginBottom: 8 }}>保险库</h2>
            {!ready && <p className="muted">正在读取…</p>}
            {ready && !setup && <SetupForm onReady={() => void reload()} />}
            {ready && setup && !unlocked && <UnlockForm onReady={() => void reload()} />}
            {ready && setup && unlocked && (
              <div className="stack" style={{ padding: 0 }}>
                <div className="field">
                  <label>闲置自动锁定</label>
                  <select
                    value={idleMinutes}
                    onChange={(e) => {
                      const next = Number(e.target.value) as VaultIdleMinutes;
                      setIdleMinutes(next);
                      void saveVaultSettings({ idleMinutes: next });
                    }}
                  >
                    <option value={0}>仅在关闭浏览器时锁定</option>
                    <option value={5}>5 分钟</option>
                    <option value={15}>15 分钟</option>
                    <option value={30}>30 分钟</option>
                  </select>
                </div>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => {
                    void lockVaultNow();
                    void reload();
                  }}
                >
                  立即锁定
                </button>
                <ChangePasswordForm />
                <p className="muted">主密码无法找回。忘记后只能丢弃保险库数据。</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
