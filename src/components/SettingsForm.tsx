import { useEffect, useState } from 'react';
import { loadAiSettings, saveAiSettings } from '../lib/settings';
import { DEFAULT_AI_SETTINGS, type AiSettings } from '../lib/types';

export function SettingsForm({ compact }: { compact?: boolean }) {
  const [settings, setSettings] = useState<AiSettings>(DEFAULT_AI_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    void loadAiSettings().then(setSettings);
  }, []);

  const update = (patch: Partial<AiSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
    setSaved(false);
  };

  const onSave = async () => {
    await saveAiSettings(settings);
    setSaved(true);
  };

  return (
    <div className="stack" style={{ padding: compact ? 0 : undefined }}>
      <div className="field">
        <label>分类引擎</label>
        <select
          value={settings.provider}
          onChange={(e) =>
            update({ provider: e.target.value as AiSettings['provider'] })
          }
        >
          <option value="auto">自动：优先 Prompt API，失败则用兼容 API</option>
          <option value="prompt-api">仅使用 Chrome Prompt API</option>
          <option value="openai-compatible">仅使用 OpenAI 兼容 API</option>
        </select>
      </div>
      <div className="field">
        <label>API 地址（Base URL）</label>
        <input
          value={settings.baseUrl}
          placeholder="https://api.openai.com/v1"
          onChange={(e) => update({ baseUrl: e.target.value })}
          autoComplete="off"
        />
      </div>
      <div className="field">
        <label>模型名</label>
        <input
          value={settings.model}
          placeholder="gpt-4o-mini"
          onChange={(e) => update({ model: e.target.value })}
          autoComplete="off"
        />
      </div>
      <div className="field">
        <label>API 密钥</label>
        <input
          type={showKey ? 'text' : 'password'}
          value={settings.apiKey}
          placeholder="仅保存在本机 chrome.storage.local"
          onChange={(e) => update({ apiKey: e.target.value })}
          autoComplete="off"
        />
        <button type="button" className="icon-btn" onClick={() => setShowKey((v) => !v)}>
          {showKey ? '隐藏密钥' : '显示密钥'}
        </button>
      </div>
      <div className="row">
        <button type="button" className="primary-btn" onClick={() => void onSave()}>
          保存设置
        </button>
        {saved && <span className="muted">已保存到本机</span>}
      </div>
      {!compact && (
        <p className="muted">
          Prompt API 需要 Chrome 138+ 且设备满足本地模型要求。密钥只会发送到你填写的
          Base URL，扩展不会上传到其他服务器。
        </p>
      )}
    </div>
  );
}
