import { useEffect, useRef } from 'react';
import { BookmarkVaultSave } from './BookmarkVaultSave';
import { CategoryChips } from './CategoryChips';
import { TagInput } from './TagInput';
import { updateBookmark } from '../lib/db';
import type { Bookmark, Category } from '../lib/types';

export function BookmarkEditor({
  bookmark,
  onChange,
  vaultSave = true,
}: {
  bookmark: Bookmark;
  onChange?: (next: Bookmark) => void;
  vaultSave?: boolean;
}) {
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  const persist = (patch: Partial<Bookmark>) => {
    const next = { ...bookmark, ...patch };
    onChange?.(next);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      void updateBookmark(bookmark.id, {
        summary: next.summary,
        category: next.category,
        tags: next.tags,
        title: next.title,
      });
    }, 350);
  };

  return (
    <div className="stack" style={{ padding: 0 }}>
      <div className="field">
        <label>摘要</label>
        <textarea
          value={bookmark.summary}
          placeholder="一句话说明这个页面是做什么的"
          onChange={(e) => persist({ summary: e.target.value })}
        />
      </div>
      <div className="field">
        <label>分类</label>
        <CategoryChips
          value={bookmark.category}
          includeUncategorized
          allowCreate
          onChange={(category) => persist({ category: category as Category })}
        />
      </div>
      <div className="field">
        <label>标签</label>
        <div className="card" style={{ padding: 8 }}>
          <TagInput tags={bookmark.tags} onChange={(tags) => persist({ tags })} />
        </div>
      </div>
      {vaultSave && <BookmarkVaultSave url={bookmark.url} title={bookmark.title} />}
    </div>
  );
}
