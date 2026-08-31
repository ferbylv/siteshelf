import { useState } from 'react';

export function TagInput({
  tags,
  onChange,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
}) {
  const [draft, setDraft] = useState('');

  const add = (raw: string) => {
    const next = raw
      .split(/[,，]/)
      .map((t) => t.trim())
      .filter(Boolean);
    if (!next.length) return;
    const merged = [...tags];
    for (const tag of next) {
      if (!merged.includes(tag)) merged.push(tag.slice(0, 16));
    }
    onChange(merged.slice(0, 8));
    setDraft('');
  };

  return (
    <div className="tags">
      {tags.map((tag) => (
        <span className="tag" key={tag}>
          {tag}
          <button
            type="button"
            aria-label={`移除 ${tag}`}
            onClick={() => onChange(tags.filter((t) => t !== tag))}
          >
            ×
          </button>
        </span>
      ))}
      <input
        value={draft}
        placeholder={tags.length ? '添加标签' : '输入标签后回车'}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            add(draft);
          }
          if (e.key === 'Backspace' && !draft && tags.length) {
            onChange(tags.slice(0, -1));
          }
        }}
        onBlur={() => add(draft)}
        style={{
          border: 0,
          background: 'transparent',
          minWidth: 96,
          padding: 4,
          outline: 'none',
        }}
      />
    </div>
  );
}
