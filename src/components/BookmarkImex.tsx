import { useRef, useState } from 'react';
import { addCategory, listCustomCategories } from '../lib/categories';
import { listBookmarks, upsertBookmark } from '../lib/db';
import { datedFilename, downloadTextFile } from '../lib/imex/download';
import {
  parseBookmarksImport,
  serializeBookmarksExport,
} from '../lib/imex/bookmarks';

export function BookmarkImex({ onImported }: { onImported: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const exportJson = async () => {
    setError('');
    setMessage('');
    try {
      const [bookmarks, categories] = await Promise.all([
        listBookmarks(),
        listCustomCategories(),
      ]);
      const payload = serializeBookmarksExport({ categories, bookmarks });
      downloadTextFile(
        datedFilename('siteshelf-bookmarks', 'json'),
        JSON.stringify(payload, null, 2),
      );
      setMessage(`已导出 ${bookmarks.length} 条保藏。`);
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
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error('请选择页架 JSON 导出文件。');
      }
      const { categories, drafts, skipped } = parseBookmarksImport(parsed);
      for (const name of categories) {
        try {
          await addCategory(name);
        } catch {
          /* duplicate / invalid */
        }
      }
      let imported = 0;
      for (const draft of drafts) {
        await upsertBookmark(draft);
        imported += 1;
      }
      setMessage(`已导入 ${imported} 条${skipped ? `，跳过 ${skipped} 条` : ''}。`);
      onImported();
    } catch (err) {
      setError(err instanceof Error ? err.message : '导入失败。');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="row" style={{ flexWrap: 'wrap' }}>
      <button type="button" className="ghost-btn" onClick={() => void exportJson()}>
        导出 JSON
      </button>
      <button
        type="button"
        className="ghost-btn"
        disabled={busy}
        onClick={() => fileRef.current?.click()}
      >
        {busy ? '导入中…' : '导入 JSON'}
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
      {message && <span className="muted">{message}</span>}
      {error && <span className="muted" style={{ color: 'var(--danger)' }}>{error}</span>}
    </div>
  );
}
