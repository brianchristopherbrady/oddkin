/**
 * `@oddkin/core/model/schema` — JSON Schema (draft 2020-12) for a model's portable subset.
 * Tooling only; component bundles never import it. Rules that JSON Schema cannot express
 * (e.g. unique ids across a tree) are listed in `$comment`.
 */
import type { Model } from './model.js';
import type { Node, RecursiveNode } from './nodes.js';

export type JSONSchema = Readonly<Record<string, unknown>>;

const SCRIPT_URL_GUARD =
  '^(?![\\u0000-\\u0020]*(?:[jJ]\\s*[aA]\\s*[vV]\\s*[aA]\\s*[sS]\\s*[cC]\\s*[rR]\\s*[iI]\\s*[pP]\\s*[tT]|[vV]\\s*[bB]\\s*[sS]\\s*[cC]\\s*[rR]\\s*[iI]\\s*[pP]\\s*[tT])\\s*:)';

export interface SchemaOptions {
  /** `$id` for the document. Default `https://oddkin.dev/schemas/models/<name>.v<version>.json`. */
  readonly id?: string;
}

export function toJSONSchema(model: Model, options: SchemaOptions = {}): JSONSchema {
  const defs = new Map<RecursiveNode, { name: string; schema?: JSONSchema }>();
  const defName = (node: RecursiveNode) => {
    let entry = defs.get(node);
    if (!entry) {
      const base = (node.name ?? model.name)
        .replace(/[^A-Za-z0-9]+(.)?/g, (_, c: string | undefined) => (c ? c.toUpperCase() : ''))
        .replace(/^./, (c) => c.toUpperCase());
      let name = base;
      for (let i = 2; [...defs.values()].some((d) => d.name === name); i++) name = `${base}${i}`;
      entry = { name };
      defs.set(node, entry);
      entry.schema = emit(node.inner);
    }
    return entry.name;
  };

  const withDescription = (node: Node, schema: Record<string, unknown>) =>
    node.description ? { description: node.description, ...schema } : schema;

  function emit(node: Node): JSONSchema {
    switch (node.kind) {
      case 'string': {
        const schema: Record<string, unknown> = { type: 'string' };
        if (node.format === 'label') Object.assign(schema, { minLength: 1, pattern: '\\S' });
        if (node.format === 'id') schema['minLength'] = 1;
        if (node.format === 'url')
          Object.assign(schema, { format: 'uri-reference', pattern: SCRIPT_URL_GUARD });
        if (node.format === 'actionRef')
          schema['pattern'] = '^[a-z][a-zA-Z0-9-]*(?:\\.[a-zA-Z0-9-]+)*$';
        if (node.minLength !== undefined) schema['minLength'] = node.minLength;
        if (node.maxLength !== undefined) schema['maxLength'] = node.maxLength;
        if (node.pattern !== undefined) schema['pattern'] = node.pattern;
        return withDescription(node, schema);
      }
      case 'number':
        return withDescription(node, {
          type: node.integer ? 'integer' : 'number',
          ...(node.minimum !== undefined ? { minimum: node.minimum } : {}),
          ...(node.maximum !== undefined ? { maximum: node.maximum } : {}),
        });
      case 'boolean':
        return withDescription(node, { type: 'boolean' });
      case 'enum':
        return withDescription(node, { enum: [...node.values] });
      case 'optional':
        return emit(node.inner);
      case 'array':
        return withDescription(node, {
          type: 'array',
          items: emit(node.items),
          ...(node.minItems !== undefined ? { minItems: node.minItems } : {}),
          ...(node.maxItems !== undefined ? { maxItems: node.maxItems } : {}),
        });
      case 'object':
        return withDescription(node, objectSchema(node.shape as Record<string, Node>));
      case 'union':
        return withDescription(node, {
          oneOf: Object.entries(
            node.variants as Record<string, { shape: Record<string, Node> }>,
          ).map(([tag, variant]) => objectSchema(variant.shape, [node.discriminator, tag])),
        });
      case 'json':
        return withDescription(node, {});
      case 'self':
        return { $ref: `#/$defs/${defName(node.target())}` };
      case 'recursive':
        return { $ref: `#/$defs/${defName(node)}` };
    }
  }

  function objectSchema(
    shape: Record<string, Node>,
    tag?: [string, string],
  ): Record<string, unknown> {
    const properties: Record<string, unknown> = tag ? { [tag[0]]: { const: tag[1] } } : {};
    const required: string[] = tag ? [tag[0]] : [];
    for (const [key, child] of Object.entries(shape)) {
      properties[key] = emit(child);
      if (child.kind !== 'optional') required.push(key);
    }
    return { type: 'object', properties, ...(required.length ? { required } : {}) };
  }

  const root = emit(model.schema);
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: options.id ?? `https://oddkin.dev/schemas/models/${model.name}.v${model.version}.json`,
    title: model.name,
    ...(model.description ? { description: model.description } : {}),
    ...(model.rules.length
      ? {
          $comment: `Also enforced by validate(), not expressible here: ${model.rules.map((r) => r.description).join(', ')}.`,
        }
      : {}),
    ...root,
    ...(defs.size
      ? { $defs: Object.fromEntries([...defs.values()].map((d) => [d.name, d.schema])) }
      : {}),
  };
}
