import type { ComponentMeta, PageNode, PropDef, Value } from '@next-buildr/core';
import { useT } from '../../../messages/index.tsx';
import { useEditor } from '../../../store/index.ts';
import { Field } from '../props-panel.tsx';
import { readProp } from '../value.ts';

/** The props that hold the image and the video of a background, and the poster of the video. */
export const BACKGROUND_IMAGE = 'backgroundImage';
export const BACKGROUND_VIDEO = 'backgroundVideo';
export const BACKGROUND_POSTER = 'backgroundPoster';

/** Settings shared by both kinds of media, in the order they are shown. */
const SHARED = [
  'backgroundOverlay',
  'overlayTone',
  'overlayOpacity',
  'backgroundFit',
  'backgroundPosition',
  'backgroundAttachment',
] as const;

const isMedia = (def: PropDef | undefined): def is PropDef => def?.kind === 'media';

/** What a component offers for a media background, found by the shape of its props. */
export function backgroundMediaSupport(meta: ComponentMeta | undefined): {
  readonly image: boolean;
  readonly video: boolean;
} {
  return {
    image: isMedia(meta?.props[BACKGROUND_IMAGE]),
    video: isMedia(meta?.props[BACKGROUND_VIDEO]),
  };
}

/** The node carries a value for the prop (a link, a library file, a binding or a formula). */
export function hasMedia(node: PageNode, name: string): boolean {
  if (node.props === undefined || !Object.hasOwn(node.props, name)) return false;
  const value = node.props[name];
  if (value === undefined) return false;
  if (value.kind !== 'static') return true;
  return value.value !== null && value.value !== undefined && value.value !== '';
}

/** The media a mode does not keep: switching to the mode removes these (one undo step). */
export function mediaToClear(mode: string): readonly string[] {
  if (mode === 'image') return [BACKGROUND_VIDEO, BACKGROUND_POSTER];
  if (mode === 'video') return [BACKGROUND_IMAGE];
  return [BACKGROUND_IMAGE, BACKGROUND_VIDEO, BACKGROUND_POSTER];
}

/**
 * The fields of the Image and Video background modes: the media itself (library picker or an
 * external link behind the ADR-028 warning), the poster of a video, the overlay and how the media
 * fills the box. They are the component's own props, written with the same commands as the
 * Content tab does.
 */
export function BackgroundMediaFields(props: {
  readonly node: PageNode;
  readonly meta: ComponentMeta;
  readonly mode: 'image' | 'video';
  readonly disabled: boolean;
  readonly onError: (message: string) => void;
}) {
  const t = useT();
  const store = useEditor();
  const { node, meta, mode } = props;
  const report = (result: {
    readonly ok: boolean;
    readonly error?: { readonly message: string };
  }) => props.onError(result.ok ? '' : (result.error?.message ?? ''));
  const names = [
    ...(mode === 'image' ? [BACKGROUND_IMAGE] : [BACKGROUND_VIDEO, BACKGROUND_POSTER]),
    ...SHARED,
  ].filter((name) => meta.props[name] !== undefined);
  return (
    <div className="bd-props-fields bd-bg-media" data-mode={mode}>
      {names.map((name) => {
        const def = meta.props[name] as PropDef;
        const raw =
          node.props !== undefined && Object.hasOwn(node.props, name)
            ? node.props[name]
            : undefined;
        return (
          <Field
            key={name}
            name={name}
            def={def}
            reading={readProp(node, name, def, undefined, undefined)}
            raw={raw}
            disabled={props.disabled}
            translating={false}
            nameFor={(text) => text}
            onChange={(prop, _def, value) =>
              report(
                store.dispatch({
                  type: 'node.setProp',
                  payload: { id: node.id, prop, value: { kind: 'static', value } },
                }),
              )
            }
            onReset={(prop) =>
              report(store.dispatch({ type: 'node.unsetProp', payload: { id: node.id, prop } }))
            }
            onSetValue={(prop, _def, value: Value) =>
              report(
                store.dispatch({ type: 'node.setProp', payload: { id: node.id, prop, value } }),
              )
            }
            onFixed={(prop, fieldDef) =>
              report(
                store.dispatch({
                  type: 'node.setProp',
                  payload: {
                    id: node.id,
                    prop,
                    value: { kind: 'static', value: fieldDef.default },
                  },
                }),
              )
            }
          />
        );
      })}
      <p className="bd-hint">{t('style.media.switchHint')}</p>
    </div>
  );
}
