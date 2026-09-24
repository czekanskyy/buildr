import type {
  ComponentType as BuilderComponentType,
  ComponentMeta,
  ComponentMigrationContext,
  ComponentMigrationStep,
  DataContext,
  JsonValue,
  LocaleCode,
  NodeId,
  PageNode,
  PropDef,
  ResolvedProps,
  SlotName,
} from '@buildr/core';
import type { ComponentPropsWithoutRef, FunctionComponent, ReactNode } from 'react';

/** Props of the platform's link primitive: internal paths and external URLs are routed by the adapter. */
export type PlatformLinkProps = Omit<ComponentPropsWithoutRef<'a'>, 'href'> & {
  readonly href: string;
};

/** Props of the platform's image primitive (`next/image` in the Next.js adapter, a plain `img` elsewhere). */
export type PlatformImageProps = Omit<ComponentPropsWithoutRef<'img'>, 'src' | 'alt'> & {
  readonly src: string;
  readonly alt: string;
  readonly width?: number;
  readonly height?: number;
  readonly priority?: boolean;
};

/**
 * What the host application injects into rendering (docs/renderer.md): link and image primitives
 * and the form action. Not serializable, so only `runtime: 'shared'` components receive it.
 */
export interface Platform {
  readonly Link: FunctionComponent<PlatformLinkProps>;
  readonly Image: FunctionComponent<PlatformImageProps>;
  /** The `action` of a form: a URL or a server action, for the form node `nodeId` in the layout `ref`. */
  formAction(ref: string, nodeId: NodeId): string | ((formData: FormData) => void | Promise<void>);
}

/** The attributes a component MUST spread onto its root element — this is what gives it its style class and identity. */
export interface NodeRoot {
  readonly className: string;
  readonly id?: string;
  readonly 'data-bid'?: string;
  readonly 'data-bi'?: number;
}

/** The container of a node, as a component sees it (`BuilderComponentProps.node.parent`). */
export interface NodeParent {
  readonly id: NodeId;
  readonly type: BuilderComponentType;
  readonly props: Readonly<Record<string, JsonValue>>;
}

export interface ComponentEnv {
  readonly mode: DataContext['mode'];
  readonly locale: LocaleCode;
  /** Built-in strings ("opens in a new tab", form messages) for `locale`. Serializable. */
  readonly messages: Readonly<Record<string, string>>;
}

/** A prop schema: what the `p.*` builders produce. */
export type PropSchema = Readonly<Record<string, PropDef>>;

/**
 * What a `runtime: 'shared'` component receives (docs/renderer.md#the-component-contract): the
 * resolved, validated and sanitized props, the `root` attributes, and its rendered slots.
 */
export interface BuilderComponentProps<P extends PropSchema = PropSchema> {
  readonly props: ResolvedProps<P>;
  readonly root: NodeRoot;
  readonly slots: Readonly<Record<SlotName, ReactNode>>;
  /** Same as `slots.default`. */
  readonly children?: ReactNode;
  readonly node: {
    readonly id: NodeId;
    readonly type: BuilderComponentType;
    /**
     * The node whose slot this one is rendered into, with its resolved props: for a component that
     * behaves according to its container (an accordion item's group, say). Absent for the root.
     * A node rendered by a Loop has the Loop as its parent. Serializable, so client components get it too.
     */
    readonly parent?: NodeParent;
  };
  readonly env: ComponentEnv;
  readonly platform?: Platform;
}

/** What a `runtime: 'client'` component receives: only serializable values, so no `platform`. */
export type ClientComponentProps<P extends PropSchema = PropSchema> = Omit<
  BuilderComponentProps<P>,
  'platform'
>;

/**
 * Prop migrations of a component, keyed by the version they migrate *to*:
 * `{ 2: (props) => ({ ...props, size: props.level }) }` upgrades version 1 to 2.
 */
export type ComponentMigrationMap = Readonly<
  Record<number, (props: PageNode['props'], ctx: ComponentMigrationContext) => PageNode['props']>
>;

/** The serializable metadata of a component plus its React implementation. */
interface DefineComponentBase<P extends PropSchema>
  extends Omit<ComponentMeta, 'props' | 'runtime'> {
  readonly props: P;
  readonly migrations?: ComponentMigrationMap;
}

export interface DefineSharedComponent<P extends PropSchema> extends DefineComponentBase<P> {
  readonly runtime: 'shared';
  readonly render: FunctionComponent<BuilderComponentProps<P>>;
}

export interface DefineClientComponent<P extends PropSchema> extends DefineComponentBase<P> {
  readonly runtime: 'client';
  /** Lives in a `*.client.tsx` file with `'use client'`; its metadata stays importable from the server. */
  readonly render: FunctionComponent<ClientComponentProps<P>>;
}

export type DefineComponentInput<P extends PropSchema> =
  | DefineSharedComponent<P>
  | DefineClientComponent<P>;

/** The render function once its props are known to have been resolved from this component's own metadata. */
export type ErasedRender = FunctionComponent<BuilderComponentProps>;

/** What `defineComponent` returns and `createRegistry` consumes: metadata plus implementation, type-erased. */
export interface ComponentDefinition {
  readonly meta: ComponentMeta;
  readonly render: ErasedRender;
  /** The steps that bring stored props to `meta.version`, in order. */
  readonly migrations: readonly ComponentMigrationStep[];
}
