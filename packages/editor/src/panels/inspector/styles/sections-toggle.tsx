import { useSyncExternalStore } from 'react';
import { useT } from '../../../messages/index.tsx';
import { IconButton } from '../../../ui/index.ts';
import { setAllSections } from './section-state.ts';
import { useSectionRegistry } from './sections-context.tsx';

/**
 * Expands every style section on screen, or collapses them all once every one is open. Meant for
 * the Inspector's `headerActions`, inside the same `StyleSectionsProvider` as the StyleInspector; the choice is remembered like a single section's.
 */
export function SectionsToggle() {
  const t = useT();
  const registry = useSectionRegistry();
  const { names, allOpen } = useSyncExternalStore(
    registry.subscribe,
    registry.snapshot,
    registry.snapshot,
  );
  // PB-157 WP5a: no dedicated keys yet; the structure tree's labels say the same thing.
  const label = allOpen ? t('structure.collapseAll') : t('structure.expandAll');
  return (
    <IconButton
      icon={allOpen ? 'chevrons-down-up' : 'chevrons-up-down'}
      label={label}
      size="sm"
      disabled={names.length === 0}
      onClick={() => setAllSections(registry, !allOpen)}
    />
  );
}
