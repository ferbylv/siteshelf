import { useCallback, useEffect, useState } from 'react';
import { PendingSaveBanner } from './PendingSaveBanner';
import { SetupForm } from './SetupForm';
import { UnlockForm } from './UnlockForm';
import { getActiveTab } from '../../lib/capture';
import { maskPassword } from '../../lib/vault/encoding';
import { parsePageTarget, recordMatchesPage } from '../../lib/vault/match';
import {
  lockVaultNow,
  matchesForUrl,
  readPending,
  syncPendingBadge,
  vaultStatus,
} from '../../lib/vault/service';
import {
  VAULT_MSG,
  VAULT_PENDING_MESSAGE,
  type LoginRecord,
  type PendingSave,
} from '../../lib/vault/types';
import { openLibraryPanel } from '../../lib/sidepanel';

type Gate = 'loading' | 'setup' | 'locked' | 'open';

export function PopupVault() {
  const [gate, setGate] = useState<Gate>('loading');
  const [tabUrl, setTabUrl] = useState('');
  const [matches, setMatches] = useState<LoginRecord[]>([]);
  const [pending, setPending] = useState<PendingSave | undefined>();
  const [message, setMessage] = useState('');
  const [fillingId, setFillingId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const status = await vaultStatus();
    const tab = await getActiveTab().catch(() => undefined);
    const url = tab?.url || '';
    setTabUrl(url);
    // Pending is tab-scoped: only this tab's staged login can be confirmed here.
    setPending(typeof tab?.id === 'number' ? await readPending(tab.id) : undefined);
    void syncPendingBadge(tab?.id);
    if (!status.setup) {
      setGate('setup');
      return;
    }
    if (!status.unlocked) {
      setGate('locked');
      setMatches([]);
      return;
    }
    setGate('open');
    if (url) setMatches(await matchesForUrl(url));
    else setMatches([]);
  }, []);

  useEffect(() => {
    void reload();
    const onMessage = (msg: { type?: string }) => {
      if (msg?.type === VAULT_PENDING_MESSAGE) void reload();
    };
    browser.runtime.onMessage.addListener(onMessage);
    return () => browser.runtime.onMessage.removeListener(onMessage);
  }, [reload]);

  const fill = async (record: LoginRecord) => {
    setFillingId(record.id);
    setMessage('');
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) throw new Error('no-tab');
      const page = parsePageTarget(tab.url);
      if (!page || !recordMatchesPage(record, page)) {
        setMessage('当前页面与保存的源站不一致，已取消填充。');
        return;
      }
      await browser.tabs.sendMessage(tab.id, {
        type: VAULT_MSG.DO_FILL,
        username: record.username,
        password: record.password,
      });
      setMessage('已发送填充。');
    } catch {
      setMessage('无法填充此页。请打开普通 https 登录页后重试。');
    } finally {
      setFillingId(null);
    }
  };

  const pendingBanner =
    pending && gate !== 'loading' ? (
      <PendingSaveBanner
        pending={pending}
        gate={gate}
        onChanged={() => {
          setMessage('');
          void reload();
        }}
      />
    ) : null;

  if (gate === 'loading') {
    return (
      <div className="banner banner-warn row">
        <span className="spinner" />
        <span>正在读取保险库…</span>
      </div>
    );
  }
  if (gate === 'setup') {
    return (
      <>
        {pendingBanner}
        <SetupForm onReady={() => void reload()} />
      </>
    );
  }
  if (gate === 'locked') {
    return (
      <>
        {pendingBanner}
        <UnlockForm onReady={() => void reload()} />
      </>
    );
  }

  const page = parsePageTarget(tabUrl);

  return (
    <>
      {pendingBanner}

      <div className="card preview">
        <div className="preview-body">
          <h2>当前站点</h2>
          <div className="preview-url">{page ? page.origin : '无法在此页填充'}</div>
        </div>
      </div>

      {page && matches.length === 0 && (
        <EmptyLine text="此主机还没有保存的登录。提交登录表单后会询问是否保存。" />
      )}
      {page && matches.length > 1 && (
        <div className="banner banner-warn">有多条匹配，请选择，不会自动猜测。</div>
      )}

      <div className="list">
        {matches.map((item) => (
          <article key={item.id} className="card item">
            <h2 className="item-title">{item.username || '（无用户名）'}</h2>
            <p className="muted">
              {item.title} · {maskPassword(item.password)}
            </p>
            <button
              type="button"
              className="primary-btn"
              disabled={fillingId === item.id}
              onClick={() => void fill(item)}
            >
              {fillingId === item.id ? '填充中…' : '填充到当前页'}
            </button>
          </article>
        ))}
      </div>

      {message && <div className="banner banner-ok">{message}</div>}

      <div className="row">
        <button type="button" className="ghost-btn" onClick={() => void openLibraryPanel()}>
          打开保险库
        </button>
        <button
          type="button"
          className="ghost-btn"
          onClick={() => {
            void lockVaultNow();
            void reload();
          }}
        >
          锁定
        </button>
      </div>
    </>
  );
}

function EmptyLine({ text }: { text: string }) {
  return <p className="muted">{text}</p>;
}
