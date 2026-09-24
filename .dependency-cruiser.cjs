'use strict';

// Mechanically enforces docs/ai/architecture-rules.md and docs/ai/package-boundaries.md.
// Run with `pnpm check:boundaries`. See tooling/boundary-fixtures/ for the fixtures that
// exercise every rule below (each fixture is cruised with this same config, see
// tooling/boundary-fixtures/boundaries.test.ts).

/**
 * Builds a `to` matcher for an npm package, matching it whether pnpm resolved it (real path
 * under node_modules, possibly through the .pnpm virtual store) or it stayed unresolved
 * because the importing package never declared it as a dependency (a phantom import - pnpm's
 * strict node_modules would refuse it at install/build time, but we want a clear boundary
 * error instead of a cryptic module-not-found). Written as a flat alternation (no nested
 * optional groups) because dependency-cruiser's safe-regex check rejects `(a)?(b)?`-shaped
 * patterns as unsafe even when they aren't.
 * @param {string} packageName
 */
function npmPackage(packageName) {
  return [
    `^${packageName}($|/)`,
    `^node_modules/${packageName}($|/)`,
    `^node_modules/\\.pnpm/[^/]+/node_modules/${packageName}($|/)`,
  ].join('|');
}

/**
 * Builds a `to` matcher for one or more `@buildr/*` packages. A properly declared dependency
 * resolves to the real `packages/<name>/src/...` file (the `exports` convention from PB-002);
 * one the importing package never declared stays an unresolved `@buildr/<name>` specifier, so
 * both forms need matching (see `npmPackage` above for why).
 * @param {readonly string[]} packageNames
 */
function buildrPackages(packageNames) {
  return [
    `^packages/(${packageNames.join('|')})/src/`,
    `^@buildr/(${packageNames.join('|')})($|/)`,
  ].join('|');
}

/** @param {readonly string[]} coreModules first path segment under packages/core/src/ */
function coreModules(modules) {
  return `^packages/core/src/(${modules.join('|')})(/|\\.[jt]sx?$)`;
}

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Cyclic dependencies make the module boundaries this config enforces meaningless.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-cross-package-internal',
      severity: 'error',
      comment:
        "A package's internal/ folder is not part of its public API (docs/ai/package-boundaries.md) - only that same package may import it.",
      from: { path: '^packages/([^/]+)/src/' },
      to: {
        path: '(^|/)internal/',
        pathNot: '^packages/$1/src/',
      },
    },

    // --- Package-level boundaries (docs/ai/package-boundaries.md) ---

    {
      name: 'core-no-frameworks',
      severity: 'error',
      comment: '@buildr/core has zero framework dependencies (ADR, architecture-rules.md).',
      from: { path: '^packages/core/src/' },
      to: { path: `(${['react', 'react-dom', 'next', 'payload'].map(npmPackage).join('|')})` },
    },
    {
      name: 'core-no-buildr-packages',
      severity: 'error',
      comment: '@buildr/core must not depend on any other @buildr/* package.',
      from: { path: '^packages/core/src/' },
      to: { path: buildrPackages(['react', 'components', 'editor', 'next', 'payload']) },
    },
    {
      name: 'core-immer-only-in-commands',
      severity: 'error',
      comment: 'immer is only allowed inside @buildr/core/commands.',
      from: { path: '^packages/core/src/', pathNot: '^packages/core/src/commands/' },
      to: { path: npmPackage('immer') },
    },

    {
      name: 'react-no-frameworks',
      severity: 'error',
      from: { path: '^packages/react/src/' },
      to: { path: `(${['next', 'payload'].map(npmPackage).join('|')})` },
    },
    {
      name: 'react-server-no-client',
      severity: 'error',
      comment:
        "./server never imports the 'use client' entry (./client); registry components are the only client code it may reach.",
      from: { path: '^packages/react/src/server/' },
      to: { path: '^packages/react/src/client/' },
    },
    {
      name: 'react-no-downstream-packages',
      severity: 'error',
      comment: '@buildr/react may only depend on @buildr/core.',
      from: { path: '^packages/react/src/' },
      to: { path: buildrPackages(['editor', 'components', 'next', 'payload']) },
    },

    {
      name: 'components-no-frameworks',
      severity: 'error',
      from: { path: '^packages/components/src/' },
      to: { path: `(${['next', 'payload'].map(npmPackage).join('|')})` },
    },
    {
      name: 'components-no-downstream-packages',
      severity: 'error',
      comment: '@buildr/components may only depend on @buildr/core and @buildr/react.',
      from: { path: '^packages/components/src/' },
      to: { path: buildrPackages(['editor', 'next', 'payload']) },
    },

    {
      name: 'editor-no-frameworks',
      severity: 'error',
      comment:
        'The editor never renders the document - it drives a canvas through the postMessage protocol.',
      from: { path: '^packages/editor/src/' },
      to: { path: `(${['next', 'payload'].map(npmPackage).join('|')})` },
    },
    {
      name: 'editor-no-render-packages',
      severity: 'error',
      comment: '@buildr/editor must not depend on @buildr/react or @buildr/components.',
      from: { path: '^packages/editor/src/' },
      to: { path: buildrPackages(['react', 'components', 'next', 'payload']) },
    },

    {
      name: 'next-no-payload',
      severity: 'error',
      from: { path: '^packages/next/src/' },
      to: { path: npmPackage('payload') },
    },
    {
      name: 'next-no-downstream-packages',
      severity: 'error',
      comment: '@buildr/next may only depend on @buildr/core and @buildr/react.',
      from: { path: '^packages/next/src/' },
      to: { path: buildrPackages(['components', 'payload']) },
    },
    {
      name: 'next-editor-confined-to-its-subpath',
      severity: 'error',
      comment:
        '@buildr/editor is only a peer of the ./editor subpath of @buildr/next, not the rest of the package.',
      from: { path: '^packages/next/src/', pathNot: '^packages/next/src/editor/' },
      to: { path: buildrPackages(['editor']) },
    },

    {
      name: 'payload-plugin-data-admin-no-render-packages',
      severity: 'error',
      comment:
        'payload/{plugin,data,admin} must not depend on @buildr/editor or @buildr/components.',
      from: { path: '^packages/payload/src/(plugin|data|admin)/' },
      to: { path: buildrPackages(['editor', 'components']) },
    },
    {
      name: 'payload-plugin-admin-no-react',
      severity: 'error',
      comment: 'Only payload/data may import @buildr/react, and only as a type-only import.',
      from: { path: '^packages/payload/src/(plugin|admin)/' },
      to: { path: buildrPackages(['react']) },
    },
    {
      name: 'payload-data-no-runtime-react',
      severity: 'error',
      comment: 'payload/data may only import @buildr/react for types, never at runtime.',
      from: { path: '^packages/payload/src/data/' },
      to: { path: buildrPackages(['react']), dependencyTypesNot: ['type-only'] },
    },
    {
      name: 'payload-adapter-isolated',
      severity: 'error',
      comment:
        'payload/adapter is the fetch client used from @buildr/next/editor and must stay usable without the payload package, @payloadcms/*, or next itself.',
      from: { path: '^packages/payload/src/adapter/' },
      to: {
        path: `(${['payload', '@payloadcms/.*', 'next'].map(npmPackage).join('|')})`,
      },
    },
    {
      name: 'payload-adapter-no-next-package',
      severity: 'error',
      from: { path: '^packages/payload/src/adapter/' },
      to: { path: buildrPackages(['next']) },
    },
    {
      name: 'payload-next-no-editor',
      severity: 'error',
      from: { path: '^packages/payload/src/next/' },
      to: { path: buildrPackages(['editor']) },
    },

    // --- Layers inside @buildr/core (docs/ai/architecture-rules.md, module ownership table) ---

    {
      name: 'core-document-is-self-contained',
      severity: 'error',
      comment: 'core/document is L1 and must not import any other core module.',
      from: { path: '^packages/core/src/document/' },
      to: {
        path: coreModules([
          'schema',
          'registry',
          'data',
          'values',
          'prepare',
          'expressions',
          'styles',
          'rules',
          'dnd',
          'templates',
          'forms',
          'migrations',
          'commands',
          'validation',
          'a11y',
          'protocol',
        ]),
      },
    },
    {
      name: 'core-schema-registry-forbidden',
      severity: 'error',
      from: { path: '^packages/core/src/(schema|registry)/' },
      to: { path: coreModules(['values', 'commands']) },
    },
    {
      name: 'core-data-values-prepare-forbidden',
      severity: 'error',
      from: { path: '^packages/core/src/(data|values|prepare)/' },
      to: { path: coreModules(['commands', 'styles']) },
    },
    {
      name: 'core-expressions-isolated',
      severity: 'error',
      comment:
        'core/expressions may only use L0, DataType (schema/registry) and data (DataContext/getPath, for evaluation) - everything else is forbidden.',
      from: { path: '^packages/core/src/expressions/' },
      to: {
        path: coreModules([
          'document',
          'values',
          'prepare',
          'styles',
          'rules',
          'dnd',
          'templates',
          'forms',
          'migrations',
          'commands',
          'validation',
          'a11y',
          'protocol',
        ]),
      },
    },
    {
      name: 'core-styles-forbidden',
      severity: 'error',
      from: { path: '^packages/core/src/styles/' },
      to: { path: coreModules(['values', 'commands']) },
    },
    {
      name: 'core-rules-dnd-templates-forbidden',
      severity: 'error',
      from: { path: '^packages/core/src/(rules|dnd|templates)/' },
      to: { path: coreModules(['commands']) },
    },
    {
      name: 'core-commands-forbidden',
      severity: 'error',
      comment: 'commands does not import a11y/validation/prepare/protocol (architecture-rules.md).',
      from: { path: '^packages/core/src/commands/' },
      to: { path: coreModules(['a11y', 'validation', 'prepare', 'protocol']) },
    },
    {
      name: 'core-validation-a11y-forbidden',
      severity: 'error',
      from: { path: '^packages/core/src/(validation|a11y)/' },
      to: { path: coreModules(['commands']) },
    },
    {
      name: 'core-protocol-forbidden',
      severity: 'error',
      comment: 'core/protocol only depends on L0 and document types, never commands.',
      from: { path: '^packages/core/src/protocol/' },
      to: { path: coreModules(['commands']) },
    },
  ],
  options: {
    tsPreCompilationDeps: 'specify',
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'types', 'default'],
    },
    // Scoped to our own workspace packages' build output - an unscoped `dist/` would also
    // exclude npm packages that happen to ship from a `dist/` folder (e.g. `payload`),
    // silently dropping the dependency edge to them instead of just not following it.
    exclude: { path: '^(packages|tooling)/[^/]+/dist/|^tooling/boundary-fixtures/' },
    doNotFollow: { path: '(^|/)node_modules/' },
  },
};
