import { type ComponentMigrationStep, validateComponentMeta } from '@buildr/core';
import type {
  ComponentDefinition,
  ComponentMigrationMap,
  DefineComponentInput,
  ErasedRender,
  PropSchema,
} from './types.ts';

function invalid(type: string, problem: string): Error {
  return new Error(`defineComponent("${type}"): ${problem}`);
}

/**
 * Turns `{ 2: fn, 3: fn }` into the ordered `from -> to` steps `migrateComponents` runs. The keys
 * must be integers above 1, must not go beyond the component's `version`, and must be contiguous
 * up to it, so a stored version never falls into a gap.
 */
function toSteps(
  type: string,
  version: number,
  map: ComponentMigrationMap,
): ComponentMigrationStep[] {
  const targets = Object.keys(map)
    .map(Number)
    .sort((a, b) => a - b);
  for (const to of targets) {
    if (!Number.isInteger(to) || to < 2) {
      throw invalid(type, `migration keys are the version they migrate to (2 or more), got ${to}`);
    }
    if (to > version) {
      throw invalid(
        type,
        `there is a migration to version ${to}, but the component is at version ${version}`,
      );
    }
  }
  const last = targets[targets.length - 1];
  if (last !== undefined && last !== version) {
    throw invalid(
      type,
      `the newest migration goes to version ${last}, but the component is at version ${version}`,
    );
  }
  targets.forEach((to, i) => {
    const previous = targets[i - 1];
    if (previous !== undefined && to !== previous + 1) {
      throw invalid(
        type,
        `migrations skip from version ${previous} to ${to}; add one for ${previous + 1}`,
      );
    }
  });
  return targets.map((to) => {
    const migrate = map[to];
    if (typeof migrate !== 'function') {
      throw invalid(type, `the migration to version ${to} is not a function`);
    }
    return { from: to - 1, to, migrate };
  });
}

/**
 * Defines a component: its serializable metadata (docs/component-registry.md) together with the
 * React implementation (`render`, `runtime`, `migrations`). Validates on the spot and throws on a
 * mistake — an authoring error made while wiring up the application, not bad end-user data. The
 * result goes into `createRegistry`.
 */
export function defineComponent<const P extends PropSchema>(
  input: DefineComponentInput<P>,
): ComponentDefinition {
  const { render, migrations, ...meta } = input;
  if (typeof render !== 'function') throw invalid(meta.type, '`render` must be a function');

  const diagnostics = validateComponentMeta(meta);
  if (diagnostics.length > 0) {
    const summary = diagnostics.map((d) => `${d.code} (${d.message})`).join('; ');
    throw invalid(meta.type, summary);
  }

  return Object.freeze({
    meta,
    // Props are resolved against this component's own metadata before `render` is called, so the
    // narrower `ResolvedProps<P>` the author wrote against is what actually arrives.
    render: render as unknown as ErasedRender,
    migrations: Object.freeze(toSteps(meta.type, meta.version, migrations ?? {})),
  });
}
