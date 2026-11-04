import { PageChip, type PageChipProps } from './page-chip.tsx';

export type ToolbarCentreProps = PageChipProps;

/** The page chip, which opens the page options. */
export function ToolbarCentre(props: ToolbarCentreProps) {
  return (
    <div className="bd-toolbar-cluster" data-zone="centre">
      <PageChip {...props} />
    </div>
  );
}
