import type { BuilderComponentProps } from '@next-buildr/react';
import { message } from '../messages/index.ts';
import type { carouselSlideProps } from './props.ts';

export function CarouselSlideView({
  root,
  children,
  env,
}: BuilderComponentProps<typeof carouselSlideProps>) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: APG carousel slides are groups, not form fieldsets.
    <div {...root} role="group" aria-roledescription={message(env, 'carousel.slide')}>
      {children}
    </div>
  );
}
