export interface LayoutFieldViewProps {
  /** Nodes in the stored document; `undefined` when nothing was built yet. */
  readonly nodeCount: number | undefined;
  /** `undefined` for a document that is not saved yet. */
  readonly id: string | number | undefined;
  readonly collection: string;
  readonly editorRoute: string;
  /** Opens a window; injected so the button can be tested without a browser. */
  readonly open?: (url: string, name: string) => void;
}

/** The window name is per document, so a second click reuses the tab that is already open. */
export const editorWindowName = (collection: string, id: string | number) =>
  `buildr-${collection}-${id}`;

export const editorUrl = (editorRoute: string, collection: string, id: string | number) =>
  `${editorRoute.replace(/\/$/, '')}/${encodeURIComponent(collection)}/${encodeURIComponent(String(id))}`;

/** A summary of the layout and the button that opens the builder (docs/payload.md). */
export function LayoutFieldView(props: LayoutFieldViewProps) {
  const { id, collection, nodeCount } = props;
  const open = props.open ?? ((url: string, name: string) => void window.open(url, name));
  const saved = id !== undefined && id !== '';
  return (
    <div className="field-type buildr-layout-field">
      <span className="field-label">Layout</span>
      <p data-testid="buildr-layout-summary">
        {nodeCount === undefined ? 'Nothing built yet.' : `${nodeCount} elements.`}
      </p>
      <button
        type="button"
        className="btn btn--style-primary btn--size-medium"
        disabled={!saved}
        title={saved ? undefined : 'Save the document first'}
        onClick={() => {
          if (saved)
            open(editorUrl(props.editorRoute, collection, id), editorWindowName(collection, id));
        }}
      >
        Edit with Visual Builder
      </button>
    </div>
  );
}
