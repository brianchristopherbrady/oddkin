import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';

// Draft schemas live in docs/schemas until their owning packages exist (M3/M5).
const dir = fileURLToPath(new URL('../../docs/schemas/', import.meta.url));
const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
  strictRequired: false,
  allowUnionTypes: true,
});
addFormats.default(ajv);

const read = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8'));
const schemaFiles = readdirSync(dir).filter((file) => file.endsWith('.v1.schema.json'));
const validators = new Map(
  schemaFiles.map((file) => [
    file.replace('.v1.schema.json', ''),
    ajv.compile(read(join(dir, file)) as object),
  ]),
);
const examples = readdirSync(join(dir, 'examples')).filter((file) => file.endsWith('.json'));

describe('draft JSON Schemas', () => {
  it('compiles every schema under Ajv 2020 strict mode', () => {
    expect(validators.size).toBe(schemaFiles.length);
    expect(schemaFiles.length).toBeGreaterThanOrEqual(8);
  });

  it.each(examples)('%s gives the expected result', (file) => {
    const validate = validators.get(file.split('.')[0] ?? '');
    expect(validate, `no schema for ${file}`).toBeDefined();
    const valid = validate!(read(join(dir, 'examples', file)));
    expect(valid, JSON.stringify(validate!.errors)).toBe(file.includes('.valid.'));
  });
});
