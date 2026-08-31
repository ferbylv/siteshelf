import { useCallback, useEffect, useMemo, useState } from 'react';
import { EmptyState } from '../EmptyState';
import { Favicon } from '../Favicon';
import { ChangePasswordForm } from './ChangePasswordForm';
import { LoginEditor } from './LoginEditor';
import { PendingSaveBanner } from './PendingSaveBanner';
import { SetupForm } from './SetupForm';
import { UnlockForm } from './UnlockForm';
import { getActiveTab } from '../../lib/capture';
import { maskPassword } from '../../lib/vault/encoding';
import {
  deleteLogin,
  listLogins,
  lockVaultNow,
  readPending,
  vaultStatus,
} from '../../lib/vault/service';
import {
  VAULT_CHANGED_MESSAGE,
  VAULT_PENDING_MESSAGE,
  VAULT_SESSION_MESSAGE,
  type LoginRecord,
  type PendingSave,
} from '../../lib/vault/types';
import { loadVaultSettings, saveVaultSettings } from '../../lib/vault/settings';
import type { VaultIdleMinutes } from '../../lib/vault/types';

type Gate = 'loading' | 'setup' | 'locked' | 'open';

export function VaultLibrary() {
  const [gate, setGate] = useState<Gate>('loading');
  const [items, setItems] = useState<LoginRecord[]>([]);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<LoginRecord | 'new' | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [showChange, setShowChange] = useState(false);
  const [pending, setPending] = useState<PendingSave | undefined>();
  const [idleMinutes, setIdleMinutes] = useState<VaultIdleMinutes>(15);
  const [copied, setCopied] = useState('');

  const reloadGate = useCallback(async () => {
    const status = await vaultStatus();
    try {
      const tab = await getActiveTab();
      setPending(typeof tab.id === 'number' ? await readPending(tab.id) : undefined);
    } catch {
      setPending(undefined);
    }
    if (!status.setup) {
      setGate('setup');
      setItems([]);
      return;
    }
    if (!status.unlocked) {
      setGate('locked');
      setItems([]);
      setRevealed({});
      return;
    }
    setGate('open');
    setItems(await listLogins());
    setIdleMinutes((await loadVaultSettings()).idleMinutes);
  }, []);

  useEffect(() => {
    void reloadGate();
    const onMessage = (msg: { type?: string }) => {
      if (
        msg?.type === VAULT_CHANGED_MESSAGE ||
        msg?.type === VAULT_SESSION_MESSAGE ||
        msg?.type === VAULT_PENDING_MESSAGE
      ) {
        void reloadGate();
      }
    };
    browser.runtime.onMessage.addListener(onMessage);
    return () => browser.runtime.onMessage.removeListener(onMessage);
  }, [reloadGate]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) =>
      [item.title, item.username, item.host, item.url, item.notes].join('\n').toLowerCase().includes(q),
    );
  }, [items, query]);

  const copyText = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied(''), 1600);
    } catch {
      setCopied('');
    }
  };

  if (gate === 'loading') {
    return (
      <div className="banner banner-warn row">
        <span className="spinner" />
        <span>正在读取保险库…</span>
      </div>
    );
  }
  const pendingBanner = pending ? (
    <PendingSaveBanner pending={pending} gate={gate} onChanged={() => void reloadGate()} />
  ) : null;

  if (gate === 'setup') {
    return (
      <>
        {pendingBanner}
        <SetupForm onReady={() => void reloadGate()} />
      </>
    );
  }
  if (gate === 'locked') {
    return (
      <>
        {pendingBanner}
        <UnlockForm onReady={() => void reloadGate()} />
      </>
    );
  }

  return (
    <>
      <div className="toolbar-row">
        <span className="muted">{items.length} 条登录</span>
        <div className="row">
          <button type="button" className="ghost-btn" onClick={() => setEditing('new')}>
            手动添加
          </button>
          <button
            type="button"
            className="ghost-btn"
            onClick={() => {
              void lockVaultNow();
              void reloadGate();
            }}
          >
            锁定
          </button>
        </div>
      </div>

      {pendingBanner}


      <input
        className="search-input"
        placeholder="搜索名称、用户名或主机"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {editing === 'new' && (
        <div className="card item">
          <LoginEditor
            onSaved={() => {
              setEditing(null);
              void reloadGate();
            }}
            onCancel={() => setEditing(null)}
          />
        </div>
      )}

      {items.length === 0 && !editing && (
        <EmptyState
          title="保险库还是空的"
          detail="在 https 登录页提交后，页架会询问是否保存。不会在未确认时写入。"
        />
      )}
      {items.length > 0 && filtered.length === 0 && (
        <EmptyState title="没有匹配的登录" detail="试试其他关键词。" />
      )}

      <div className="list">
        {filtered.map((item) => (
          <article key={item.id} className="card item">
            <div className="item-head">
              <Favicon src="" title={item.title} url={item.url} />
              <div className="preview-body">
                <h2 className="item-title">{item.title || item.host}</h2>
                <p className="item-summary">
                  {item.username} · {item.host}
                </p>
              </div>
            </div>
            <div className="field">
              <label>密码</label>
              <div className="row">
                <span className="mono">
                  {revealed[item.id] ? item.password : maskPassword(item.password)}
                </span>
              </div>
            </div>
            {item.notes && <p className="muted">{item.notes}</p>}
            <div className="item-actions">
              <button
                type="button"
                className="ghost-btn"
                onClick={() => void copyText('用户名', item.username)}
              >
                复制用户名
              </button>
              <button
                type="button"
                className="ghost-btn"
                onClick={() =>
                  setRevealed((prev) => ({ ...prev, [item.id]: !prev[item.id] }))
                }
              >
                {revealed[item.id] ? '隐藏密码' : '显示密码'}
              </button>
              <button
                type="button"
                className="ghost-btn"
                onClick={() => void copyText('密码', item.password)}
              >
                复制密码
              </button>
              <button
                type="button"
                className="ghost-btn"
                onClick={() => setEditing(editing === item ? null : item)}
              >
                {editing === item ? '收起' : '编辑'}
              </button>
              {pendingDelete === item.id ? (
                <>
                  <button
                    type="button"
                    className="danger-btn"
                    onClick={() =>
                      void deleteLogin(item.id).then(() => {
                        setPendingDelete(null);
                        void reloadGate();
                      })
                    }
                  >
                    确认删除
                  </button>
                  <button type="button" className="icon-btn" onClick={() => setPendingDelete(null)}>
                    取消
                  </button>
                </>
              ) : (
                <button type="button" className="danger-btn" onClick={() => setPendingDelete(item.id)}>
                  删除
                </button>
              )}
            </div>
            {copied && <div className="banner banner-ok">已复制{copied}</div>}
            {editing === item && (
              <LoginEditor
                initial={item}
                onSaved={() => {
                  setEditing(null);
                  void reloadGate();
                }}
                onCancel={() => setEditing(null)}
              />
            )}
          </article>
        ))}
      </div>

      <div className="card item">
        <h2>保险库设置</h2>
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
        <button type="button" className="ghost-btn" onClick={() => setShowChange((v) => !v)}>
          {showChange ? '收起主密码' : '更改主密码'}
        </button>
        {showChange && <ChangePasswordForm />}
      </div>
    </>
  );
}
