import { Brand } from '../../components/Brand';
import { SettingsForm } from '../../components/SettingsForm';

export default function App() {
  return (
    <div className="app-shell">
      <div className="options-wrap">
        <div className="topbar">
          <Brand subtitle="本机 AI 设置 · 不含账号" />
        </div>
        <div className="stack">
          <div className="card" style={{ padding: 16 }}>
            <p className="muted" style={{ marginBottom: 12 }}>
              页架只保藏公开网页元数据。分类优先使用 Chrome 内置 Prompt API；也可填写
              OpenAI 兼容接口作为后备。密钥只存在本机。
            </p>
            <SettingsForm />
          </div>
        </div>
      </div>
    </div>
  );
}
