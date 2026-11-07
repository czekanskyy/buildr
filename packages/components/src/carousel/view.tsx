import type { BuilderComponentProps } from '@next-buildr/react';
import { message } from '../messages/index.ts';
import { CarouselEnhancer } from './enhancer.client.tsx';
import { type carouselProps, clampCarouselNumber } from './props.ts';

export function CarouselView({
  props,
  root,
  children,
  env,
}: BuilderComponentProps<typeof carouselProps>) {
  return (
    <section
      {...root}
      aria-roledescription={message(env, 'carousel.roledescription')}
      aria-label={props.ariaLabel || message(env, 'carousel.label')}
    >
      {env.mode !== 'canvas' && (
        <CarouselEnhancer
          showArrows={props.showArrows}
          showDots={props.showDots}
          loop={props.loop}
          autoplay={props.autoplay}
          interval={clampCarouselNumber(props.interval, 3000, 20000)}
          previous={message(env, 'carousel.previous')}
          next={message(env, 'carousel.next')}
          goTo={message(env, 'carousel.goTo')}
          slides={message(env, 'carousel.slides')}
          pause={message(env, 'carousel.pause')}
          play={message(env, 'carousel.play')}
          slideOf={message(env, 'carousel.slideOf')}
        />
      )}
      <div
        className="bc-carousel__track"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: Native scroll regions must be focusable.
        tabIndex={0}
        data-per-view={clampCarouselNumber(props.slidesPerView, 1, 4)}
      >
        {children}
      </div>
    </section>
  );
}
