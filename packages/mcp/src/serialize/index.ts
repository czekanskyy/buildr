// Agent-facing serialization (PB-135, docs/mcp.md#serialization): representations a language model
// reads and writes reliably, and errors it can act on. Pure functions over core types; the tool
// layer (PB-136 - PB-138) calls these and adds no formatting of its own.

export {
  type ComponentDescription,
  type ComponentPlacementStep,
  describeComponent,
  findPlacement,
  formatComponentDescription,
  type PropDescription,
  type SlotDescription,
  type UnknownComponentError,
} from './component.ts';
export {
  type AgentError,
  COMMAND_EXPLAINERS,
  type ExplainContext,
  explainCommandError,
  explainReason,
  explainSessionError,
  formatAgentError,
  REASON_EXPLAINERS,
} from './errors.ts';
export {
  describeNode,
  formatNodeDetail,
  type NodeDetail,
  type NodeDetailError,
} from './node.ts';
export {
  buildOutline,
  DEFAULT_OUTLINE_DEPTH,
  DEFAULT_OUTLINE_MAX_CHARS,
  DEFAULT_OUTLINE_MAX_NODES,
  type OutlineEntry,
  type OutlineError,
  type OutlineJson,
  type OutlineOptions,
  outlineToJson,
  renderOutline,
} from './outline.ts';
export { acceptsChild, allowedChildTypes, allowedParents, expandMatchers } from './structure.ts';
export {
  createTreeInputSchema,
  MAX_TREE_DEPTH,
  MAX_TREE_NODES,
  parseTreeInput,
  TREE_NODE_REF,
  type TreeInput,
  type TreeInputError,
  type TreeInputIssue,
  treeInputDefs,
  treeInputJsonSchema,
} from './tree-input.ts';
