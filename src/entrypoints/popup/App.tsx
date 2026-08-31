import { useEffect, useState } from 'react';
import { Brand } from '../../components/Brand';
import { BookmarkEditor } from '../../components/BookmarkEditor';
import { Favicon } from '../../components/Favicon';
import { SettingsForm } from '../../components/SettingsForm';
import { classifyPage } from '../../lib/ai';
import { CaptureError, captureActiveTab, getActiveTab } from '../../lib/capture';
import { getByNormalizedUrl, upsertBookmark } from '../../lib/db';
import { isRestrictedUrl, normalizeUrl } from '../../lib/url';
import { openLibraryPanel } from '../../lib/sidepanel';
import type { Bookmark } from '../../lib/types';

type Phase =
  | 'loading'
  | 'idle'
  | 'restricted'
  | 'working'
  | 'done'
  | 'error';

export default function App() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [tabTitle, setTabTitle] = useState('');
  const [tabUrl, setTabUrl] = useState('');
  const [tabFavicon, setTabFavicon] = useState('');
  const [existing, setExisting] = useState<Bookmark | undefined>();
  const [bookmark, setBookmark] = useState<Bookmark | undefined>();
  const [message, setMessage] = useState('');
  const [aiFailed, setAiFailed] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const tab = await getActiveTab();
        const url = tab.url || '';
        setTabTitle(tab.title || '');
        setTabUrl(url);
        setTabFavicon(tab.favIconUrl || '');
        if (isRestrictedUrl(url)) {
          setPhase('restricted');
          setMessage(
            '当前标签页无法读取（浏览器内部页、扩展商店或受保护页面）。请打开普通网页后再试。',
          );
          return;
        }
        const found = await getByNormalizedUrl(normalizeUrl(url));
        setExisting(found);
        if (found) setBookmark(found);
        setPhase('idle');
      } catch {
        setPhase('error');
        setMessage('无法读取当前标签页。');
      }
    })();
  }, []);

  const saveCurrent = async () => {
    setPhase('working');
    setMessage('正在读取页面公开信息…');
    setAiFailed(false);
    try {
      const meta = await captureActiveTab();
      setTabTitle(meta.title);
      setTabUrl(meta.url);
      setTabFavicon(meta.favicon);
      setMessage('正在生成摘要与分类…');
      const { result, source, error } = await classifyPage(meta);
      const summary =
        result.summary ||
        (source === 'none' ? '' : result.summary);
      const { bookmark: saved, duplicated: wasDup } = await upsertBookmark({
        url: meta.url,
        normalizedUrl: meta.normalizedUrl,
        title: meta.title,
        description: meta.description,
        favicon: meta.favicon,
        ogImage: meta.ogImage,
        excerpt: meta.excerpt,
        summary: summary || meta.description || '（尚未生成摘要）',
        category: result.category,
        tags: result.tags,
      });
      setBookmark(saved);
      setExisting(saved);
      setAiFailed(source === 'none');
      if (source === 'none') {
        setMessage(
          error
            ? `AI 暂不可用（${error}）。已按「未分类」保藏，可稍后编辑。`
            : 'AI 暂不可用。已按「未分类」保藏，可稍后编辑。',
        );
      } else if (wasDup) {
        setMessage('此地址已在页架中，已就地更新。');
      } else {
        setMessage('已保藏。可继续改摘要、分类或标签。');
      }
      setPhase('done');
    } catch (err) {
      const text =
        err instanceof CaptureError
          ? err.message
          : '保藏失败，请稍后重试。';
      setMessage(text);
      setPhase(err instanceof CaptureError && err.code === 'restricted' ? 'restricted' : 'error');
    }
  };

  const openLibrary = () => openLibraryPanel();

  const previewTitle = bookmark?.title || tabTitle || '当前页面';
  const previewUrl = bookmark?.url || tabUrl;
  const previewFavicon = bookmark?.favicon || tabFavicon;

  return (
    <div className="app-shell">
      <div className="topbar">
        <Brand subtitle="保藏当前页" />
        <button type="button" className="ghost-btn" onClick={() => void openLibrary()}>
          打开页架
        </button>
      </div>

      <div className="stack">
        <div className="card preview">
          <Favicon src={previewFavicon} title={previewTitle} url={previewUrl} />
          <div className="preview-body">
            <h2 title={previewTitle}>{previewTitle || '未命名页面'}</h2>
            <div className="preview-url">{previewUrl || '没有可读取的地址'}</div>
          </div>
        </div>

        {existing && phase === 'idle' && (
          <div className="banner banner-ok">此页已在页架中。再次保藏将就地更新。</div>
        )}
        {phase === 'restricted' && <div className="banner banner-danger">{message}</div>}
        {phase === 'error' && <div className="banner banner-danger">{message}</div>}
        {phase === 'working' && (
          <div className="banner banner-warn row">
            <span className="spinner" />
            <span>{message}</span>
          </div>
        )}
        {phase === 'done' && (
          <div className={`banner ${aiFailed ? 'banner-warn' : 'banner-ok'}`}>{message}</div>
        )}

        <button
          type="button"
          className="primary-btn"
          disabled={phase === 'restricted' || phase === 'working' || !tabUrl}
          onClick={() => void saveCurrent()}
        >
          {phase === 'working' ? '保藏中…' : existing ? '更新保藏' : '保藏'}
        </button>

        {bookmark && (phase === 'done' || (phase === 'idle' && existing)) && (
          <BookmarkEditor bookmark={bookmark} onChange={setBookmark} />
        )}
      </div>

      <div className="footer-links">
        <button type="button" className="icon-btn" onClick={() => setShowSettings((v) => !v)}>
          {showSettings ? '收起设置' : 'AI 设置'}
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={() => void browser.runtime.openOptionsPage()}
        >
          选项页
        </button>
      </div>

      {showSettings && (
        <div className="stack">
          <SettingsForm compact />
        </div>
      )}
    </div>
  );
}
