import { useState } from 'react';
import { upsertBookmark } from '../lib/db';
import { UNCATEGORIZED, type Bookmark } from '../lib/types';
import { isRestrictedUrl, normalizeUrl, parseHttpUrl } from '../lib/url';

export function BookmarkAddForm({
  onSaved,
  onCancel,
}: {
  onSaved: (bookmark: Bookmark) => void;
  onCancel?: () => void;
}) {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const parsed = parseHttpUrl(url);
      if (!parsed) {
        setError('请粘贴有效的 http(s) 网址。');
        return;
      }
      if (isRestrictedUrl(parsed.toString())) {
        setError('无法保藏浏览器内部页或受保护地址。');
        return;
      }
      const href = parsed.toString();
      const { bookmark } = await upsertBookmark({
        url: href,
        normalizedUrl: normalizeUrl(href),
        title: title.trim() || parsed.hostname,
        description: '',
        favicon: '',
        ogImage: '',
        excerpt: '',
        summary: '',
        category: UNCATEGORIZED,
        tags: [],
      });
      onSaved(bookmark);
    } catch {
      setError('保存失败，请稍后重试。');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack" style={{ padding: 0 }}>
      <div className="field">
        <label>网址</label>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="粘贴 https://example.com"
          autoComplete="off"
          inputMode="url"
        />
      </div>
      <div className="field">
        <label>标题（可选）</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="留空则使用主机名"
        />
      </div>
      {error && <div className="banner banner-danger">{error}</div>}
      <div className="row">
        <button
          type="button"
          className="primary-btn"
          disabled={busy || !url.trim()}
          onClick={() => void submit()}
        >
          {busy ? '保存中…' : '保存'}
        </button>
        {onCancel && (
          <button type="button" className="ghost-btn" onClick={onCancel}>
            取消
          </button>
        )}
      </div>
    </div>
  );
}
