import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Ajv } from 'ajv';
import addFormats from 'ajv-formats';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { analyzeDeclarations } from '../src/index.js';

// A library that publishes types but no manifest (metadata-and-analyzer.md §8): its manifest is
// written from what the declarations state, and nothing else. The command needs the build.
vi.setConfig({ testTimeout: 60_000 });

const repo = new URL('../../../', import.meta.url);
const path = (relative: string) => new URL(relative, repo).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const bin = path('packages/analyzer/dist/bin.js');
const validCem = new Ajv({ allErrors: true, strict: false });
addFormats.default(validCem);
const validate = validCem.compile(
  JSON.parse(
    readFileSync(path('node_modules/custom-elements-manifest/schema.json'), 'utf8'),
  ) as object,
);

const TOGGLE = `/**
 * A two-state switch.
 * @slot - The label.
 * @slot icon - An icon before the label.
 * @csspart track - The track.
 * @cssprop --toggle-color - The thumb's colour.
 * @cssstate on - While it is on.
 * @fires {CustomEvent<{ checked: boolean }>} toggle-change - When the state changes.
 * @attr checked - Whether it is on.
 * @attr {boolean} disabled - Whether it is disabled.
 */
export declare class ToggleSwitch extends HTMLElement {
  /** Whether it is on. */
  checked: boolean;
  disabled: boolean;
  readonly pressed: boolean;
  /** The visible label. */
  get label(): string;
  set label(value: string);
  get count(): number;
  static styles: string;
  private secret;
  protected guarded: number;
  _internal: number;
  /** Turn it on or off. */
  toggle(force?: boolean): void;
}
declare global {
  interface HTMLElementTagNameMap {
    'toggle-switch': ToggleSwitch;
  }
}
`;
const BADGE = `export declare class StatusBadge extends HTMLElement {
  tone: 'neutral' | 'info';
}
type Mystery = { x: number };
declare global {
  interface HTMLElementTagNameMap {
    'status-badge': StatusBadge;
    'mystery-thing': Mystery;
    'fancy-link': HTMLAnchorElement;
  }
}
`;

const temps: string[] = [];
afterAll(() => temps.forEach((dir) => rmSync(dir, { recursive: true, force: true })));
function library(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'oddkin-declarations-'));
  temps.push(dir);
  for (const [file, text] of Object.entries(files)) {
    mkdirSync(join(dir, file, '..'), { recursive: true });
    writeFileSync(join(dir, file), text);
  }
  return dir;
}
const LIBRARY = {
  'package.json': JSON.stringify({
    name: '@decl/widgets',
    version: '1.0.0',
    types: 'dist/index.d.ts',
  }),
  'dist/index.d.ts': "export * from './toggle.js';\nexport * from './badge.js';\n",
  'dist/toggle.d.ts': TOGGLE,
  'dist/badge.d.ts': BADGE,
};

describe('a manifest from published declarations', () => {
  it('states the tags, public members, and JSDoc facts the declarations hold, and nothing else', () => {
    const dir = library(LIBRARY);
    const { manifest, diagnostics } = analyzeDeclarations({
      declarations: [join(dir, 'dist/index.d.ts')],
      root: dir,
    });
    expect(validate(manifest), JSON.stringify(validate.errors)).toBe(true);
    expect(manifest.modules.map((m) => m.path)).toEqual(['dist/badge.js', 'dist/toggle.js']);
    const [badge, toggle] = manifest.modules;
    expect(badge?.declarations).toEqual([
      {
        kind: 'class',
        name: 'StatusBadge',
        tagName: 'status-badge',
        customElement: true,
        superclass: { name: 'HTMLElement' },
        members: [{ kind: 'field', name: 'tone', type: { text: "'neutral' | 'info'" } }],
      },
    ]);
    expect(toggle?.exports).toEqual([
      {
        kind: 'js',
        name: 'ToggleSwitch',
        declaration: { name: 'ToggleSwitch', module: 'dist/toggle.js' },
      },
    ]);
    expect(toggle?.declarations).toEqual([
      {
        kind: 'class',
        name: 'ToggleSwitch',
        tagName: 'toggle-switch',
        customElement: true,
        description: 'A two-state switch.',
        superclass: { name: 'HTMLElement' },
        // Statics, private and protected members, and _-prefixed names are not public API.
        members: [
          {
            kind: 'field',
            name: 'checked',
            type: { text: 'boolean' },
            description: 'Whether it is on.',
          },
          { kind: 'field', name: 'disabled', type: { text: 'boolean' } },
          { kind: 'field', name: 'pressed', type: { text: 'boolean' }, readonly: true },
          {
            kind: 'field',
            name: 'label',
            type: { text: 'string' },
            description: 'The visible label.',
          },
          { kind: 'field', name: 'count', type: { text: 'number' }, readonly: true },
          {
            kind: 'method',
            name: 'toggle',
            parameters: [{ name: 'force', type: { text: 'boolean' }, optional: true }],
            return: { type: { text: 'void' } },
            description: 'Turn it on or off.',
          },
        ],
        attributes: [
          { name: 'checked', description: 'Whether it is on.' },
          { name: 'disabled', type: { text: 'boolean' }, description: 'Whether it is disabled.' },
        ],
        events: [
          {
            name: 'toggle-change',
            type: { text: 'CustomEvent<{ checked: boolean }>' },
            description: 'When the state changes.',
          },
        ],
        slots: [
          { name: '', description: 'The label.' },
          { name: 'icon', description: 'An icon before the label.' },
        ],
        cssParts: [{ name: 'track', description: 'The track.' }],
        cssProperties: [{ name: '--toggle-color', description: "The thumb's colour." }],
        cssStates: [{ name: 'on', description: 'While it is on.' }],
      },
    ]);
    // What declarations cannot state is reported, never guessed: no registration, no defaults.
    expect(diagnostics.map((d) => [d.severity, d.code, d.source?.file])).toEqual([
      ['info', 'analyzer.declarations.unknown', 'dist/badge.d.ts'],
      ['warning', 'analyzer.declarations.unresolved', 'dist/badge.d.ts'],
      ['warning', 'analyzer.declarations.unresolved', 'dist/badge.d.ts'],
      ['info', 'analyzer.declarations.unknown', 'dist/toggle.d.ts'],
    ]);
    expect(diagnostics[0]?.message).toBe(
      '<status-badge> (StatusBadge): declarations do not state the module that registers it, its attributes, or its defaults, so the manifest leaves them out.',
    );
    expect(diagnostics[1]?.message).toContain('<mystery-thing> maps to Mystery');
    // A type the package does not declare, such as the DOM's own, is not its element.
    expect(diagnostics[2]?.message).toContain('<fancy-link> maps to HTMLAnchorElement');
    expect(diagnostics[3]?.message).toContain('the module that registers it, or its defaults');
    expect(manifest.modules.flatMap((m) => m.exports ?? []).map((e) => e.kind)).not.toContain(
      'custom-element-definition',
    );
  });

  it('says when no declaration names a tag', () => {
    const dir = library({ 'index.d.ts': 'export declare class Plain extends HTMLElement {}\n' });
    const { manifest, diagnostics } = analyzeDeclarations({
      declarations: [join(dir, 'index.d.ts')],
    });
    expect(manifest.modules).toEqual([]);
    expect(diagnostics.map((d) => [d.severity, d.code])).toEqual([
      ['warning', 'analyzer.declarations.noTags'],
    ]);
  });

  it('oddkin-analyze --declarations writes the manifest, relative to the working directory', () => {
    const dir = library(LIBRARY);
    const run = (...args: string[]) =>
      spawnSync(process.execPath, [bin, '--declarations', 'dist/index.d.ts', ...args], {
        cwd: dir,
        encoding: 'utf8',
      });
    const result = run('--out', 'out');
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('wrote out');
    expect(result.stderr).toContain('warning analyzer.declarations.unresolved');
    const written = JSON.parse(readFileSync(join(dir, 'out', 'custom-elements.json'), 'utf8'));
    expect(written).toEqual(
      analyzeDeclarations({ declarations: [join(dir, 'dist/index.d.ts')], root: dir }).manifest,
    );
    // A warning fails --strict; two inputs are a usage error.
    expect(run('--out', 'out', '--strict').status).toBe(1);
    expect(run('--manifest', 'custom-elements.json').status).toBe(2);
  });
});
