export function Brand({ subtitle }: { subtitle?: string }) {
  return (
    <div className="brand">
      <div className="brand-mark" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M2 12.5h12M3.5 12.5V8l2.2-1.2L8 8l2.3-1.2 2.2 1.2v4.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div>
        <h1>页架</h1>
        <p>{subtitle ?? 'SiteShelf · 本地保藏'}</p>
      </div>
    </div>
  );
}
