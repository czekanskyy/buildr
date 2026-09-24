import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { boot, type Harness, title, withChild } from './endpoints.test-kit.ts';

let h: Harness;
beforeAll(async () => {
  h = await boot('publish-a11y', { a11y: { publish: 'block' } } as never);
});
afterAll(() => h.close());

describe('publishing with the a11y policy "block"', () => {
  it('refuses a layout with accessibility errors, and publishes a fixed one', async () => {
    const doc = await h.payload.create({
      collection: 'pages',
      data: { title: 'Home', slug: 'home' },
      draft: true,
    });
    const path = `/buildr/documents/pages/${doc.id}`;
    const put = (document: unknown, baseRevision: number) =>
      h.call('PUT', path, { body: { document, baseRevision, autosave: false } });

    const broken = withChild({ alt: { kind: 'static', value: '' } }, { type: 'buildr/image' });
    expect((await put(broken, 0)).status).toBe(200);
    const refused = await h.call('POST', `${path}/publish`, { body: { baseRevision: 1 } });
    expect(refused.status).toBe(422);
    expect(refused.body.diagnostics.map((d: { code: string }) => d.code)).toContain(
      'a11y.image-alt',
    );

    const fixed = withChild({ alt: title('A cat').title }, { type: 'buildr/image' });
    expect((await put(fixed, 1)).status).toBe(200);
    const published = await h.call('POST', `${path}/publish`, { body: { baseRevision: 2 } });
    expect(published.status).toBe(200);
  });
});
