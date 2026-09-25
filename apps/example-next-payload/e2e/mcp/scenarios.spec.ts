// The MVP scenarios (docs/roadmap.md) built by a scripted MCP client: the tool calls an agent would
// make, with no model in the loop, against the example app over Streamable HTTP. Every result is
// checked three ways: the agent's own `validate` (zero validation and accessibility errors), the
// visual editor (opens it, no errors, every node in the layers tree) and the public draft preview.
// Runs only with BUILDR_MCP=1 (playwright.config.ts, e2e/serve.mjs).
import { test as base, expect, type Page } from '@playwright/test';
import { ADMIN, Agent, type Report, type Tree } from './agent.ts';

interface Built {
  readonly id: number | string;
  readonly slug: string;
  readonly report: Report;
  readonly nodeCount: number;
  readonly previewUrl: string | null;
}

interface Builder {
  /** Creates a draft page, runs the steps (tool calls), validates, saves and closes it. */
  readonly build: (
    title: string,
    steps: (agent: Agent, sessionId: string) => Promise<void>,
  ) => Promise<Built>;
}

let counter = 0;
const created: (number | string)[] = [];

const test = base.extend<{ builder: Builder }>({
  builder: async ({ baseURL }, use) => {
    const agent = await Agent.connect(baseURL ?? 'http://localhost:3100');
    await use({
      build: async (title, steps) => {
        const slug = `agent-${Date.now().toString(36)}-${counter++}`;
        const doc = await agent.call('create_document', { collection: 'pages', title, slug });
        const sessionId = doc.data['sessionId'] as string;
        const id = (doc.data['ref'] as { id: number | string }).id;
        created.push(id);
        await steps(agent, sessionId);
        const report = await agent.validate(sessionId);
        const saved = await agent.save(sessionId);
        const outline = await agent.call('get_outline', { sessionId, depth: 1 });
        const nodeCount = outline.data['nodeCount'] as number;
        await agent.call('close_document', { sessionId });
        return { id, slug, report, nodeCount, previewUrl: saved.previewUrl };
      },
    });
    await agent.close();
  },
});

test.afterAll(async ({ playwright, baseURL }) => {
  // The drafts the agent made are scratch: a person (the administrator) removes them.
  const request = await playwright.request.newContext({
    baseURL: baseURL ?? 'http://localhost:3100',
  });
  await request.post('/api/users/login', { data: ADMIN });
  for (const id of created.splice(0)) await request.delete(`/api/pages/${String(id)}`);
  await request.dispose();
});

const insertTemplates =
  (...templates: { id: string; variant?: string }[]) =>
  async (agent: Agent, sessionId: string): Promise<void> => {
    for (const { id, variant } of templates) {
      await agent.call('insert_nodes', {
        sessionId,
        template: id,
        ...(variant === undefined ? {} : { variant }),
      });
    }
  };

const insertTrees =
  (...trees: Tree[]) =>
  async (agent: Agent, sessionId: string): Promise<void> => {
    for (const tree of trees) await agent.call('insert_nodes', { sessionId, tree });
  };

/** No validation error, no accessibility error: what "clean" means for an agent-built page. */
function expectClean(report: Report): void {
  const errors = report.issues.filter((issue) => issue.severity === 'error');
  expect(errors, JSON.stringify(errors)).toEqual([]);
  expect(report.counts.error).toBe(0);
  expect(report.ok).toBe(true);
}

/** Signs in as the administrator (the person reviewing the agent's draft); the cookie serves `page`. */
async function signIn(page: Page): Promise<void> {
  const login = await page.request.post('/api/users/login', { data: ADMIN });
  expect(login.ok()).toBe(true);
}

/** Opens the page in the visual editor: it renders, shows no errors and lists every node. */
async function expectEditable(page: Page, built: Built, headline: string): Promise<void> {
  await signIn(page);
  await page.goto(`/buildr/edit/pages/${String(built.id)}`);
  const canvas = page.frameLocator('iframe');
  await expect(canvas.getByRole('heading', { name: headline }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Show issues' }).click();
  await expect(page.getByRole('button', { name: /^Errors \(0\)/ })).toBeVisible();
  // Every node the agent made is a row of the editor's layer tree (the page root included).
  await page.getByRole('tab', { name: 'Layers' }).click();
  const layers = page.getByRole('tree', { name: 'Layers' });
  await expect(layers).toBeVisible();
  const closed = layers.locator('[role=treeitem][aria-expanded=false]');
  for (let step = 0; step < built.nodeCount; step++) {
    if ((await closed.count()) === 0) break;
    await closed.first().locator('[data-toggle]').click();
  }
  await expect(closed).toHaveCount(0);
  await expect(layers.getByRole('treeitem')).toHaveCount(built.nodeCount);
}

/** A draft is not public; a signed-in reviewer sees it through the preview route. */
async function expectDraftPreview(
  page: Page,
  built: Built,
  locale: 'pl' | 'en',
  headline: string,
): Promise<void> {
  expect(built.previewUrl, 'get_preview_url').toContain(`/${built.slug}`);
  await signIn(page);
  await page.goto(`/buildr/preview?path=${encodeURIComponent(`/${built.slug}`)}&locale=${locale}`);
  await expect(page.getByRole('heading', { name: headline }).first()).toBeVisible();
}

/** Visitors get a 404 for a page that was never published. */
async function expectNotPublic(
  playwright: {
    request: {
      newContext: (o: {
        baseURL?: string;
      }) => Promise<import('@playwright/test').APIRequestContext>;
    };
  },
  baseURL: string | undefined,
  built: Built,
): Promise<void> {
  const visitor = await playwright.request.newContext(baseURL === undefined ? {} : { baseURL });
  const response = await visitor.get(`/pl/${built.slug}`);
  expect(response.status(), 'a draft must not be public').toBe(404);
  await visitor.dispose();
}

test('scenario 1: a landing page from templates', async ({
  builder,
  page,
  playwright,
  baseURL,
}) => {
  const built = await builder.build(
    'Agent landing page',
    insertTemplates(
      { id: 'buildr/hero', variant: 'centered' },
      { id: 'buildr/feature-grid' },
      { id: 'buildr/testimonial' },
      { id: 'buildr/pricing' },
      { id: 'buildr/faq' },
      { id: 'buildr/cta' },
    ),
  );
  expectClean(built.report);
  await expectNotPublic(playwright, baseURL, built);
  await expectEditable(page, built, 'A headline that says what you do');
  await expectDraftPreview(page, built, 'pl', 'A headline that says what you do');
});

test('scenario 2: a company page with a card grid, a list and a contact section', async ({
  builder,
  page,
}) => {
  const card = (n: number): Tree => ({
    type: 'buildr/card',
    slots: {
      body: [
        { type: 'buildr/heading', props: { text: `Value ${n}`, level: 3 } },
        { type: 'buildr/text', props: { text: `What value ${n} means for our customers.` } },
      ],
    },
  });
  const built = await builder.build('Agent company page', async (agent, sessionId) => {
    await insertTemplates({ id: 'buildr/hero', variant: 'centered' })(agent, sessionId);
    await insertTrees(
      {
        type: 'buildr/section',
        children: [
          {
            type: 'buildr/stack',
            children: [
              { type: 'buildr/badge', props: { text: 'Since 2009', variant: 'primary' } },
              { type: 'buildr/heading', props: { text: 'Our story', level: 2 } },
              {
                type: 'buildr/text',
                props: { text: 'A family bakery that grew one loaf at a time.' },
              },
              { type: 'buildr/divider', props: { decorative: true } },
              {
                type: 'buildr/list',
                props: { ariaLabel: 'What we stand for' },
                children: [
                  { type: 'buildr/list-item', props: { text: 'Fresh every morning' } },
                  { type: 'buildr/list-item', props: { text: 'Flour from local mills' } },
                ],
              },
            ],
          },
        ],
      },
      {
        type: 'buildr/section',
        children: [{ type: 'buildr/grid', children: [1, 2, 3].map(card) }],
      },
    )(agent, sessionId);
    await insertTemplates({ id: 'buildr/contact' })(agent, sessionId);
  });
  expectClean(built.report);
  await expectEditable(page, built, 'Our story');
  await expectDraftPreview(page, built, 'pl', 'Our story');
});

test('scenario 4: a post listing from the blog template', async ({ builder, page }) => {
  const built = await builder.build('Agent blog', insertTemplates({ id: 'buildr/blog-listing' }));
  expectClean(built.report);
  await expectEditable(page, built, 'Blog');
  await expectDraftPreview(page, built, 'pl', 'Blog');
});

test('scenario 6: a page with a contact form', async ({ builder, page }) => {
  const built = await builder.build('Agent contact page', async (agent, sessionId) => {
    await insertTrees({
      type: 'buildr/section',
      children: [{ type: 'buildr/heading', props: { text: 'Write to us', level: 1 } }],
    })(agent, sessionId);
    await insertTemplates({ id: 'buildr/contact' })(agent, sessionId);
  });
  expectClean(built.report);
  await expectEditable(page, built, 'Write to us');
  await expectDraftPreview(page, built, 'pl', 'Write to us');
  // The form the template brings is on the page.
  await expect(page.getByRole('textbox', { name: /Name/ })).toBeVisible();
  await expect(page.getByRole('textbox', { name: /Message/ })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: /Send me a copy/ })).toBeVisible();
});

interface OutlineEntry {
  id: string;
  type: string;
  text?: string;
  slots?: Record<string, OutlineEntry[]>;
}

test('scenario 7: one page translated into English, structure untouched', async ({
  builder,
  page,
}) => {
  const dictionary: Record<string, string> = {
    'Chleb prosto z pieca': 'Bread straight from the oven',
    'Pieczemy codziennie od piątej rano.': 'We bake every day from five in the morning.',
    'Zamów chleb': 'Order bread',
  };
  const propOf: Record<string, string> = {
    'buildr/heading': 'text',
    'buildr/text': 'text',
    'buildr/button': 'label',
  };
  const built = await builder.build('Agent page to translate', async (agent, sessionId) => {
    await insertTrees({
      type: 'buildr/section',
      children: [
        {
          type: 'buildr/stack',
          children: [
            { type: 'buildr/heading', props: { text: 'Chleb prosto z pieca', level: 1 } },
            { type: 'buildr/text', props: { text: 'Pieczemy codziennie od piątej rano.' } },
            { type: 'buildr/button', props: { label: 'Zamów chleb' } },
          ],
        },
      ],
    })(agent, sessionId);
    // The page is in Polish only: validate names every text that has no English yet.
    const before = await agent.validate(sessionId);
    const missing = before.issues.filter(
      (issue) => issue.code === 'missing-translation' && issue.locale === 'en',
    );
    expect(missing).toHaveLength(3);
    const outline = await agent.call('get_outline', { sessionId, depth: 6, format: 'json' });
    const entries: OutlineEntry[] = [];
    const walk = (entry: OutlineEntry): void => {
      entries.push(entry);
      for (const children of Object.values(entry.slots ?? {})) children.forEach(walk);
    };
    walk((outline.data['outline'] as { root: OutlineEntry }).root);
    for (const entry of entries) {
      const prop = propOf[entry.type];
      const english = entry.text === undefined ? undefined : dictionary[entry.text];
      if (prop === undefined || english === undefined) continue;
      await agent.call('update_node', {
        sessionId,
        nodeId: entry.id,
        locale: 'en',
        props: { [prop]: english },
      });
    }
  });
  expectClean(built.report);
  expect(
    built.report.issues.filter((issue) => issue.code === 'missing-translation'),
    'every text has an English translation',
  ).toEqual([]);
  await expectEditable(page, built, 'Chleb prosto z pieca');
  await expectDraftPreview(page, built, 'pl', 'Chleb prosto z pieca');
  // The address of the page in English is a person's job (a localized slug); the draft stays a draft.
  const english = await page.request.patch(`/api/pages/${String(built.id)}?locale=en&draft=true`, {
    data: { title: 'Agent page to translate', slug: built.slug },
  });
  expect(english.ok()).toBe(true);
  await expectDraftPreview(page, built, 'en', 'Bread straight from the oven');
  await expect(page.getByRole('button', { name: 'Order bread' })).toBeVisible();
});
