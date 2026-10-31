import { readdirSync, readFileSync } from 'node:fs';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';
import { validateComposition } from '../../packages/components/src/composition/validate.js';

// The composition document a coding agent wrote from the packaged kit alone (README.md here),
// checked the two ways a host can check one: the published JSON Schemas, and validateComposition.
const repo = new URL('../../', import.meta.url);
const schemaDir = new URL('packages/components/schemas/composition/', repo);
const ajv = new Ajv2020({ strict: false });
addFormats.default(ajv);
ajv.addSchema(
  JSON.parse(
    readFileSync(new URL('packages/components/schemas/oddkin.navigation.v1.json', repo), 'utf8'),
  ),
);
for (const file of readdirSync(schemaDir))
  ajv.addSchema(JSON.parse(readFileSync(new URL(file, schemaDir), 'utf8')));
const schema = ajv.getSchema('https://oddkin.dev/schemas/composition/composition.v1.json')!;

interface Node {
  element: string;
  children?: (Node | string)[];
  properties?: Record<string, unknown>;
}
const written = JSON.parse(
  readFileSync(new URL('settings-app/settings.composition.json', import.meta.url), 'utf8'),
) as { root: Node[] };

describe("the agent's composition document", () => {
  it('is valid by the published schemas and by validateComposition', () => {
    expect(schema(written), JSON.stringify(schema.errors)).toBe(true);
    expect(validateComposition(written)).toEqual({ ok: true, diagnostics: [] });
  });

  it('its first draft, with the select options as data, was refused both ways', () => {
    // The agent's report: the first draft set odd-select's options under "properties".
    const draft = structuredClone(written);
    const select = draft.root[0]!.children!.find(
      (child): child is Node => typeof child !== 'string' && child.element === 'odd-select',
    )!;
    select.properties = {
      options: [
        { value: 'daily', label: 'Daily' },
        { value: 'weekly', label: 'Weekly' },
        { value: 'monthly', label: 'Monthly' },
      ],
    };
    const result = validateComposition(draft);
    expect(result.ok).toBe(false);
    expect(result.diagnostics.map((d) => [d.code, d.path])).toEqual([
      ['composition.property.notPortable', '/root/0/children/3/properties/options'],
    ]);
    expect(schema(draft)).toBe(false);
  });
});
