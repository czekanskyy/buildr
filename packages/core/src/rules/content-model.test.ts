import { describe, expect, it } from 'vitest';
import { type ContentModelNode, checkGlobalContentModel } from './content-model.ts';

function n(type: string, categories: ContentModelNode['categories']): ContentModelNode {
  return { type, categories };
}

describe('checkGlobalContentModel', () => {
  it('allows an ordinary flow child under an ordinary flow parent', () => {
    expect(
      checkGlobalContentModel(
        [n('buildr/section', ['flow'])],
        n('buildr/text', ['flow', 'phrasing']),
      ),
    ).toBeNull();
  });

  it('allows phrasing content inside a heading', () => {
    expect(
      checkGlobalContentModel(
        [n('buildr/heading', ['flow', 'heading'])],
        n('buildr/text', ['phrasing']),
      ),
    ).toBeNull();
  });

  it('rejects non-phrasing content inside a heading', () => {
    const issue = checkGlobalContentModel(
      [n('buildr/heading', ['flow', 'heading'])],
      n('buildr/stack', ['flow']),
    );
    expect(issue?.code).toBe('heading-requires-phrasing');
  });

  it('allows non-interactive content under an interactive ancestor', () => {
    expect(
      checkGlobalContentModel(
        [n('buildr/button', ['interactive'])],
        n('buildr/text', ['flow', 'phrasing']),
      ),
    ).toBeNull();
  });

  it('rejects interactive content directly inside interactive content', () => {
    const issue = checkGlobalContentModel(
      [n('buildr/button', ['flow', 'phrasing', 'interactive'])],
      n('buildr/link', ['flow', 'phrasing', 'interactive']),
    );
    expect(issue?.code).toBe('nested-interactive');
  });

  it('rejects interactive content nested several levels under an interactive ancestor', () => {
    const chain = [n('buildr/stack', ['flow']), n('buildr/button', ['flow', 'interactive'])];
    const issue = checkGlobalContentModel(chain, n('buildr/link', ['flow', 'interactive']));
    expect(issue?.code).toBe('nested-interactive');
  });

  it('rejects a form nested inside another form', () => {
    const issue = checkGlobalContentModel([n('buildr/form', ['flow'])], n('buildr/form', ['flow']));
    expect(issue?.code).toBe('nested-form');
  });

  it('allows a form nested inside a non-form ancestor chain', () => {
    expect(
      checkGlobalContentModel(
        [n('buildr/section', ['flow']), n('buildr/section', ['flow'])],
        n('buildr/form', ['flow']),
      ),
    ).toBeNull();
  });

  it('allows a form control with a form ancestor', () => {
    expect(
      checkGlobalContentModel(
        [n('buildr/section', ['flow']), n('buildr/form', ['flow'])],
        n('buildr/input', ['flow', 'phrasing', 'form-control']),
      ),
    ).toBeNull();
  });

  it('rejects a form control with no form ancestor', () => {
    const issue = checkGlobalContentModel(
      [n('buildr/section', ['flow'])],
      n('buildr/input', ['flow', 'phrasing', 'form-control']),
    );
    expect(issue?.code).toBe('form-control-outside-form');
  });

  it('rejects a form control at the document root with no ancestors at all', () => {
    const issue = checkGlobalContentModel([], n('buildr/input', ['form-control']));
    expect(issue?.code).toBe('form-control-outside-form');
  });

  it('every returned reason carries a non-empty message', () => {
    const issues = [
      checkGlobalContentModel([n('buildr/heading', ['heading'])], n('buildr/stack', ['flow'])),
      checkGlobalContentModel(
        [n('buildr/button', ['interactive'])],
        n('buildr/link', ['interactive']),
      ),
      checkGlobalContentModel([n('buildr/form', ['flow'])], n('buildr/form', ['flow'])),
      checkGlobalContentModel([], n('buildr/input', ['form-control'])),
    ];
    for (const issue of issues) {
      expect(issue?.message.length).toBeGreaterThan(0);
    }
  });
});
