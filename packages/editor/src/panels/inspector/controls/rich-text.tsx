import { type RichTextPropDef, sanitizeUrl } from '@buildr/core';
import { $isLinkNode, $toggleLink, LinkNode } from '@lexical/link';
import {
  $isListNode,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  ListItemNode,
  ListNode,
  REMOVE_LIST_COMMAND,
  registerList,
} from '@lexical/list';
import {
  $createHeadingNode,
  $isHeadingNode,
  HeadingNode,
  QuoteNode,
  registerRichText,
} from '@lexical/rich-text';
import { $setBlocksType } from '@lexical/selection';
import {
  $createParagraphNode,
  $getSelection,
  $isRangeSelection,
  createEditor,
  type ElementNode,
  FORMAT_TEXT_COMMAND,
  type LexicalEditor,
} from 'lexical';
import { useEffect, useRef, useState } from 'react';
import { type MessageKey, useT } from '../../../messages/index.tsx';
import { Button, Input } from '../../../ui/index.ts';
import {
  $loadRichText,
  type HEADING_TAGS,
  serializeRichText,
  toRichText,
} from './rich-text-model.ts';
import type { ControlProps } from './types.ts';

type Block = 'paragraph' | 'h2' | 'h3' | 'h4' | 'bullet' | 'number' | 'other';

interface Toolbar {
  readonly block: Block;
  readonly bold: boolean;
  readonly italic: boolean;
  readonly link: boolean;
}

const NO_TOOLBAR: Toolbar = { block: 'paragraph', bold: false, italic: false, link: false };

/** What the selection is in: its block type and text formats, for the toolbar's pressed states. */
function readToolbar(editor: LexicalEditor): Toolbar {
  return editor.getEditorState().read(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) return NO_TOOLBAR;
    const anchor = selection.anchor.getNode();
    const top = anchor.getTopLevelElement();
    let block: Block = 'other';
    if ($isHeadingNode(top)) {
      const tag = top.getTag();
      block = tag === 'h2' || tag === 'h3' || tag === 'h4' ? tag : 'other';
    } else if ($isListNode(top)) block = top.getListType() === 'number' ? 'number' : 'bullet';
    else if (top?.getType() === 'paragraph') block = 'paragraph';
    const parent = anchor.getParent();
    return {
      block,
      bold: selection.hasFormat('bold'),
      italic: selection.hasFormat('italic'),
      link: $isLinkNode(anchor) || $isLinkNode(parent),
    };
  });
}

const sameToolbar = (a: Toolbar, b: Toolbar) =>
  a.block === b.block && a.bold === b.bold && a.italic === b.italic && a.link === b.link;

/**
 * A small Lexical editor (paragraph, headings 2 to 4, bold, italic, link, lists) whose output is the
 * core rich text format. The editor's state never leaves through anything but `serializeRichText`,
 * which walks it into `normalizeRichText` and checks `richTextSchema`, so what is written to the
 * document always passes the schema (docs/editor.md#inspector).
 */
export function RichTextControl({
  id,
  label,
  describedBy,
  value,
  disabled,
  onChange,
}: ControlProps<RichTextPropDef>) {
  const t = useT();
  const rootRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<LexicalEditor | null>(null);
  /** The last document the editor showed or wrote, as text; equal means there is nothing to load. */
  const shown = useRef('');
  const emit = useRef(onChange);
  emit.current = onChange;
  const [toolbar, setToolbar] = useState<Toolbar>(NO_TOOLBAR);
  const [linking, setLinking] = useState(false);
  const [url, setUrl] = useState('');
  const [linkError, setLinkError] = useState(false);

  // The editor lives as long as the control; the value flows in through the effect below.
  useEffect(() => {
    const element = rootRef.current;
    if (element === null) return;
    const editor = createEditor({
      namespace: 'buildr-rich-text',
      nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode, LinkNode],
      onError: () => {},
    });
    editorRef.current = editor;
    editor.setRootElement(element);
    const stops = [
      registerRichText(editor),
      registerList(editor),
      editor.registerUpdateListener(({ editorState, dirtyElements, dirtyLeaves, tags }) => {
        setToolbar((current) => {
          const next = readToolbar(editor);
          return sameToolbar(current, next) ? current : next;
        });
        if (tags.has('buildr-load') || (dirtyElements.size === 0 && dirtyLeaves.size === 0)) return;
        const out = serializeRichText(editorState);
        if (out === undefined) return;
        const text = JSON.stringify(out);
        if (text === shown.current) return;
        shown.current = text;
        emit.current(out);
      }),
    ];
    return () => {
      for (const stop of stops) stop();
      editor.setRootElement(null);
      editorRef.current = null;
    };
  }, []);

  useEffect(() => {
    editorRef.current?.setEditable(!disabled);
  }, [disabled]);

  // A value that changed elsewhere (undo, another panel) is loaded; one the editor wrote is not.
  useEffect(() => {
    const editor = editorRef.current;
    if (editor === null) return;
    const incoming = toRichText(value);
    const text = JSON.stringify(incoming);
    if (text === shown.current) return;
    shown.current = text;
    editor.update(() => $loadRichText(incoming), { tag: 'buildr-load', discrete: true });
  }, [value]);

  const run = (fn: (editor: LexicalEditor) => void) => {
    const editor = editorRef.current;
    if (editor === null || disabled) return;
    editor.focus();
    fn(editor);
  };

  const setBlock = (make: () => ElementNode) =>
    run((editor) =>
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) $setBlocksType(selection, make);
      }),
    );
  const heading = (tag: (typeof HEADING_TAGS)[number]) =>
    toolbar.block === tag
      ? setBlock($createParagraphNode)
      : setBlock(() => $createHeadingNode(tag));
  const list = (kind: 'bullet' | 'number') =>
    run((editor) =>
      editor.dispatchCommand(
        toolbar.block === kind
          ? REMOVE_LIST_COMMAND
          : kind === 'bullet'
            ? INSERT_UNORDERED_LIST_COMMAND
            : INSERT_ORDERED_LIST_COMMAND,
        undefined,
      ),
    );

  const applyLink = () => {
    const address = url.trim();
    if (address === '') {
      run((editor) => editor.update(() => $toggleLink(null)));
    } else {
      const safe = sanitizeUrl(address);
      if (!safe.ok) {
        setLinkError(true);
        return;
      }
      run((editor) => editor.update(() => $toggleLink(safe.value)));
    }
    setLinking(false);
    setUrl('');
    setLinkError(false);
  };

  const button = (key: MessageKey, pressed: boolean, action: () => void, text: string) => (
    <Button
      variant="ghost"
      className="bd-rich-button"
      aria-pressed={pressed}
      aria-label={t(key)}
      disabled={disabled}
      onClick={action}
      // Keep the selection in the editor while a toolbar button is pressed.
      onMouseDown={(event) => event.preventDefault()}
    >
      {text}
    </Button>
  );

  return (
    <div className="bd-rich" data-disabled={disabled}>
      <div
        className="bd-rich-toolbar"
        role="toolbar"
        aria-label={t('richText.toolbar')}
        aria-controls={id}
      >
        {button('richText.heading2', toolbar.block === 'h2', () => heading('h2'), 'H2')}
        {button('richText.heading3', toolbar.block === 'h3', () => heading('h3'), 'H3')}
        {button('richText.heading4', toolbar.block === 'h4', () => heading('h4'), 'H4')}
        {button(
          'richText.bold',
          toolbar.bold,
          () => run((e) => e.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold')),
          'B',
        )}
        {button(
          'richText.italic',
          toolbar.italic,
          () => run((e) => e.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic')),
          'I',
        )}
        {button('richText.link', toolbar.link, () => setLinking((open) => !open), '🔗')}
        {button('richText.bulletList', toolbar.block === 'bullet', () => list('bullet'), '•')}
        {button('richText.numberedList', toolbar.block === 'number', () => list('number'), '1.')}
      </div>
      {linking ? (
        <form
          className="bd-rich-link"
          onSubmit={(event) => {
            event.preventDefault();
            applyLink();
          }}
        >
          <Input
            type="text"
            value={url}
            aria-label={t('richText.linkUrl')}
            aria-invalid={linkError}
            placeholder="https://"
            onChange={(event) => {
              setUrl(event.target.value);
              setLinkError(false);
            }}
          />
          <Button type="submit" variant="primary">
            {t('richText.linkApply')}
          </Button>
          {linkError ? <p role="alert">{t('richText.linkUnsafe')}</p> : null}
        </form>
      ) : null}
      {/* biome-ignore lint/a11y/useSemanticElements: a rich text field is a contenteditable region, not a textarea */}
      <div
        id={id}
        ref={rootRef}
        className="bd-rich-editor bd-input"
        role="textbox"
        aria-multiline="true"
        aria-label={label}
        aria-describedby={describedBy}
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : 0}
        contentEditable={!disabled}
        suppressContentEditableWarning
        spellCheck
      />
    </div>
  );
}
