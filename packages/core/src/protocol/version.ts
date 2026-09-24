/**
 * The version of the editor-canvas protocol (docs/editor.md#the-postmessage-protocol). It is part
 * of every envelope and of `canvas:hello`; a side that receives another version refuses the
 * message. Bump it for any change to a message's shape or meaning, in the same change.
 */
export const PROTOCOL_VERSION = 1 as const;

/** The `source` every envelope carries, so a message from anything else on the page is ignored. */
export const PROTOCOL_SOURCE = 'buildr' as const;
