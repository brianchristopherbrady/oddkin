/**
 * `@mote/core/model` — the unbranded model builder: one definition for types (`Infer`),
 * runtime validation of external data, migrations, and (via `./model/schema`) JSON Schema.
 * DOM-free. Contract: docs/architecture/data-composition.md §5.
 */
import { uniqueIds } from './model.js';
import { m as nodes } from './nodes.js';

/** Schema builder plus rules (`m.uniqueIds`). */
export const m = { ...nodes, uniqueIds };

export { defineModel, uniqueIds } from './model.js';
export type {
  Migration,
  Model,
  ModelDefinition,
  ModelDiagnostic,
  ModelRule,
  ValidationResult,
} from './model.js';
export type {
  ArrayNode,
  BooleanNode,
  EnumNode,
  Infer,
  InferNode,
  Node,
  NumberNode,
  ObjectNode,
  OptionalNode,
  RecursiveNode,
  SelfNode,
  Shape,
  StringNode,
  UnionNode,
} from './nodes.js';
