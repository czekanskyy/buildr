import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BuildrSectionBoundary } from './section-boundary.tsx';

describe('BuildrSectionBoundary', () => {
  it('renders its children', () => {
    expect(renderToStaticMarkup(<BuildrSectionBoundary>ok</BuildrSectionBoundary>)).toBe('ok');
  });

  it('turns an error into the failed state, which shows the fallback', () => {
    expect(BuildrSectionBoundary.getDerivedStateFromError()).toEqual({ failed: true });
    const boundary = new BuildrSectionBoundary({ fallback: 'sorry', children: 'x' });
    boundary.state = { failed: true };
    expect(boundary.render()).toBe('sorry');
  });
});
