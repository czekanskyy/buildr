export const publish = {
  'publish.title': 'Publish this page',
  'publish.description': 'Check what was found, then publish.',
  'publish.notice':
    'Publishing replaces the live page with this whole document, not only the latest change.',
  'publish.summary': 'What the checks found',
  'publish.blocked.corrupt': 'The document is damaged and cannot be published.',
  'publish.blocked.errors':
    'Publishing is blocked while there are errors. Fix them in the Issues panel.',
  'publish.warn': 'There are issues. You can still publish.',
  'publish.working': 'Publishing…',
  'publish.done': 'Published.',
  'publish.failed.conflict': 'The page was changed elsewhere. Resolve that first.',
  'publish.failed.invalid': 'The server refused the document.',
  'publish.failed.unsaved': 'The latest changes could not be saved, so nothing was published.',
  'publish.failed.network': 'Publishing failed. Try again.',
  'publish.count.error': '{count} errors',
  'publish.count.warning': '{count} warnings',
  'publish.count.info': '{count} notes',
} as const;
