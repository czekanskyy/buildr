import type { McpResourceContents, McpResources, McpToolContext } from '../server.ts';
import {
  createDiscoveryCache,
  type DiscoveryCache,
  loadFailureText,
  renderComponent,
  renderTemplate,
} from './catalogue.ts';
import { GUIDE_MIME_TYPE, GUIDE_URI, renderGuide } from './guide.ts';
import { renderStyleReference } from './style-reference.ts';

// The `buildr://` resources (PB-136): the same content as the discovery tools, addressable by URI
// so a client can attach a component description or the style reference as context.

export { GUIDE_URI };
export const STYLE_REFERENCE_URI = 'buildr://style-reference';
const COMPONENT_PREFIX = 'buildr://components/';
const TEMPLATE_PREFIX = 'buildr://templates/';

export function componentResourceUri(type: string): string {
  return `${COMPONENT_PREFIX}${type}`;
}

export function templateResourceUri(id: string): string {
  return `${TEMPLATE_PREFIX}${id}`;
}

function idFrom(uri: string, prefix: string): string | null {
  if (!uri.startsWith(prefix)) return null;
  const raw = uri.slice(prefix.length);
  try {
    // Clients that expand `{type}` percent-encode the slash of `buildr/heading`; accept both.
    return decodeURIComponent(raw);
  } catch {
    return null;
  }
}

/** The built-in resources: every component, every template and the style reference. */
export function createResources(cache: DiscoveryCache = createDiscoveryCache()): McpResources {
  const text = (uri: string, body: string): McpResourceContents => ({
    uri,
    mimeType: 'text/plain',
    text: body,
  });

  return {
    templates: [
      {
        uriTemplate: `${COMPONENT_PREFIX}{type}`,
        name: 'component',
        description: 'Props, slots, rules and an example of one component, e.g. buildr/heading.',
        mimeType: 'text/plain',
      },
      {
        uriTemplate: `${TEMPLATE_PREFIX}{id}`,
        name: 'template',
        description: 'The outline of what one template inserts.',
        mimeType: 'text/plain',
      },
    ],

    async list({ backend }: McpToolContext) {
      const loaded = await cache.load(backend);
      const dynamic = loaded.ok
        ? [
            ...loaded.value.registry.list().map((meta) => ({
              uri: componentResourceUri(meta.type),
              name: meta.type,
              description: `${meta.label}: props, slots and an example.`,
              mimeType: 'text/plain',
            })),
            ...loaded.value.registry.listTemplates().map((template) => ({
              uri: templateResourceUri(template.id),
              name: template.id,
              description: `${template.label}: outline of what it inserts.`,
              mimeType: 'text/plain',
            })),
          ]
        : [];
      return [
        {
          uri: GUIDE_URI,
          name: 'guide',
          description:
            'Read first: how to build pages with Buildr (structure, templates, styles, bindings, localization, accessibility, workflow, what never to do).',
          mimeType: GUIDE_MIME_TYPE,
        },
        {
          uri: STYLE_REFERENCE_URI,
          name: 'style-reference',
          description: 'Style storage, value grammar per property, theme tokens and breakpoints.',
          mimeType: 'text/plain',
        },
        ...dynamic,
      ];
    },

    async read(uri, { backend }) {
      if (uri === GUIDE_URI) {
        return { uri, mimeType: GUIDE_MIME_TYPE, text: renderGuide() };
      }
      const type = idFrom(uri, COMPONENT_PREFIX);
      const templateId = idFrom(uri, TEMPLATE_PREFIX);
      if (uri !== STYLE_REFERENCE_URI && type === null && templateId === null) return null;

      const loaded = await cache.load(backend);
      if (!loaded.ok) return text(uri, loadFailureText(loaded.error));
      const { registry, memo } = loaded.value;

      if (uri === STYLE_REFERENCE_URI) {
        const theme = await backend.getTheme();
        if (!theme.ok) return text(uri, theme.error.message);
        const rendered = memo(`style:${JSON.stringify(theme.value)}`, () => ({
          ok: true,
          text: renderStyleReference(theme.value),
        }));
        return text(uri, rendered.ok ? rendered.text : rendered.message);
      }
      const rendered =
        type !== null
          ? memo(`component:${type}`, () => renderComponent(registry, type))
          : memo(`template:${templateId}`, () => renderTemplate(registry, templateId as string));
      return rendered.ok ? text(uri, rendered.text) : null;
    },
  };
}

export {
  createDiscoveryCache,
  type DiscoveryCache,
} from './catalogue.ts';
