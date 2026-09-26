import { deriveFormSchema, runA11y, s } from '@next-buildr/core';
import type { Platform } from '@next-buildr/react';
import { createRegistry as createReactRegistry } from '@next-buildr/react';
import { describe, expect, it } from 'vitest';
import { Button } from '../button/definition.ts';
import { Checkbox } from '../checkbox/definition.ts';
import { Input } from '../input/definition.ts';
import { Page } from '../page/definition.ts';
import { Select } from '../select/definition.ts';
import { createRegistry, pageWith, problemsOf, render } from '../test-kit.tsx';
import { Textarea } from '../textarea/definition.ts';
import { Form } from './definition.ts';
import { formFixtures } from './fixtures.ts';
import { FormView } from './view.tsx';

const registry = createRegistry({
  components: [Page, Form, Input, Textarea, Select, Checkbox, Button],
});
const fixture = () => pageWith(formFixtures[0]?.tree as never);

describe('buildr/form', () => {
  it('is a plain HTML form that posts, with its fields, a honeypot and a status region', async () => {
    const { html, diagnostics } = await render(registry, fixture());
    expect(diagnostics).toEqual([]);
    expect(html).toMatch(/<form [^>]*class="bc-form b-[^"]+"[^>]*>/);
    expect(html).toContain('method="post"');
    for (const name of ['name', 'email', 'topic', 'message', 'copy']) {
      expect(html).toContain(`name="${name}"`);
    }
    expect(html).toContain('<button class="bc-button b-');
    expect(html).toContain('type="submit"');
    // The honeypot: hidden from people and assistive technology, named so the server can spot a bot.
    expect(html).toContain('<div class="bc-form__honeypot" aria-hidden="true">');
    const honeypot = /<input [^>]*name="_hp"[^>]*>/.exec(html)?.[0] ?? '';
    expect(honeypot).toContain('tabindex="-1"');
    expect(honeypot).toContain('autoComplete="off"');
    expect(html).toContain('<div class="bc-form__status" role="status" aria-live="polite"></div>');
    expect(html).not.toContain('<script');
  });

  it('takes its action from the platform, with the layout ref and its own node id', () => {
    const calls: [string, string][] = [];
    const platform: Platform = {
      Link: () => null,
      Image: () => null,
      formAction: (ref, nodeId) => {
        calls.push([ref, nodeId]);
        return `/forms/${ref}/${nodeId}`;
      },
    };
    const element = FormView({
      props: { successMessage: '', errorMessage: '', ariaLabel: '' } as never,
      root: { className: 'bc-form b-x' },
      slots: {},
      node: { id: 'node1', type: 'buildr/form' },
      env: { mode: 'production', locale: 'en', messages: {}, layoutRef: 'pages:7' },
      platform,
    }) as { props: Record<string, unknown> };
    expect(calls).toEqual([['pages:7', 'node1']]);
    expect(element.props['action']).toBe('/forms/pages:7/node1');
    expect(element.props['method']).toBe('post');
  });

  it('has no action without a platform, so the browser posts to the page itself', () => {
    const element = FormView({
      props: { successMessage: '', errorMessage: '', ariaLabel: '' } as never,
      root: { className: 'bc-form b-x' },
      slots: {},
      node: { id: 'node1', type: 'buildr/form' },
      env: { mode: 'production', locale: 'en', messages: {} },
    }) as { props: Record<string, unknown> };
    expect(element.props['action']).toBeUndefined();
  });

  it('passes the enhancement its texts: the author’s, else the built-in ones for the locale', () => {
    const enhancerProps = (props: object, locale: string) => {
      const element = FormView({
        props: { successMessage: '', errorMessage: '', ariaLabel: '', ...props } as never,
        root: { className: 'bc-form b-x' },
        slots: {},
        node: { id: 'n', type: 'buildr/form' },
        env: { mode: 'production', locale, messages: {} },
      }) as { props: { children: { props: Record<string, string> }[] } };
      return element.props.children.at(-1)?.props ?? {};
    };
    expect(enhancerProps({}, 'en')['success']).toBe('Thank you, your message was sent.');
    expect(enhancerProps({}, 'pl')['success']).toBe('Dziękujemy, wiadomość została wysłana.');
    expect(enhancerProps({ successMessage: 'Thanks!' }, 'en')['success']).toBe('Thanks!');
    expect(enhancerProps({ errorMessage: 'Oops' }, 'en')['failure']).toBe('Oops');
  });

  it('only takes a string action for the enhancement (a server action is left to the framework)', () => {
    const platform: Platform = {
      Link: () => null,
      Image: () => null,
      formAction: () => async () => {},
    };
    const element = FormView({
      props: { successMessage: '', errorMessage: '', ariaLabel: '' } as never,
      root: { className: 'bc-form b-x' },
      slots: {},
      node: { id: 'n', type: 'buildr/form' },
      env: { mode: 'production', locale: 'en', messages: {} },
      platform,
    }) as { props: { action: unknown; children: { props: Record<string, unknown> }[] } };
    expect(typeof element.props.action).toBe('function');
    expect(element.props.children.at(-1)?.props['action']).toBeUndefined();
  });

  it('is named by ariaLabel when it has one', async () => {
    const doc = pageWith({
      type: 'buildr/form',
      props: { ariaLabel: s('Contact us') } as never,
      children: [{ type: 'buildr/button', props: { type: s('submit') } }] as never,
    });
    const { html } = await render(registry, doc);
    expect(html).toContain('aria-label="Contact us"');
  });

  describe('the schema the server enforces', () => {
    it('is derived from the document through metadata alone', () => {
      const meta = registry.meta;
      const doc = fixture();
      const formId = Object.values(doc.nodes).find((n) => n.type === 'buildr/form')?.id ?? '';
      const { schema, diagnostics } = deriveFormSchema(doc, meta, formId);
      expect(diagnostics).toEqual([]);
      expect(schema.fields.map((f) => [f.name, f.valueType, f.required])).toEqual([
        ['name', 'string', true],
        ['email', 'string', true],
        ['topic', 'enum', false],
        ['message', 'string', true],
        ['copy', 'boolean', false],
      ]);
      expect(schema.fields.find((f) => f.name === 'topic')?.options).toEqual(['sales', 'support']);
      expect(schema.fields.find((f) => f.name === 'message')?.maxLength).toBe(2000);
    });

    it('needs no component code: a registry of metadata alone gives the same schema', () => {
      const metaOnly = createReactRegistry({
        components: [Page, Form, Input, Textarea, Select, Checkbox, Button],
      }).meta;
      const doc = fixture();
      const formId = Object.values(doc.nodes).find((n) => n.type === 'buildr/form')?.id ?? '';
      expect(deriveFormSchema(doc, metaOnly, formId).schema.fields).toHaveLength(5);
    });

    it('reports a duplicated field name', () => {
      const doc = pageWith({
        type: 'buildr/form',
        children: [
          { type: 'buildr/input', props: { name: s('email') } },
          { type: 'buildr/input', props: { name: s('email') } },
        ] as never,
      });
      const formId = Object.values(doc.nodes).find((n) => n.type === 'buildr/form')?.id ?? '';
      const { diagnostics } = deriveFormSchema(doc, registry.meta, formId);
      expect(diagnostics.map((d) => d.code)).toEqual(['form.name-duplicate']);
    });
  });

  it('wants a submit button: the form-submit rule', () => {
    const withoutButton = pageWith({ type: 'buildr/form' });
    expect(runA11y(withoutButton, registry.meta).map((i) => i.ruleId)).toContain('form-submit');
    expect(runA11y(fixture(), registry.meta).map((i) => i.ruleId)).not.toContain('form-submit');
  });

  it('has valid, accessible fixtures with a mobile override', async () => {
    for (const f of formFixtures) expect(problemsOf(registry, f)).toEqual([]);
    const { html, diagnostics } = await render(registry, fixture());
    expect(diagnostics).toEqual([]);
    expect(html).toContain('@media');
  });

  it('has serializable metadata', () => {
    expect(JSON.parse(JSON.stringify(Form.meta))).toEqual(Form.meta);
  });
});
