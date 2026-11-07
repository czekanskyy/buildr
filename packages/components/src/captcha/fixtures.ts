import type { ComponentFixture } from '../fixtures.ts';

export const captchaFixtures: readonly ComponentFixture[] = [
  {
    id: 'captcha-default',
    title: 'Captcha: form verification',
    tree: {
      type: 'buildr/form',
      children: [
        { type: 'buildr/captcha' },
        { type: 'buildr/button', props: { type: { kind: 'static', value: 'submit' } } },
      ] as never,
    },
  },
];
