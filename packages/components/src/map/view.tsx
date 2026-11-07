import type { BuilderComponentProps } from '@next-buildr/react';
import { IFRAME_ASPECT_RATIOS } from '../iframe/props.ts';
import { hostsFrom } from '../media/external.ts';
import { message } from '../messages/index.ts';
import { MapEnhancer } from './enhancer.client.tsx';
import { MAP_REFERRER_POLICY, MAP_SANDBOX, type mapProps } from './props.ts';
import { buildMapUrls } from './url.ts';
export function MapView({ props, root, env, platform }: BuilderComponentProps<typeof mapProps>) {
  const canvas = env.mode === 'canvas';
  // Never read the provider config in the canvas, including through a getter.
  const maps = canvas ? undefined : platform?.maps;
  const urls = buildMapUrls({
    ...props,
    locale: env.locale,
    apiKey: maps?.apiKey,
    iframeHosts: hostsFrom(env, 'iframeHosts'),
  });
  if (urls.kind === 'nothing')
    return canvas ? (
      <div {...root} data-embed-invalid="invalid">
        <p>{message(env, 'map.invalid')}</p>
      </div>
    ) : null;
  const title =
    props.title.trim() || message(env, 'map.title').replace('{query}', () => urls.query);
  const ratio = IFRAME_ASPECT_RATIOS.includes(props.aspectRatio as never)
    ? props.aspectRatio
    : '16:9';
  return (
    <div {...root} data-ratio={ratio}>
      {canvas ? (
        <div className="bc-map__placeholder">
          <p>{message(env, 'map.canvas')}</p>
        </div>
      ) : urls.kind === 'frame' ? (
        maps?.clickToLoad === false ? (
          <iframe
            className="bc-map__frame"
            src={urls.frameUrl}
            title={title}
            sandbox={MAP_SANDBOX}
            referrerPolicy={MAP_REFERRER_POLICY}
            loading="lazy"
          />
        ) : (
          <MapEnhancer
            src={urls.frameUrl}
            title={title}
            notice={message(env, 'map.notice')}
            button={message(env, 'map.button')}
          />
        )
      ) : null}
      <a className="bc-map__link" href={urls.linkUrl} target="_blank" rel="noopener noreferrer">
        {message(env, 'map.link')} ({message(env, 'map.newTab')})
      </a>
    </div>
  );
}
