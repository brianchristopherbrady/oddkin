// Generate @oddkin/analyzer's browser-safe metadata types (`@oddkin/analyzer/metadata/types`) from
// the canonical schema, docs/schemas/oddkin-metadata.v1.schema.json (P1.6; packages.md): one module
// of types that imports nothing, a type per `$defs` entry and `OddkinMetadata` for the document.
// It reads the subset of JSON Schema the canonical schema uses and fails on any other keyword.
// `--check` fails when packages/analyzer/src/metadata-types.ts is stale (also tests/schemas).
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as prettier from 'prettier';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
export const METADATA_SCHEMA_FILE = 'docs/schemas/oddkin-metadata.v1.schema.json';
export const METADATA_TYPES_FILE = 'packages/analyzer/src/metadata-types.ts';

/** Keywords that constrain values but not their TypeScript shape. */
const SHAPELESS = new Set([
  '$id',
  '$schema',
  '$comment',
  'title',
  'description',
  'examples',
  'default',
  'pattern',
  'format',
  'minimum',
  'maximum',
  'minItems',
  'maxItems',
  'minLength',
  'maxLength',
  'uniqueItems',
  // Keys are strings; their pattern is not a type.
  'propertyNames',
  // A fact's `known: false` forbids `value`; the types keep both optional.
  'if',
  'then',
  'else',
  'not',
]);
const SHAPED = new Set([
  '$ref',
  '$defs',
  'type',
  'enum',
  'const',
  'allOf',
  'oneOf',
  'anyOf',
  'properties',
  'required',
  'additionalProperties',
  'items',
]);

const pascal = (name) => `${name[0].toUpperCase()}${name.slice(1)}`;
const key = (name) => (/^[A-Za-z_$][\w$]*$/.test(name) ? name : JSON.stringify(name));
const comment = (node) =>
  typeof node?.description === 'string'
    ? `/** ${node.description.replace(/\*\//g, '*\\/').replace(/\s+/g, ' ')} */\n`
    : '';
/** Whether a type's text has `|` or `&` outside comments, braces, brackets, and string literals. */
function compound(text) {
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (const char of text.replace(/\/\*\*[\s\S]*?\*\//g, '')) {
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
    } else if (char === '"') quoted = true;
    else if ('{<(['.includes(char)) depth++;
    else if ('}>)]'.includes(char)) depth--;
    else if (depth === 0 && (char === '|' || char === '&')) return true;
  }
  return false;
}
const group = (text) => (compound(text) ? `(${text})` : text);

/** The TypeScript text of one JSON Schema node. */
function typeOf(node, path) {
  if (node === true || node === undefined) return 'unknown';
  if (node === false) return 'never';
  for (const name of Object.keys(node))
    if (!SHAPELESS.has(name) && !SHAPED.has(name))
      throw new Error(`${path}: the generator does not read "${name}"`);
  const parts = [];
  if (node.$ref) {
    const match = /^#\/\$defs\/([\w-]+)$/.exec(node.$ref);
    if (!match) throw new Error(`${path}: only local $defs references are read (${node.$ref})`);
    parts.push(pascal(match[1]));
  }
  for (const [i, member] of (node.allOf ?? []).entries())
    parts.push(typeOf(member, `${path}/allOf/${i}`));
  for (const keyword of ['oneOf', 'anyOf'])
    if (node[keyword])
      parts.push(
        node[keyword].map((m, i) => group(typeOf(m, `${path}/${keyword}/${i}`))).join(' | '),
      );
  if ('const' in node) parts.push(JSON.stringify(node.const));
  else if (node.enum) parts.push(node.enum.map((v) => JSON.stringify(v)).join(' | '));
  else if (
    node.type !== undefined ||
    node.properties ||
    node.items !== undefined ||
    (node.additionalProperties !== undefined && !parts.length)
  )
    parts.push(shaped(node, path));
  if (!parts.length) return 'unknown';
  return parts.length === 1 ? parts[0] : parts.map(group).join(' & ');
}

/** The type of a node by its `type` keyword (or the keywords that imply one). */
function shaped(node, path) {
  const types = Array.isArray(node.type)
    ? node.type
    : [node.type ?? (node.items !== undefined ? 'array' : 'object')];
  return types
    .map((type) => {
      switch (type) {
        case 'string':
          return 'string';
        case 'integer':
        case 'number':
          return 'number';
        case 'boolean':
          return 'boolean';
        case 'null':
          return 'null';
        case 'array':
          return `readonly ${group(typeOf(node.items, `${path}/items`))}[]`;
        case 'object':
          return object(node, path);
        default:
          throw new Error(`${path}: unknown type "${type}"`);
      }
    })
    .join(' | ');
}

function object(node, path) {
  const properties = Object.entries(node.properties ?? {});
  const extra = node.additionalProperties;
  if (!properties.length)
    return extra === false
      ? 'Readonly<Record<string, never>>'
      : `Readonly<Record<string, ${typeOf(extra === undefined ? true : extra, `${path}/additionalProperties`)}>>`;
  if (extra !== undefined && extra !== false && extra !== true)
    throw new Error(`${path}: properties beside an additionalProperties schema are not read`);
  const required = new Set(node.required ?? []);
  const members = properties.map(
    ([name, value]) =>
      `${comment(value)}readonly ${key(name)}${required.has(name) ? '' : '?'}: ${typeOf(value, `${path}/properties/${name}`)};`,
  );
  return `{\n${members.join('\n')}\n}`;
}

/** The module text, formatted as the repository formats TypeScript. */
export async function generateMetadataTypes(schema) {
  const declarations = [];
  const declare = (name, node, path) => {
    const text = typeOf(node, path);
    // One object shape is an interface; unions, intersections, and the rest are type aliases.
    declarations.push(
      text.startsWith('{') && !compound(text)
        ? `${comment(node)}export interface ${name} ${text}`
        : `${comment(node)}export type ${name} = ${text};`,
    );
  };
  const { $defs = {}, ...document } = schema;
  declare('OddkinMetadata', document, '#');
  for (const [name, node] of Object.entries($defs)) declare(pascal(name), node, `#/$defs/${name}`);
  const text = [
    `// Generated by scripts/build-metadata-types.mjs from ${METADATA_SCHEMA_FILE}: do not edit.`,
    '// Types only, importing nothing: browser code imports them with `import type` from',
    '// `@oddkin/analyzer/metadata/types` (packages.md, dependency rules; docs/schemas/README.md).',
    '',
    `/** The \`$id\` of the schema these types follow. */`,
    `export type OddkinMetadataSchema = ${JSON.stringify(schema.$id)};`,
    '',
    ...declarations.map((declaration) => `${declaration}\n`),
  ].join('\n');
  const target = join(root, METADATA_TYPES_FILE);
  const options = (await prettier.resolveConfig(target)) ?? {};
  return prettier.format(text, { ...options, filepath: target });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const schema = JSON.parse(readFileSync(join(root, METADATA_SCHEMA_FILE), 'utf8'));
  const text = await generateMetadataTypes(schema);
  const target = join(root, METADATA_TYPES_FILE);
  if (process.argv.includes('--check')) {
    let current;
    try {
      current = readFileSync(target, 'utf8');
    } catch {
      current = undefined;
    }
    if (current !== text) {
      console.error(
        `${METADATA_TYPES_FILE} is stale: run node scripts/build-metadata-types.mjs after editing ${METADATA_SCHEMA_FILE}.`,
      );
      process.exit(1);
    }
    console.log(`Metadata types are current (${METADATA_SCHEMA_FILE}).`);
  } else {
    writeFileSync(target, text);
    console.log(`Wrote ${METADATA_TYPES_FILE} from ${METADATA_SCHEMA_FILE}.`);
  }
}
