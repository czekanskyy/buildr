import { GUIDE_MIME_TYPE, GUIDE_URI, renderGuide } from '../resources/guide.ts';
import type { McpPrompt, McpPromptMessage, McpPromptResult } from '../server.ts';

// The built-in prompts (PB-144): starting messages a user picks in their client. Each one embeds the
// agent guide (`buildr://guide`) so a model that never fetched the resource still knows how Buildr
// works, then states the task and the steps. Arguments are user input: they are quoted as data
// and never change the steps.

function guideMessage(): McpPromptMessage {
  return {
    role: 'user',
    content: {
      type: 'resource',
      resource: { uri: GUIDE_URI, mimeType: GUIDE_MIME_TYPE, text: renderGuide() },
    },
  };
}

function quoted(label: string, value: string | undefined): string | undefined {
  if (value === undefined || value.trim() === '') return undefined;
  return `${label} (the user's words, take them as the request):\n"""\n${value.trim()}\n"""`;
}

function prompt(description: string, lines: readonly (string | undefined)[]): McpPromptResult {
  return {
    description,
    messages: [
      guideMessage(),
      {
        role: 'user',
        content: {
          type: 'text',
          text: lines.filter((line): line is string => line !== undefined).join('\n'),
        },
      },
    ],
  };
}

const DOCUMENT_ARGUMENT = {
  name: 'document',
  description:
    'The page to work on: its title, slug or `collection/id` as shown by list_documents.',
  required: true,
} as const;

export const BUILD_PAGE_PROMPT: McpPrompt = {
  name: 'build-page',
  title: 'Build a page',
  description: 'Create a new draft page from a brief: discover, build, validate, save.',
  arguments: [
    {
      name: 'brief',
      description: 'What the page is for, its audience, the sections and the tone.',
      required: true,
    },
    { name: 'collection', description: 'The collection to create the page in (default: pages).' },
    { name: 'title', description: 'The page title (default: derived from the brief).' },
    {
      name: 'locale',
      description: 'The language to write the content in (default: the site default).',
    },
  ],
  async get(args) {
    return prompt('Build a new draft page from a brief.', [
      'Build a new page as a draft, following the Buildr guide above.',
      quoted('Brief', args['brief']),
      args['title'] ? `Title: ${args['title']}` : 'Title: choose a short one that fits the brief.',
      `Collection: ${args['collection']?.trim() || 'pages'}.`,
      args['locale'] ? `Write the content in the language "${args['locale']}".` : undefined,
      'Steps:',
      '1. Discover: list_components, list_templates and get_style_reference; get_data_schema only if the page shows CMS data. Plan the sections before you insert anything.',
      '2. create_document. Then build section by section with insert_nodes: a template when one fits, a tree otherwise. Replace placeholder text and images with real copy that fits the brief (list_media has the existing media).',
      '3. Style with theme tokens and set mobile overrides where the layout needs them.',
      '4. validate and fix every error (and warnings unless there is a reason not to). Re-validate.',
      '5. save. Do not publish. Finish by telling the user what you built, that it is a draft, and the get_preview_url link.',
    ]);
  },
};

export const ADD_SECTION_PROMPT: McpPrompt = {
  name: 'add-section',
  title: 'Add a section',
  description: 'Add one new section to an existing page.',
  arguments: [
    DOCUMENT_ARGUMENT,
    { name: 'description', description: 'What the section should say and show.', required: true },
    {
      name: 'position',
      description: 'Where to put it, e.g. "after the hero" or "at the end" (default: the end).',
    },
  ],
  async get(args) {
    return prompt('Add one section to an existing page.', [
      'Add one section to an existing page, following the Buildr guide above.',
      `Page: ${args['document']}`,
      quoted('Section', args['description']),
      `Position: ${args['position']?.trim() || 'at the end of the page'}.`,
      'Steps:',
      '1. list_documents to find the page, then open_document and get_outline to understand the page as it is: its sections, tone, language and styling.',
      '2. Choose a template that fits (list_templates, describe_template) or write a tree. Match the existing sections: same tokens, same spacing, same heading levels.',
      '3. insert_nodes at the requested position. Change nothing else on the page.',
      '4. validate, fix what concerns your section, save (a draft, never publish), close_document and tell the user what you added.',
    ]);
  },
};

export const TRANSLATE_PAGE_PROMPT: McpPrompt = {
  name: 'translate-page',
  title: 'Translate a page',
  description: 'Add a language to an existing page: translate every localizable text.',
  arguments: [
    DOCUMENT_ARGUMENT,
    { name: 'locale', description: 'The target language code, e.g. "pl".', required: true },
    {
      name: 'sourceLocale',
      description: 'The language to translate from (default: the site default).',
    },
  ],
  async get(args) {
    const source = args['sourceLocale'] ? `, translated from "${args['sourceLocale']}"` : '';
    return prompt('Translate an existing page into another language.', [
      'Translate an existing page, following the Buildr guide above.',
      `Page: ${args['document']}`,
      `Target language: "${args['locale']}"${source}.`,
      'Steps:',
      '1. open_document, then validate to list the missing translations for the target language. That list, plus get_outline with the target locale, is your work list.',
      '2. Translate with update_node and `locale`, node by node, in batches. Never overwrite the default-language value. Keep meaning, tone, names, numbers and links; translate alt texts and aria labels too; leave data (bindings, formulas) alone.',
      '3. Do not change the structure or the styles: they are shared by every language.',
      '4. validate until no translation for the target language is missing, save (a draft, never publish), and report what you translated and anything you left because it was ambiguous.',
    ]);
  },
};

export const FIX_ISSUES_PROMPT: McpPrompt = {
  name: 'fix-issues',
  title: 'Fix validation issues',
  description: 'Fix the accessibility, structure and translation problems that validate reports.',
  arguments: [DOCUMENT_ARGUMENT],
  async get(args) {
    return prompt('Fix the issues validate reports for a page.', [
      'Fix the problems of an existing page, following the Buildr guide above.',
      `Page: ${args['document']}`,
      'Steps:',
      "1. open_document and run validate. Work through the findings, errors first. Use each finding's suggestedCall where it fits; otherwise read the node with get_node and choose the smallest change that fixes it.",
      '2. Write real fixes, not silenced ones: an image alt describes the image, a button gets a meaningful label. When a fix needs a fact you do not have (what a picture shows, where a link goes), ask the user instead of guessing.',
      '3. Change only what the findings need. Do not redesign the page.',
      '4. validate again until it is clean or only findings remain that you explain, save (a draft, never publish), and report what you fixed and what is left.',
    ]);
  },
};

/** The built-in prompts: build-page, add-section, translate-page, fix-issues. */
export function createPrompts(): McpPrompt[] {
  return [BUILD_PAGE_PROMPT, ADD_SECTION_PROMPT, TRANSLATE_PAGE_PROMPT, FIX_ISSUES_PROMPT];
}
