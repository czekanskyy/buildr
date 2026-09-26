# Agent evals

A manual / nightly harness that lets a **real model** build pages through the `buildr-mcp` stdio server and scores what it saved with fixed rules. It answers "how well do agents use Buildr today?" and is tracked over time; nothing here is asserted in CI and nothing here blocks a merge. The deterministic, model-free proof that agents can build every MVP scenario is `apps/example-next-payload/e2e/mcp`.

Status of the checked-in report: **harness only, no live run.** The scorer is unit-tested with fixtures (`scorer.test.ts`, part of `pnpm test --filter @next-buildr/mcp`); no model has been run against it yet, so there are no scores to publish.

## What it does

For every brief in `briefs.ts` (for example "a landing page for a bakery with a hero, three features, pricing and a contact form"):

1. starts `buildr-mcp` over stdio and connects as an MCP client;
2. gets the `build-page` prompt (what a user's client would start with; it embeds the guide) and gives it, with the server's tools, to the model in a tool-use loop (`model.ts`);
3. reopens the saved page from the backend (the harness trusts what was stored, not what the agent says), reads `get_outline` and `validate`;
4. scores it with `scorer.ts`.

| Rule | Passes when |
|---|---|
| `saved` | the agent saved, and edited nothing after its last save |
| `validates` | `validate` reports no validation error |
| `a11y-clean` | `validate` reports no accessibility error |
| `uses-templates` | at least `minTemplates` of the templates that fit the brief are on the page or were inserted |
| `no-empty-slots` | no empty section/container/stack/grid/list/form, no blank text, no placeholder text ("Heading", "Lorem ipsum") |
| `both-locales` | every static text has a translation in each other language and `validate` lists no missing translation (left out of the score on a one-language site) |

The score of a brief is the share of applicable rules passed. Each run writes `evals/results/<time>.json` and appends a line to `evals/results/history.jsonl` (git-ignored) so you can plot it.

## Running it

Nothing runs without `ANTHROPIC_API_KEY`: the command prints that and exits successfully.

```bash
# macOS / Linux / Git Bash
# 1. The Anthropic SDK is not a dependency of @next-buildr/mcp (see below): install it locally, do not commit it.
pnpm add -D @anthropic-ai/sdk --filter @next-buildr/mcp --ignore-workspace-root-check

# 2. Against the playground (JSON files in a temp folder, one language, no key needed for the site).
ANTHROPIC_API_KEY=... pnpm --filter @next-buildr/mcp eval

# 3. Against the example app, in both languages (the meaningful run).
BUILDR_MCP=1 pnpm dev:example    # seed an agent user with an API key first (docs/mcp.md#quickstart)
ANTHROPIC_API_KEY=... BUILDR_EVAL_URL=http://localhost:3000 BUILDR_API_KEY=<agent key> \
  pnpm --filter @next-buildr/mcp eval --brief bakery-landing
```

Windows PowerShell does not accept inline `VAR=value command`; set the variables first. They stay set for the whole session, so remove them afterwards (see [Environment variables on Windows (PowerShell)](../../../docs/getting-started.md#environment-variables-on-windows-powershell)):

```powershell
# 2. Against the playground
$env:ANTHROPIC_API_KEY = '...'
pnpm --filter '@next-buildr/mcp' eval

# 3. Against the example app (start it in another window: $env:BUILDR_MCP = '1'; pnpm dev:example)
$env:BUILDR_EVAL_URL = 'http://localhost:3000'; $env:BUILDR_API_KEY = '<agent key>'
pnpm --filter '@next-buildr/mcp' eval --brief bakery-landing
Remove-Item Env:ANTHROPIC_API_KEY, Env:BUILDR_EVAL_URL, Env:BUILDR_API_KEY
```

| Variable | Meaning |
|---|---|
| `ANTHROPIC_API_KEY` | required to run a model |
| `BUILDR_EVAL_URL`, `BUILDR_API_KEY` | run against a site instead of the playground |
| `BUILDR_EVAL_LOCALES` | the site's languages, default `pl,en` |
| `BUILDR_EVAL_MODEL` | model id, default `claude-sonnet-5` |
| `BUILDR_EVAL_MAX_TURNS` | tool-use turns per brief, default 60 |

`--smoke` connects to the stdio server and lists its tools without any model or key. `--brief <id>` (repeatable) runs selected briefs.

## Why the SDK is not a dependency

`@next-buildr/mcp` is a server library: adding a model SDK to its `dependencies` would put a large, unrelated package (and its release cadence) in every consumer's tree for something only maintainers run, and the server never calls an LLM (ADR-024). So `model.ts` loads `@anthropic-ai/sdk` with a dynamic `import()` and declares the few types it uses itself; without the SDK the package still type-checks, tests and builds, and the harness tells you how to install it. `evals/` is outside `src/` and is not published (`files` lists only `dist` and `fixtures`).

## Nightly

Not wired into `.github/workflows/nightly.yml` yet: it needs an `ANTHROPIC_API_KEY` secret and a running example app with an agent user. When both exist, run the command from step 3 in a job with `continue-on-error: true` and upload `evals/results` as an artifact.

## Adding a brief or a rule

A brief is an entry in `briefs.ts` (prompt, the templates that fit it, how many a good page uses, the languages). A rule is a function in `scorer.ts` plus a case in `scorer.test.ts`; keep rules about the saved result, never about how the agent got there.
