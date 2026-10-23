# Releasing

Buildr publishes its packages to npm with [Changesets](https://github.com/changesets/changesets). Nobody bumps a version or publishes by hand.

## The packages and the version

`@next-buildr/core`, `@next-buildr/react`, `@next-buildr/components`, `@next-buildr/editor`, `@next-buildr/next`, `@next-buildr/payload` and `@next-buildr/mcp` are one **fixed group** (`"fixed": [["@next-buildr/*"]]` in `.changeset/config.json`, [ADR-001](adr/ADR-001-monorepo.md)): they are always released together, at the same version, even when only one of them changed. Applications and tooling packages (`apps/*`, `tooling/*`, `@next-buildr/test-utils`) are workspace-internal and follow the same version numbers but are not what you install. Only the entry points a package declares in `exports` are covered by semver; `internal/` modules are not.

Every public package manifest declares `license: "MIT"` and each package has its own README for npm's package page. Keep those metadata files alongside the package when adding a public package.

## The flow

1. **A change to a package's public API adds a changeset.** Run `pnpm changeset`, pick every affected package and the bump type (patch, minor, major) and write a sentence for the changelog. The file lands in `.changeset/`. The `changeset-check` job of the `Release` workflow fails a pull request without one (`pnpm changeset status --since=origin/main`), and AGENTS.md requires it. A change that only touches documentation or tests inside a package directory still needs the check to pass: add an empty changeset with `pnpm changeset --empty`, which bumps nothing.
2. **Pull requests merge into `main`.** Nothing is published yet.
3. **The release workflow keeps a "Version Packages" pull request open.** On every push to `main`, `.github/workflows/release.yml` runs `pnpm build` and then `changesets/action`. While there are unreleased changesets the action runs `pnpm changeset version` on a `changeset-release/main` branch and opens (or updates) the **Version PR**: it consumes the changesets, writes each package's `CHANGELOG.md` and sets the new version in every `package.json`. Do not edit versions yourself and do not run `changeset version` locally.
4. **Merging the Version PR publishes.** The next run of the workflow finds no changesets, so it runs `pnpm changeset publish`: it publishes every package whose version is not on npm yet and pushes the git tags. The job has `id-token: write`; pnpm uses npm Trusted Publishing (OIDC), with automatic provenance for public packages built from this public repository. No npm write token is stored in GitHub.
5. **Everything the published packages need is built first.** `pnpm build` produces `dist/` for every package; the `publishConfig` in each `package.json` points `exports` at it (in the repository, `exports` point at `src` so tools run without a build).

## Trusted Publishing setup (PB-005)

Follow the [npm Trusted Publishing documentation](https://docs.npmjs.com/trusted-publishers/).
The GitHub-hosted release job uses the pnpm version pinned in `package.json`;
since pnpm 11, publishing is native rather than delegated to npm CLI.
See [pnpm publish](https://pnpm.io/cli/publish).

For **each** of the seven public packages, open npm package Settings → Trusted publishing,
select GitHub Actions and enter:

| Setting | Value |
|---|---|
| Organization or user | `czekanskyy` |
| Repository | `buildr` |
| Workflow filename | `release.yml` (no directory prefix) |
| Environment name | Leave empty; the release job does not use an environment |
| Allowed actions | Allow direct publishing (`npm publish`), not only staging |

The workflow needs `id-token: write`, `contents: write` and `pull-requests: write`.
In GitHub Settings → Actions → General, enable Actions creating pull requests.
The token-free user `.npmrc` prevents `changesets/action@v1` from writing a token entry;
`NPM_TOKEN` and `NODE_AUTH_TOKEN` are not required for these public dependencies.
Each public package declares the matching `repository.url` and its monorepo directory.

Create the publisher configuration shortly before the next release: npm requires its
first successful publish within two days or the configuration expires. After verifying
OIDC publishing, revoke obsolete npm publish tokens and set the package's Publishing
access to **Require two-factor authentication and disallow tokens**. OIDC still works.

### First publication of a new package

The documented npm settings flow starts with an existing package. For the initial
bootstrap only, a maintainer may publish the reviewed release tarballs locally using
`npm login` and interactive 2FA, then configure the trusted publisher above.
Use versions prepared by the Changesets Version PR; do not edit version numbers by hand.
Build first, create the archives with `pnpm pack` (which rewrites `workspace:` dependencies
and applies `publishConfig`), inspect their manifests and files, and publish those archives
with `npm publish <archive.tgz> --access public`. Do not publish unprocessed source folders
with npm. This one-time local bootstrap has no GitHub provenance; subsequent OIDC releases do.

## How 1.0.0 was cut

Buildr was built task by task (phases 0-14 of the [backlog](backlog/README.md)) with a changeset in every pull request, and nothing was ever published: there were no 0.x releases on npm. The changesets accumulated on `main` and the release workflow opened the Version PR ("Version Packages", #121), which sets every package to **1.0.0** and writes the changelogs from those changesets. Merging it is the release: it publishes all seven packages to npm with provenance.

The decisions around it:

- The document format has been protected from the first commit (schema versioning plus forward-only migrations, [migrations.md](migrations.md)), so 1.0.0 is the first version of a stable format, not a break from an earlier one.
- What is **not** part of 1.0.0 is listed in [roadmap.md](roadmap.md#known-gaps--not-in-100). It is not hidden behind the version number.
- After 1.0.0, breaking changes to a published entry point need a **major** changeset and, for the document or a component's props, a migration ([contributing.md](contributing.md)).

## Checking a release

After the publish job finishes:

```bash
npm view @next-buildr/core version dist.attestations   # the version and the provenance attestation
npm view @next-buildr/mcp version
```

```powershell
npm view '@next-buildr/core' version dist.attestations   # PowerShell: quote the @scope
npm view '@next-buildr/mcp' version
```

To try the packages in a scratch project, install them from npm as described in [getting-started.md](getting-started.md#using-buildr-in-your-own-nextjs--payload-project).
