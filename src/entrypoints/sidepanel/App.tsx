import { useCallback, useEffect, useMemo, useState } from 'react';
import { Brand } from '../../components/Brand';
import { BookmarkEditor } from '../../components/BookmarkEditor';
import { CategoryBadge, CategoryChips } from '../../components/CategoryChips';
import { EmptyState } from '../../components/EmptyState';
import { Favicon } from '../../components/Favicon';
import { deleteBookmark, listBookmarks } from '../../lib/db';
import { BOOKMARKS_CHANGED_MESSAGE, type Bookmark } from '../../lib/types';
import { TabBar } from '../../components/TabBar';
import { VaultLibrary } from '../../components/vault/VaultLibrary';

export default function App() {
  const [items, setItems] = useState<Bookmark[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('全部');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [tab, setTab] = useState<'shelf' | 'vault'>('shelf');

  const reload = useCallback(async () => {
    setItems(await listBookmarks());
  }, []);

  useEffect(() => {
    void reload();
    const onMessage = (msg: { type?: string }) => {
      if (msg?.type === BOOKMARKS_CHANGED_MESSAGE) void reload();
    };
    browser.runtime.onMessage.addListener(onMessage);
    return () => browser.runtime.onMessage.removeListener(onMessage);
  }, [reload]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (category !== '全部' && item.category !== category) return false;
      if (!q) return true;
      const hay = [item.title, item.summary, item.url, item.description, item.tags.join(' ')]
        .join('\n')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [items, query, category]);

  const openTab = (url: string) => {
    void browser.tabs.create({ url });
  };

  const confirmDelete = async (id: string) => {
    await deleteBookmark(id);
    setPendingDelete(null);
    if (editingId === id) setEditingId(null);
    await reload();
  };

  return (
    <div className="app-shell">
      <div className="topbar">
        <Brand subtitle={tab === 'vault' ? '本机保险库' : `${items.length} 条保藏`} />
      </div>
      <div className="stack" style={{ paddingBottom: 0 }}>
        <TabBar
          tabs={[
            { id: 'shelf', label: '页架' },
            { id: 'vault', label: '保险库' },
          ]}
          value={tab}
          onChange={(id) => setTab(id as 'shelf' | 'vault')}
        />
      </div>
      {tab === 'vault' ? (
        <div className="stack">
          <VaultLibrary />
        </div>
      ) : (
      <div className="stack">
        <input
          className="search-input"
          placeholder="搜索标题、摘要、标签或网址"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <CategoryChips includeAll value={category} onChange={setCategory} />

        {items.length === 0 && (
          <EmptyState
            title="页架还是空的"
            detail="打开任意普通网页，点击工具栏图标保藏。"
          />
        )}
        {items.length > 0 && filtered.length === 0 && (
          <EmptyState title="没有匹配的保藏" detail="试试其他关键词或分类。" />
        )}

        <div className="list">
          {filtered.map((item) => (
            <article key={item.id} className="card item">
              <div className="item-head">
                <Favicon src={item.favicon || item.ogImage} title={item.title} url={item.url} />
                <div className="preview-body">
                  <h2 className="item-title" title={item.title}>
                    {item.title}
                  </h2>
                  <p className="item-summary">{item.summary || '（尚未生成摘要）'}</p>
                </div>
              </div>
              <div className="chips">
                <CategoryBadge category={item.category} />
                {item.tags.map((tag) => (
                  <span className="chip" key={tag}>
                    {tag}
                  </span>
                ))}
              </div>
              <div className="item-actions">
                <button type="button" className="ghost-btn" onClick={() => openTab(item.url)}>
                  打开
                </button>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => setEditingId((id) => (id === item.id ? null : item.id))}
                >
                  {editingId === item.id ? '收起' : '编辑'}
                </button>
                {pendingDelete === item.id ? (
                  <>
                    <button
                      type="button"
                      className="danger-btn"
                      onClick={() => void confirmDelete(item.id)}
                    >
                      确认删除
                    </button>
                    <button type="button" className="icon-btn" onClick={() => setPendingDelete(null)}>
                      取消
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="danger-btn"
                    onClick={() => setPendingDelete(item.id)}
                  >
                    删除
                  </button>
                )}
              </div>
              {editingId === item.id && (
                <BookmarkEditor
                  bookmark={item}
                  onChange={(next) =>
                    setItems((prev) => prev.map((row) => (row.id === next.id ? next : row)))
                  }
                />
              )}
            </article>
          ))}
        </div>
      </div>
      )}
    </div>
  );
}
