import { useState } from 'react';
import { hostnameOf } from '../lib/url';

export function Favicon({
  src,
  title,
  url,
}: {
  src?: string;
  title: string;
  url: string;
}) {
  const [failed, setFailed] = useState(!src);
  const letter = (title || hostnameOf(url) || '页').slice(0, 1).toUpperCase();

  if (failed) {
    return (
      <div className="favicon fallback" aria-hidden="true">
        {letter}
      </div>
    );
  }

  return (
    <img
      className="favicon"
      src={src}
      alt=""
      onError={() => setFailed(true)}
    />
  );
}
