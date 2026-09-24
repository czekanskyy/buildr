// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { editorUrl, editorWindowName, LayoutFieldView } from './layout-field-view.tsx';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('LayoutFieldView', () => {
  let container: HTMLElement;
  let root: Root;
  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });
  const mount = (props: Partial<Parameters<typeof LayoutFieldView>[0]>, open = vi.fn()) => {
    act(() =>
      root.render(
        <LayoutFieldView
          nodeCount={12}
          id="42"
          collection="pages"
          editorRoute="/buildr/edit"
          open={open}
          {...props}
        />,
      ),
    );
    return { open, button: container.querySelector('button') as HTMLButtonElement };
  };

  it('opens the editor of the document in a named window', () => {
    const { open, button } = mount({});
    expect(container.textContent).toContain('12 elements.');
    act(() => button.click());
    expect(open).toHaveBeenCalledWith('/buildr/edit/pages/42', 'buildr-pages-42');
  });

  it('is inactive for a document that is not saved yet', () => {
    const { open, button } = mount({ id: undefined, nodeCount: undefined });
    expect(button.disabled).toBe(true);
    act(() => button.click());
    expect(open).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Nothing built yet.');
  });

  it('builds the URL and window name safely', () => {
    expect(editorUrl('/buildr/edit/', 'a b', 7)).toBe('/buildr/edit/a%20b/7');
    expect(editorWindowName('pages', 7)).toBe('buildr-pages-7');
  });
});
