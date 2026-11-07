'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { MAP_REFERRER_POLICY, MAP_SANDBOX } from './props.ts';
export function MapEnhancer({
  src,
  title,
  notice,
  button,
}: {
  src: string;
  title: string;
  notice: string;
  button: string;
}) {
  const [ready, setReady] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  const id = useId();
  useEffect(() => {
    setReady(true);
  }, []);
  useEffect(() => {
    if (loaded) frame.current?.focus();
  }, [loaded]);
  if (loaded)
    return (
      <iframe
        ref={frame}
        className="bc-map__frame"
        src={src}
        title={title}
        sandbox={MAP_SANDBOX}
        referrerPolicy={MAP_REFERRER_POLICY}
        loading="lazy"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: ADR-029 requires focus on the loaded iframe.
        tabIndex={0}
      />
    );
  return (
    <div className="bc-map__placeholder">
      <p className="bc-map__notice" id={id}>
        {notice}
      </p>
      <button
        className="bc-map__button"
        type="button"
        hidden={!ready}
        aria-describedby={id}
        onClick={() => setLoaded(true)}
      >
        {button}
      </button>
    </div>
  );
}
