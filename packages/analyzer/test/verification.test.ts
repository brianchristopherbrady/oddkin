import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { attachVerification, type ResultRecord } from '../src/index.js';

const schema = JSON.parse(
  await readFile(
    new URL('../../../docs/schemas/oddkin-metadata.v1.schema.json', import.meta.url),
    'utf8',
  ),
) as object;
const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
  strictRequired: false,
  allowUnionTypes: true,
});
addFormats.default(ajv);
const validate = ajv.compile(schema);

const hash = (c: string) => `sha256-${c.repeat(64)}`;
const inputs = { manifest: hash('a'), sources: hash('b') };
const options = { inputs, browsers: ['chromium', 'firefox', 'webkit'], test: 'test/contract.ts' };
const metadata = {
  schema: 'https://oddkin.dev/schemas/oddkin-metadata/v1.json',
  oddkinVersion: '0.0.0',
  library: { name: '@acme/ui', version: '1.0.0', packages: [] },
  components: {
    'component:acme-button': {
      tag: 'acme-button',
      cem: { module: 'dist/button.js', name: 'AcmeButton' },
      registration: '@acme/ui/define/button',
    },
  },
  diagnostics: [],
};
const CASES = ['property:acme-button#size/default', 'slot:acme-button#default/rendered'];
function record(
  browser: string,
  overrides: {
    configuration?: Record<string, string>;
    states?: ResultRecord['results'][number]['state'][];
  } = {},
): ResultRecord {
  return {
    suite: { id: 'acme.contract', version: '1.0.0' },
    implementation: { tag: 'acme-button', package: '@acme/ui@1.0.0' },
    configuration: { browser, browserVersion: '1.0', ...inputs, ...overrides.configuration },
    date: `2026-10-18T00:00:0${options.browsers.indexOf(browser)}.000Z`,
    results: CASES.map((id, i) => ({ case: id, state: overrides.states?.[i] ?? 'passed' })),
  };
}
const all = () => options.browsers.map((b) => record(b));
const verification = (result: { metadata: Record<string, unknown> }) =>
  (result.metadata['components'] as Record<string, { verification?: unknown[] }>)[
    'component:acme-button'
  ]?.verification;

describe('attachVerification', () => {
  it('attaches facts that passed in every browser, with the conditions they ran under', () => {
    const result = attachVerification(metadata, all(), options);
    expect(verification(result)).toEqual([
      {
        suite: 'acme.contract@1.0.0',
        provenance: 'verified',
        source: {
          test: 'test/contract.ts',
          run: expect.stringMatching(/^run-[0-9a-f]{8}$/),
          date: '2026-10-18T00:00:02.000Z',
        },
        conditions: {
          browsers: options.browsers.map((name) => ({ name, version: '1.0' })),
          package: '@acme/ui@1.0.0',
          inputs,
        },
        facts: CASES,
      },
    ]);
    expect(result.report.verified).toEqual({ 'acme-button': 2 });
    expect(validate(result.metadata), JSON.stringify(validate.errors)).toBe(true);
  });

  it('ignores records made against other inputs, so a stale run never verifies new metadata', () => {
    const records = all();
    records[1] = record('firefox', { configuration: { sources: hash('c') } });
    const result = attachVerification(metadata, records, options);
    expect(verification(result)).toBeUndefined();
    expect(result.report.stale).toEqual([{ tag: 'acme-button', browser: 'firefox' }]);
    expect(result.report.missing).toEqual([{ tag: 'acme-button', browser: 'firefox' }]);
  });

  it('verifies nothing that failed or did not run in any browser', () => {
    const records = all();
    records[2] = record('webkit', { states: ['failed', 'passed'] });
    records[0] = record('chromium', { states: ['passed', 'not-executed'] });
    const result = attachVerification(metadata, records, options);
    expect(verification(result)).toBeUndefined();
    expect(result.report.failed.map((f) => [f.browser, f.case])).toEqual([['webkit', CASES[0]]]);
    expect(result.report.notExecuted).toEqual([{ tag: 'acme-button', case: CASES[1] }]);
  });

  it('replaces earlier evidence with exactly what the current records show', () => {
    const before = attachVerification(metadata, all(), options).metadata;
    const after = attachVerification(before, [], options);
    expect(verification(after)).toBeUndefined();
    expect(after.report.missing).toEqual([]);
  });

  it('reports required tags without any current evidence', () => {
    const result = attachVerification(metadata, [], { ...options, require: ['acme-button'] });
    expect(result.report.missing).toEqual(
      options.browsers.map((browser) => ({ tag: 'acme-button', browser })),
    );
  });

  it('uses the latest record per browser', () => {
    const older = record('webkit', { states: ['failed', 'passed'] });
    const newer = { ...record('webkit'), date: '2026-10-19T00:00:00.000Z' };
    const result = attachVerification(metadata, [...all().slice(0, 2), older, newer], options);
    expect((verification(result)?.[0] as { facts: string[] }).facts).toEqual(CASES);
  });
});
