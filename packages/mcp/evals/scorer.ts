// The rule-based scorer: pure functions from a `RunRecord` to a `Score`. No model, no I/O, so it is
// unit-tested with fixtures (scorer.test.ts). The rules are the phase-14 acceptance list: the page
// validates, is accessible, uses templates where they fit, has no empty slots and is complete in
// both languages. A score is tracked over time, never asserted in CI.
import type { OutlineEntry, RuleResult, RunRecord, Score } from './types.ts';

/** Components that only make sense with content inside. */
const CONTAINERS: ReadonlySet<string> = new Set([
  'buildr/section',
  'buildr/container',
  'buildr/stack',
  'buildr/grid',
  'buildr/list',
  'buildr/accordion',
  'buildr/form',
]);

/** Texts a component starts with: still there means the agent never wrote the real thing. */
const PLACEHOLDER = /^(lorem ipsum|text|heading|button|badge|label|item \d*|title)$|lorem ipsum/i;

const MUTATING: ReadonlySet<string> = new Set([
  'insert_nodes',
  'update_node',
  'move_nodes',
  'duplicate_nodes',
  'wrap_nodes',
  'unwrap_node',
  'remove_nodes',
  'apply_commands',
  'undo',
  'redo',
]);

export function walk(entry: OutlineEntry, visit: (entry: OutlineEntry) => void): void {
  visit(entry);
  for (const children of Object.values(entry.slots ?? {})) {
    for (const child of children) walk(child, visit);
  }
}

const pass = (rule: RuleResult['rule'], detail: string): RuleResult => ({
  rule,
  passed: true,
  detail,
});
const fail = (rule: RuleResult['rule'], detail: string): RuleResult => ({
  rule,
  passed: false,
  detail,
});
const codes = (issues: readonly { code: string }[]): string =>
  issues
    .slice(0, 3)
    .map((issue) => issue.code)
    .join(', ');

/** The last save succeeded and nothing was edited after it. */
function savedRule(run: RunRecord): RuleResult {
  let lastSave = -1;
  let lastEdit = -1;
  run.calls.forEach((call, index) => {
    if (call.isError) return;
    if (call.name === 'save') lastSave = index;
    if (MUTATING.has(call.name)) lastEdit = index;
  });
  if (lastSave < 0) return fail('saved', 'the agent never saved the draft');
  if (lastEdit > lastSave) return fail('saved', 'the agent edited the page after its last save');
  return pass('saved', 'the draft was saved after the last edit');
}

function validatesRule(run: RunRecord): RuleResult {
  const errors = run.issues.filter(
    (issue) => issue.source === 'validation' && issue.severity === 'error',
  );
  if (errors.length === 0) return pass('validates', 'no validation errors');
  return fail('validates', `${errors.length} validation error(s): ${codes(errors)}`);
}

function a11yRule(run: RunRecord): RuleResult {
  const found = run.issues.filter((issue) => issue.source === 'a11y');
  const errors = found.filter((issue) => issue.severity === 'error');
  const others = found.length - errors.length;
  if (errors.length === 0) {
    return pass('a11y-clean', `no accessibility errors (${others} other finding(s))`);
  }
  return fail('a11y-clean', `${errors.length} accessibility error(s): ${codes(errors)}`);
}

/** Templates count when they are on the page or were inserted (a template can be unlocked and edited). */
function templatesRule(run: RunRecord): RuleResult {
  const used = new Set<string>();
  walk(run.outline, (entry) => {
    if (entry.template !== undefined) used.add(entry.template);
  });
  for (const call of run.calls) {
    const template = call.args['template'];
    const inserts = call.name === 'insert_nodes' || call.name === 'create_document';
    if (!call.isError && inserts && typeof template === 'string') used.add(template);
  }
  const fitting = run.brief.templates.filter((id) => used.has(id));
  const detail = `${fitting.length} fitting template(s) used, ${run.brief.minTemplates} needed: ${fitting.join(', ') || 'none'}`;
  return fitting.length >= run.brief.minTemplates
    ? pass('uses-templates', detail)
    : fail('uses-templates', detail);
}

function emptySlotsRule(run: RunRecord): RuleResult {
  const problems: string[] = [];
  walk(run.outline, (entry) => {
    if (entry === run.outline) return;
    if (CONTAINERS.has(entry.type)) {
      const children = Object.values(entry.slots ?? {}).reduce((sum, list) => sum + list.length, 0);
      if (children === 0 && (entry.hiddenDescendants ?? 0) === 0) {
        problems.push(`${entry.type} ${entry.id} is empty`);
      }
    }
    if (entry.text !== undefined && entry.textKind === undefined) {
      if (entry.text.trim() === '') problems.push(`${entry.type} ${entry.id} has no text`);
      else if (PLACEHOLDER.test(entry.text.trim())) {
        problems.push(`${entry.type} ${entry.id} still says "${entry.text}"`);
      }
    }
  });
  const top = Object.values(run.outline.slots ?? {}).reduce((sum, list) => sum + list.length, 0);
  if (top === 0) problems.push('the page is empty');
  return problems.length === 0
    ? pass('no-empty-slots', 'every container has content and no text is a placeholder')
    : fail('no-empty-slots', `${problems.length} problem(s): ${problems.slice(0, 3).join('; ')}`);
}

function localesRule(run: RunRecord): RuleResult {
  const [defaultLocale, ...others] = run.brief.locales;
  if (run.siteLocales.length < 2 || others.length === 0) {
    return {
      rule: 'both-locales',
      passed: null,
      detail: 'the site has one language: not applicable',
    };
  }
  const missing = run.issues.filter((issue) => issue.code === 'missing-translation');
  const untranslated: string[] = [];
  walk(run.outline, (entry) => {
    if (entry.text === undefined || entry.textKind !== undefined) return;
    for (const locale of others) {
      if (locale !== defaultLocale && !(entry.translations ?? []).includes(locale)) {
        untranslated.push(`${entry.id} (${locale})`);
      }
    }
  });
  if (missing.length === 0 && untranslated.length === 0) {
    return pass('both-locales', `complete in ${run.brief.locales.join(' and ')}`);
  }
  const example = untranslated[0] ?? missing[0]?.nodeId ?? '?';
  return fail(
    'both-locales',
    `${Math.max(missing.length, untranslated.length)} text(s) not translated, e.g. ${example}`,
  );
}

export function scoreRun(run: RunRecord): Score {
  const rules = [
    savedRule(run),
    validatesRule(run),
    a11yRule(run),
    templatesRule(run),
    emptySlotsRule(run),
    localesRule(run),
  ];
  const applicable = rules.filter((rule) => rule.passed !== null);
  const passed = applicable.filter((rule) => rule.passed === true).length;
  return {
    brief: run.brief.id,
    rules,
    score: applicable.length === 0 ? 0 : passed / applicable.length,
  };
}
