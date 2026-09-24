import type {
  BuilderDocument,
  DataContext,
  DataSchema,
  Diagnostic,
  MediaAsset,
} from '@buildr/core';

/** Which document the editor opens: a collection and an id in the host's backend. */
export interface DocumentRef {
  readonly collection: string;
  readonly id: string | number;
}

/** Who is editing and what they may do; decided by the host's backend. */
export interface EditorSession {
  readonly userId?: string | undefined;
  readonly canEdit: boolean;
  readonly canPublish: boolean;
}

/** A document as the backend has it (`GET` of docs/payload.md#endpoints). */
export interface LoadedDocument {
  readonly title: string;
  readonly slug?: string | undefined;
  readonly status: 'draft' | 'published';
  readonly updatedAt: string;
  /** Changes with every save; the next save says which one it builds on (`baseRevision`). */
  readonly revision: number;
  readonly document: BuilderDocument;
  /** A viewer's role, or a component newer than this build knows: the document may not be changed. */
  readonly readOnly?: boolean | undefined;
}

export interface SaveRequest {
  readonly document: BuilderDocument;
  readonly baseRevision: number;
  /** `true` for a save the editor started on its own, `false` for Ctrl+S; the backend may keep fewer versions of the former. */
  readonly autosave: boolean;
}

/**
 * What a save came to. A refused save is a value, not a rejection: only what the adapter could not
 * tell (no network, a 5xx) rejects, and that is the case the editor retries.
 */
export type SaveResult =
  | { readonly ok: true; readonly revision: number; readonly updatedAt: string }
  | { readonly ok: false; readonly kind: 'conflict'; readonly currentRevision: number }
  | { readonly ok: false; readonly kind: 'invalid'; readonly diagnostics: readonly Diagnostic[] };

export type PublishResult =
  | { readonly ok: true; readonly revision: number; readonly updatedAt: string }
  | { readonly ok: false; readonly kind: 'conflict'; readonly currentRevision: number }
  | { readonly ok: false; readonly kind: 'invalid'; readonly diagnostics: readonly Diagnostic[] };

/** What `PersistenceController.publish` came to. */
export type PublishOutcome =
  | { readonly ok: true; readonly revision: number; readonly updatedAt: string }
  | { readonly ok: false; readonly kind: 'conflict'; readonly currentRevision: number }
  | { readonly ok: false; readonly kind: 'invalid'; readonly diagnostics: readonly Diagnostic[] }
  /** The document could not be saved first, so there is nothing consistent to publish. */
  | { readonly ok: false; readonly kind: 'unsaved' }
  | { readonly ok: false; readonly kind: 'network'; readonly message: string };

export interface MediaSearchResult {
  readonly items: readonly MediaAsset[];
  readonly nextCursor?: string | undefined;
}

/** What the editor needs from a backend (docs/editor.md#persistence-pb-087); `@buildr/payload` implements it. */
export interface DocumentAdapter {
  getSession(ref: DocumentRef): Promise<EditorSession>;
  load(ref: DocumentRef): Promise<LoadedDocument>;
  save(ref: DocumentRef, request: SaveRequest): Promise<SaveResult>;
  publish(ref: DocumentRef, request: { readonly baseRevision: number }): Promise<PublishResult>;
  getDataSchema(ref: DocumentRef): Promise<DataSchema>;
  /** The data the page is shown with; `sampleId` (one of `listSamples`) picks the entry a template is previewed against. */
  getContext(ref: DocumentRef, options?: { readonly sampleId?: string }): Promise<DataContext>;
  listSamples?(
    ref: DocumentRef,
  ): Promise<readonly { readonly id: string; readonly label: string }[]>;
  readonly media: {
    search(query: {
      readonly text?: string;
      readonly cursor?: string;
      readonly mimeTypes?: readonly string[];
    }): Promise<MediaSearchResult>;
    /** Adds a file to the library. `alt` is required: an image without alternative text is an accessibility error. */
    upload?(file: File, alt: string): Promise<MediaAsset>;
  };
  /** Where the site shows the page as a visitor would; `draft` asks for the unpublished version. */
  previewUrl(ref: DocumentRef, options?: { readonly draft?: boolean }): string;
  /** The page in the CMS's own admin, when it has one. */
  cmsUrl?(ref: DocumentRef): string | undefined;
}

export type PersistenceStatus =
  /** The document is the saved one. */
  | 'clean'
  /** Changed since the last save; a save is scheduled. */
  | 'dirty'
  | 'saving'
  /** The last save failed and will be retried (or, for `invalid`, waits for a change). */
  | 'error'
  /** Somebody else saved in the meantime; the author chooses between reload and overwrite. */
  | 'conflict';

export type PersistenceError =
  | { readonly kind: 'network'; readonly message: string; readonly attempt: number }
  | { readonly kind: 'invalid'; readonly diagnostics: readonly Diagnostic[] };

export interface PersistenceState {
  readonly status: PersistenceStatus;
  /** The revision the next save builds on. */
  readonly revision: number;
  readonly lastSavedAt: string | undefined;
  readonly error: PersistenceError | undefined;
  /** The revision the backend has now, while `status` is `conflict`. */
  readonly conflictRevision: number | undefined;
}

/** The timers the state machine runs on; tests inject their own. */
export interface Clock {
  now(): number;
  setTimeout(handler: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}
