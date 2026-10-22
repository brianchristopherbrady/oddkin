import { describe, expect, it } from 'vitest';
import { checkDeclaration, checkManifest } from '../../scripts/vocabulary.mjs';

const codes = (declaration: object) =>
  checkDeclaration({ tagName: 'odd-x', ...declaration }).map((f) => `${f.code} ${f.name}`);
const attribute = (name: string, type?: string, extra: object = {}) => ({
  attributes: [{ name, ...(type ? { type: { text: type } } : {}), ...extra }],
});

describe('API vocabulary check (ADR 0045)', () => {
  it('accepts controlled names with their types and values', () => {
    expect(codes(attribute('appearance', '"primary" | "secondary" | "ghost"'))).toEqual([]);
    expect(codes(attribute('appearance', '"outlined" | "filled" | "elevated"'))).toEqual([]);
    expect(codes(attribute('tone', '"neutral" | "danger"'))).toEqual([]);
    expect(codes(attribute('size', '"sm" | "md" | "lg"'))).toEqual([]);
    expect(codes(attribute('label', 'string'))).toEqual([]);
    expect(codes(attribute('loading', 'boolean', { default: 'false' }))).toEqual([]);
    expect(codes(attribute('enter-behavior', '"send" | "newline"'))).toEqual([]);
  });

  it('reports replaced names with the canonical one', () => {
    const findings = checkDeclaration({ tagName: 'odd-x', ...attribute('busy', 'boolean') });
    expect(findings).toEqual([
      {
        code: 'vocabulary.synonym',
        tag: 'odd-x',
        name: 'busy',
        message: 'use loading instead of "busy"',
      },
    ]);
    expect(codes(attribute('variant', '"outlined"'))).toEqual(['vocabulary.synonym variant']);
    expect(codes(attribute('heading', 'string'))).toEqual(['vocabulary.synonym heading']);
  });

  it('reports values outside the set, mixed families, and wrong types', () => {
    expect(codes(attribute('size', '"sm" | "xl"'))).toEqual(['vocabulary.values size']);
    expect(codes(attribute('appearance', '"primary" | "outlined"'))).toEqual([
      'vocabulary.values appearance',
    ]);
    expect(codes(attribute('status', '"idle" | "ready"'))).toEqual(['vocabulary.values status']);
    expect(codes(attribute('announce', 'boolean'))).toEqual(['vocabulary.type announce']);
    expect(codes(attribute('loading', 'string'))).toEqual(['vocabulary.type loading']);
    expect(codes(attribute('label', '"a" | "b"'))).toEqual(['vocabulary.type label']);
  });

  it('reports booleans that default to true', () => {
    expect(codes(attribute('copyable', 'boolean', { default: 'true' }))).toEqual([
      'vocabulary.boolean.default copyable',
    ]);
  });

  it('checks property-only members, keeping native member names', () => {
    const members = (list: object[]) => ({
      members: list.map((m) => ({ kind: 'field', ...m })),
    });
    expect(
      codes(
        members([
          { name: 'toolRenderer', type: { text: '(tool) => unknown' } },
          { name: 'source', type: { text: 'ExternalSource<State>' } },
          { name: 'current', readonly: true, type: { text: 'State | undefined' } },
          { name: 'announcements', type: { text: 'string' } },
        ]),
      ),
    ).toEqual([
      'vocabulary.synonym toolRenderer',
      'vocabulary.synonym source',
      'vocabulary.synonym current',
      'vocabulary.synonym announcements',
    ]);
    expect(
      codes(
        members([
          { name: 'validationMessage', readonly: true, type: { text: 'string' } },
          { name: 'source', type: { text: '{ type: "source"; id: string }' } },
          { name: 'renderers', type: { text: 'Record<string, Renderer>' } },
          { name: 'secret', privacy: 'private' },
          { name: '_internal' },
        ]),
      ),
    ).toEqual([]);
  });

  it('reports replaced slot names and unprefixed custom events', () => {
    expect(codes({ slots: [{ name: 'prefix' }, { name: 'start' }, { name: '' }] })).toEqual([
      'vocabulary.synonym slot:prefix',
    ]);
    expect(
      codes({
        events: [
          { name: 'prompt-submit' },
          { name: 'odd-action' },
          { name: 'change' },
          { name: 'ai-announce' },
        ],
      }),
    ).toEqual([
      'vocabulary.event.name event:prompt-submit',
      'vocabulary.event.name event:ai-announce',
    ]);
  });

  it('checks every custom element in a manifest and skips other declarations', () => {
    const manifest = {
      modules: [
        {
          declarations: [
            { kind: 'class', name: 'Helper', attributes: [{ name: 'busy' }] },
            { kind: 'class', tagName: 'odd-a', ...attribute('busy', 'boolean') },
          ],
        },
      ],
    };
    expect(checkManifest(manifest).map((f) => f.tag)).toEqual(['odd-a']);
  });
});
