export const clipboard = {
  'clipboard.error.empty': 'Select something to copy first.',
  'clipboard.error.readOnly': 'This page is read only.',
  'clipboard.error.notFragment': 'The clipboard holds nothing copied from the editor.',
  'clipboard.error.tooLarge': 'The clipboard content is too large to paste.',
  'clipboard.error.unsupported': 'The copied content comes from a different version of the editor.',
  'clipboard.error.invalid': 'The copied content is damaged and was not pasted.',
  'clipboard.error.rejected': 'It cannot be placed here.',
  'clipboard.outdated':
    'This content uses component types or versions this editor does not support and cannot be pasted here.',
  'clipboard.cut.done': 'Block cut',
  'clipboard.paste.done': 'Block pasted',
} as const;
