import { useCallback, useEffect, useState } from 'react';
import {
  addCategory,
  ALL_FILTER,
  CATEGORIES_STORAGE_KEY,
  listCategoryNames,
  listCustomCategories,
  removeCategory,
} from '../lib/categories';
import { UNCATEGORIZED, type Category } from '../lib/types';

export function CategoryChips({
  value,
  onChange,
  includeAll,
  includeUncategorized = true,
  allowCreate = false,
}: {
  value: string;
  onChange: (next: string) => void;
  includeAll?: boolean;
  includeUncategorized?: boolean;
  allowCreate?: boolean;
}) {
  const [names, setNames] = useState<string[]>([]);
  const [custom, setCustom] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      const [live, extra] = await Promise.all([listCategoryNames(), listCustomCategories()]);
      setNames(live);
      setCustom(extra);
    } catch {
      setNames([]);
      setCustom([]);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const listener = (
      changes: Record<string, { newValue?: unknown }>,
      area: string,
    ) => {
      if (area === 'local' && changes[CATEGORIES_STORAGE_KEY]) void refresh();
    };
    try {
      browser.storage.onChanged.addListener(listener);
      return () => browser.storage.onChanged.removeListener(listener);
    } catch {
      return undefined;
    }
  }, [refresh]);

  const options: string[] = [
    ...(includeAll ? [ALL_FILTER] : []),
    ...names,
    ...(includeUncategorized ? [UNCATEGORIZED] : []),
  ];

  const submitAdd = async () => {
    setError('');
    try {
      const created = await addCategory(draft);
      setDraft('');
      setAdding(false);
      await refresh();
      onChange(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : '无法新增分类。');
    }
  };

  const onRemove = async (name: string) => {
    if (!custom.includes(name)) return;
    if (!window.confirm(`删除分类「${name}」后，使用该分类的保藏将改为「其他」。确定？`)) {
      return;
    }
    setError('');
    try {
      await removeCategory(name);
      await refresh();
      if (value === name) onChange('其他');
    } catch (err) {
      setError(err instanceof Error ? err.message : '无法删除分类。');
    }
  };

  return (
    <div className="stack" style={{ padding: 0, gap: 8 }}>
      <div className="chips" role="listbox" aria-label="分类">
        {options.map((item) => (
          <span key={item} className="chip-wrap">
            <button
              type="button"
              className={`chip ${value === item ? 'chip-active' : ''}`}
              onClick={() => onChange(item)}
            >
              {item}
            </button>
            {allowCreate && custom.includes(item) && (
              <button
                type="button"
                className="chip-x"
                aria-label={`删除 ${item}`}
                onClick={() => void onRemove(item)}
              >
                ×
              </button>
            )}
          </span>
        ))}
        {allowCreate && !adding && (
          <button type="button" className="chip chip-add" onClick={() => setAdding(true)}>
            + 新增分类
          </button>
        )}
        {allowCreate && adding && (
          <span className="chip-wrap">
            <input
              className="chip-add-input"
              value={draft}
              maxLength={12}
              placeholder="1–12 字"
              autoFocus
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void submitAdd();
                if (e.key === 'Escape') {
                  setAdding(false);
                  setDraft('');
                }
              }}
            />
            <button type="button" className="icon-btn" onClick={() => void submitAdd()}>
              添加
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={() => {
                setAdding(false);
                setDraft('');
              }}
            >
              取消
            </button>
          </span>
        )}
      </div>
      {error && <div className="banner banner-danger">{error}</div>}
    </div>
  );
}

export function CategoryBadge({ category }: { category: Category }) {
  return <span className="chip chip-plain">{category}</span>;
}
