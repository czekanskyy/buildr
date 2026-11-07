import type { BuilderComponentProps } from '@next-buildr/react';
import { message } from '../messages/index.ts';
import { CAPTCHA_SITE_KEY_REGEX } from './constants.ts';
import { CaptchaCanvasHint, CaptchaEnhancer } from './enhancer.client.tsx';
import type { captchaProps } from './props.ts';

export function CaptchaView({ root, env, platform }: BuilderComponentProps<typeof captchaProps>) {
  if (env.mode === 'canvas')
    return (
      <div {...root} data-bc-captcha="">
        <CaptchaCanvasHint
          text={message(env, 'captcha.canvas')}
          duplicate={message(env, 'captcha.duplicate')}
        />
      </div>
    );
  const captcha = platform?.captcha;
  if (
    captcha?.provider !== 'turnstile' ||
    typeof captcha.siteKey !== 'string' ||
    captcha.siteKey.trim() !== captcha.siteKey ||
    !CAPTCHA_SITE_KEY_REGEX.test(captcha.siteKey)
  )
    return (
      <div {...root} data-bc-captcha="">
        {message(env, 'captcha.unavailable')}
      </div>
    );
  return (
    <div {...root} data-bc-captcha="">
      <CaptchaEnhancer
        siteKey={captcha.siteKey}
        layoutRef={env.layoutRef ?? ''}
        locale={env.locale}
        clickToLoad={env.mode === 'preview' || captcha.clickToLoad !== false}
        texts={{
          notice: message(env, 'captcha.notice'),
          button: message(env, 'captcha.button'),
          loading: message(env, 'captcha.loading'),
          ready: message(env, 'captcha.ready'),
          expired: message(env, 'captcha.expired'),
          error: message(env, 'captcha.error'),
          unavailable: message(env, 'captcha.unavailable'),
        }}
      />
      <noscript>{message(env, 'captcha.noscript')}</noscript>
    </div>
  );
}
