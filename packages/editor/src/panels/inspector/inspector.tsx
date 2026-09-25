import type { PageNode, PropDef, Value } from '@buildr/core';
import { canEdit, createIndex } from '@buildr/core';
import type { Command } from '@buildr/core/commands';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { componentMeta, useManifest } from '../../app/manifest.tsx';
import { useT } from '../../messages/index.tsx';
import { useEditor, useEditorState, useSelectedNode } from '../../store/index.ts';
import { Button, ComponentIcon, Icon, IconButton, Input, Tabs } from '../../ui/index.ts';
import { PropsPanel } from './props-panel.tsx';
import { translationLocale } from './value.ts';
import { TranslationBanner } from './values/translation.tsx';

export interface InspectorProps {
  /** The language being edited; translatable props write to it. */
  readonly locale?: string;
  readonly defaultLocale?: string;
  /** The Style tab (PB-082); without it the tab says the styles are edited elsewhere. */
  readonly renderStyle?: (node: PageNode) => ReactNode;
}

/** A text attribute of the node (`name`, `anchor`); clearing it removes it. */
function AttrField(props: {
  readonly nodeId: string;
  readonly attr: 'name' | 'anchor';
  readonly label: string;
  readonly value: string;
  readonly disabled: boolean;
  readonly placeholder?: string;
  readonly onChange: (attr: 'name' | 'anchor', value: string) => void;
}) {
  // What is typed stays on screen even when the command refuses it (an anchor with a capital).
  const [draft, setDraft] = useState<string | undefined>(undefined);
  const shown = draft ?? props.value;
  const id = `${props.nodeId}-${props.attr}`;
  return (
    <div className="bd-field" data-attr={props.attr}>
      <label className="bd-field-label" htmlFor={id}>
        {props.label}
      </label>
      <Input
        id={id}
        value={shown}
        disabled={props.disabled}
        placeholder={props.placeholder}
        autoComplete="off"
        spellCheck={false}
        onChange={(event) => {
          setDraft(event.target.value);
          props.onChange(props.attr, event.target.value);
        }}
        onBlur={() => setDraft(undefined)}
      />
    </div>
  );
}

/** The node's own name in the header: the same `name` attribute as the Advanced tab's field. */
function HeaderName(props: {
  readonly nodeId: string;
  readonly value: string;
  readonly placeholder: string;
  readonly disabled: boolean;
  readonly onChange: (attr: 'name' | 'anchor', value: string) => void;
}) {
  const t = useT();
  const [draft, setDraft] = useState<string | undefined>(undefined);
  return (
    <Input
      className="bd-inspector-name"
      aria-label={t('inspector.nodeName')}
      value={draft ?? props.value}
      disabled={props.disabled}
      placeholder={props.placeholder}
      autoComplete="off"
      spellCheck={false}
      onChange={(event) => {
        setDraft(event.target.value);
        props.onChange('name', event.target.value);
      }}
      onBlur={() => setDraft(undefined)}
    />
  );
}

/**
 * The properties of the selected node (docs/editor.md#inspector): Content (the component's props
 * as controls), Style and Advanced (name, anchor, the display condition, and the props the
 * component puts in the "advanced" or "accessibility" group).
 */
export function Inspector({ locale, defaultLocale, renderStyle }: InspectorProps) {
  const t = useT();
  const store = useEditor();
  const manifest = useManifest();
  const node = useSelectedNode();
  const doc = useEditorState((state) => state.doc);
  const readOnly = useEditorState((state) => state.readOnly);
  const selectedIds = useEditorState((state) => state.selectedIds);
  const count = selectedIds.length;
  const [notice, setNotice] = useState('');

  if (node === undefined) {
    return (
      <div className="bd-inspector">
        <div className="bd-inspector-empty" data-state="nothing">
          <Icon name="mouse-pointer-click" size="md" />
          <p className="bd-inspector-empty-title">{t('inspector.empty')}</p>
          <p className="bd-inspector-empty-hint">{t('inspector.emptyHint')}</p>
        </div>
      </div>
    );
  }
  const meta = componentMeta(manifest, node.type);
  const locked = !canEdit(doc, createIndex(doc), node.id, 'content').ok;
  const disabled = readOnly || locked;

  const report = (result: {
    readonly ok: boolean;
    readonly error?: { readonly message: string };
  }) => setNotice(result.ok ? '' : (result.error?.message ?? ''));

  const write = (prop: string, def: PropDef, value: unknown) => {
    const target = translationLocale(def, locale, defaultLocale);
    const translate: Command = {
      type: 'node.setProp',
      payload: {
        id: node.id,
        prop,
        value: { kind: 'static', value },
        ...(target !== undefined ? { locale: target } : {}),
      },
    };
    // A translation hangs off a fixed value, so a prop still at its default gets that first.
    const current =
      node.props !== undefined && Object.hasOwn(node.props, prop) ? node.props[prop] : undefined;
    if (target !== undefined && current?.kind !== 'static') {
      const base: Command = {
        type: 'node.setProp',
        payload: { id: node.id, prop, value: { kind: 'static', value: def.default } },
      };
      report(store.dispatchBatch([base, translate], { label: 'node.setProp' }));
      return;
    }
    report(store.dispatch(translate));
  };
  // A binding or a formula is the prop's value in the default language; translations belong to fixed values.
  const setValue = (prop: string, _def: PropDef, value: Value) =>
    report(store.dispatch({ type: 'node.setProp', payload: { id: node.id, prop, value } }));
  const fixed = (prop: string, def: PropDef) =>
    report(
      store.dispatch({
        type: 'node.setProp',
        payload: { id: node.id, prop, value: { kind: 'static', value: def.default } },
      }),
    );
  const reset = (prop: string, def: PropDef) => {
    const target = translationLocale(def, locale, defaultLocale);
    report(
      store.dispatch({
        type: 'node.unsetProp',
        payload: { id: node.id, prop, ...(target !== undefined ? { locale: target } : {}) },
      }),
    );
  };
  const setAttr = (attr: 'name' | 'anchor', value: string) =>
    report(
      store.dispatch({
        type: 'node.setAttr',
        payload: { id: node.id, key: attr, value: value === '' ? null : value },
      }),
    );
  const clearCondition = () =>
    report(
      store.dispatch({
        type: 'node.setAttr',
        payload: { id: node.id, key: 'visibleIf', value: null },
      }),
    );

  const propsPanel = (scope: 'content' | 'advanced') => {
    if (meta === undefined) {
      return scope === 'content' ? (
        <p className="bd-inspector-empty">{t('inspector.unknownComponent')}</p>
      ) : null;
    }
    return (
      <PropsPanel
        node={node}
        meta={meta}
        scope={scope}
        locale={locale}
        defaultLocale={defaultLocale}
        disabled={disabled}
        onChange={write}
        onReset={reset}
        onSetValue={setValue}
        onFixed={fixed}
      />
    );
  };

  return (
    <div className="bd-inspector">
      <header className="bd-inspector-head">
        <div className="bd-inspector-headline">
          <ComponentIcon meta={meta} size="md" className="bd-inspector-icon" />
          <h3 className="bd-inspector-title">{meta?.label ?? node.type}</h3>
          <div className="bd-inspector-actions">
            <IconButton
              variant="ghost"
              icon="copy"
              label={t('inspector.duplicate')}
              disabled={disabled}
              onClick={() =>
                report(store.dispatch({ type: 'node.duplicate', payload: { ids: selectedIds } }))
              }
            />
            <IconButton
              variant="ghost"
              icon="trash-2"
              label={t('inspector.delete')}
              disabled={disabled}
              onClick={() =>
                report(store.dispatch({ type: 'node.remove', payload: { ids: selectedIds } }))
              }
            />
          </div>
        </div>
        <HeaderName
          key={node.id}
          nodeId={node.id}
          value={node.name ?? ''}
          placeholder={meta?.label ?? node.type}
          disabled={disabled}
          onChange={setAttr}
        />
        {count > 1 ? (
          <p className="bd-inspector-count">{`${count} ${t('inspector.selected')}`}</p>
        ) : null}
        {locked ? <p className="bd-inspector-locked">{t('inspector.locked')}</p> : null}
      </header>
      <TranslationBanner locale={locale} defaultLocale={defaultLocale} />
      <Tabs
        label={t('inspector.tabs')}
        items={[
          { value: 'content', label: t('inspector.tab.content'), content: propsPanel('content') },
          {
            value: 'style',
            label: t('inspector.tab.style'),
            content: renderStyle?.(node) ?? (
              <p className="bd-inspector-empty">{t('inspector.style.pending')}</p>
            ),
          },
          {
            value: 'advanced',
            label: t('inspector.tab.advanced'),
            content: (
              <>
                <AttrField
                  key={`${node.id}-name`}
                  nodeId={node.id}
                  attr="name"
                  label={t('inspector.attr.name')}
                  value={node.name ?? ''}
                  disabled={disabled}
                  onChange={setAttr}
                />
                <AttrField
                  key={`${node.id}-anchor`}
                  nodeId={node.id}
                  attr="anchor"
                  label={t('inspector.attr.anchor')}
                  value={node.anchor ?? ''}
                  disabled={disabled}
                  placeholder="section-1"
                  onChange={setAttr}
                />
                {node.visibleIf !== undefined ? (
                  <div className="bd-field" data-attr="visibleIf">
                    <span className="bd-field-label">{t('inspector.attr.visibleIf')}</span>
                    <p className="bd-field-chip">{t('inspector.attr.visibleIfSet')}</p>
                    <Button variant="ghost" disabled={disabled} onClick={clearCondition}>
                      {t('inspector.attr.visibleIfRemove')}
                    </Button>
                  </div>
                ) : null}
                {propsPanel('advanced')}
              </>
            ),
          },
        ]}
      />
      <div role="status" className="bd-inspector-notice">
        {notice}
      </div>
    </div>
  );
}
