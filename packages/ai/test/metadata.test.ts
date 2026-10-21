import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Ajv } from 'ajv';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';

// Published metadata and schemas produced by `npm run build` (build-metadata, build-ai-schemas).
const pkg = new URL('../', import.meta.url);
const repo = new URL('../../../', import.meta.url);
const json = (url: URL) => JSON.parse(readFileSync(url, 'utf8')) as Record<string, any>;
const manifest = json(new URL('package.json', pkg));
const cem = json(new URL('custom-elements.json', pkg));
const metadata = json(new URL('oddkin.metadata.json', pkg));
const declarations = (cem['modules'] as { declarations?: Record<string, any>[] }[]).flatMap(
  (m) => m.declarations ?? [],
);
const declaration = (tag: string) => declarations.find((d) => d['tagName'] === tag)!;

const TAGS = [
  'action-approval',
  'activity',
  'ai-label',
  'artifact',
  'change-review',
  'checkpoint',
  'citation',
  'context-picker',
  'conversation',
  'inline-assist',
  'message',
  'message-branch',
  'model-select',
  'prompt-input',
  'question',
  'response',
  'response-feedback',
  'sources',
  'suggestions',
  'task-plan',
  'tool-call',
  'transcript',
  'usage-meter',
  'voice-input',
].map((name) => `odd-${name}`);

// Schema compilation and the schema-check subprocess can exceed 5 s while browser projects run.
describe('@oddkin/ai published metadata', { timeout: 30_000 }, () => {
  it('validates against the pinned CEM schema and oddkin-metadata.v1 without diagnostics', () => {
    const validateCem = new Ajv({ strict: false }).compile(
      json(new URL('node_modules/custom-elements-manifest/schema.json', repo)),
    );
    const ajv = new Ajv2020({ strict: true, strictRequired: false, allowUnionTypes: true });
    addFormats.default(ajv);
    const validateOddkin = ajv.compile(
      json(new URL('docs/schemas/oddkin-metadata.v1.schema.json', repo)),
    );
    expect(validateCem(cem), JSON.stringify(validateCem.errors)).toBe(true);
    expect(validateOddkin(metadata), JSON.stringify(validateOddkin.errors)).toBe(true);
    expect(metadata['diagnostics']).toEqual([]);
  });

  it('documents every element with its registration export and selection guidance', () => {
    expect(Object.keys(metadata['components']).sort()).toEqual(TAGS.map((t) => `component:${t}`));
    for (const tag of TAGS) {
      const component = metadata['components'][`component:${tag}`];
      expect(component.registration).toBe(`@oddkin/ai/define/${tag.slice(4)}`);
      expect(manifest['exports'][`./define/${tag.slice(4)}`], tag).toBeDefined();
      expect(manifest['exports'][`./${tag.slice(4)}`], tag).toBeDefined();
      expect(existsSync(new URL(component.cem.module, pkg)), tag).toBe(true);
      expect(component.useFor?.length, `${tag} @useFor`).toBeGreaterThan(0);
      expect(component.notFor?.length, `${tag} @notFor`).toBeGreaterThan(0);
      expect(component.a11y?.length, `${tag} @a11y`).toBeGreaterThan(0);
      expect(component.category).toBe('category:ai');
    }
    expect(metadata['categories']).toEqual({ 'category:ai': { label: 'AI' } });
  });

  it('traces style mappings through the shared sheets @oddkin/components publishes', () => {
    const host = (
      metadata['components']['component:odd-ai-label'].styleMappings as Record<string, string>[]
    ).filter((m) => !m['part'] && m['cssProperty'] === 'font-size');
    // aiElementStyles sets font.size.md; the label's own sheet, loaded later, wins.
    expect(host.map((m) => m['token'])).toEqual(['font.size.xs']);
    const padding = (
      metadata['components']['component:odd-suggestions'].styleMappings as Record<string, string>[]
    )
      .filter((m) => m['cssProperty'] === 'padding-inline')
      .map((m) => `${m['part']} -> ${m['token']}`);
    // `button` styles both buttons; `.send` outranks it on the send button.
    expect(padding).toEqual(['suggestion -> space.sm', 'send -> space.xs']);
  });

  it('publishes typed intent events with their request semantics', () => {
    const events = (tag: string) =>
      (declaration(tag)['events'] as {
        name: string;
        type: { text: string };
        description: string;
      }[]) ?? [];
    const approval = events('odd-action-approval').find((e) => e.name === 'approval-decide')!;
    expect(approval.type.text).toBe('CustomEvent<ApprovalDecideDetail>');
    expect(approval.description).toMatch(/Pending until the record changes/);
    expect(events('odd-prompt-input').map((e) => e.name)).toEqual(
      expect.arrayContaining([
        'prompt-submit',
        'prompt-stop',
        'attachment-add',
        'attachment-remove',
      ]),
    );
    expect(events('odd-change-review').map((e) => e.name)).toEqual(
      expect.arrayContaining(['change-accept', 'change-reject', 'change-undo']),
    );
    // Records travel through properties, never reflected attributes.
    const attributes =
      (declaration('odd-conversation')['attributes'] as { name: string }[] | undefined)?.map(
        (a) => a.name,
      ) ?? [];
    expect(attributes).not.toContain('state');
    expect(attributes).not.toContain('source');
  });

  it('lists every record model, and the generated JSON Schemas are current', () => {
    expect(Object.keys(metadata['models']).sort()).toEqual(
      [
        'approval',
        'artifact',
        'checkpoint',
        'context-item',
        'conversation',
        'feedback',
        'message',
        'model-option',
        'plan',
        'question',
        'suggestion',
        'tool-call',
        'transcript-segment',
        'usage',
      ].map((m) => `model:oddkin.ai.${m}`),
    );
    expect(manifest['exports']['./schemas/*.json']).toBe('./schemas/*.json');
    const script = fileURLToPath(new URL('scripts/build-ai-schemas.mjs', repo));
    expect(() =>
      execFileSync(process.execPath, [script, '--check'], {
        cwd: fileURLToPath(repo),
        stdio: 'pipe',
      }),
    ).not.toThrow();
  });
});
