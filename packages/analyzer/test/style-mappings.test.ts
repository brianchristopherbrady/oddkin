import { describe, expect, it } from 'vitest';
import { selectionOf, styleMappingsOf, type PartSelectors } from '../src/style-mappings.js';

const parts: PartSelectors = {
  tags: new Map([
    ['button', ['control', 'send']],
    ['span', ['label']],
  ]),
  classes: new Map([
    ['send', ['send']],
    ['label', ['label']],
    ['entry', ['control']],
  ]),
  all: ['control', 'send', 'label', 'diff'],
  computedClass: ['diff'],
};
const mappings = (css: string) =>
  styleMappingsOf(css, parts).map(
    (m) => `${m.part ?? 'host'} | ${m.when} | ${m.cssProperty} -> ${m.token}`,
  );

describe('selectionOf', () => {
  it('reads host attributes, part elements, and states', () => {
    expect(selectionOf(':host', parts)).toEqual({
      matches: [undefined],
      when: 'default',
      specificity: 100,
      unread: [],
    });
    expect(selectionOf(':host([full-width])', parts)).toMatchObject({
      matches: [undefined],
      when: 'full-width',
      specificity: 200,
    });
    expect(
      selectionOf(
        ":host([appearance='primary']) button:hover:enabled:not([aria-disabled='true'])",
        parts,
      ),
    ).toEqual({
      matches: ['control', 'send'],
      when: 'appearance="primary" (enabled, hover)',
      specificity: 200 + 1 + 300,
      unread: [],
    });
    expect(selectionOf(':host button:disabled', parts)).toMatchObject({
      when: '(disabled)',
      specificity: 201,
    });
    expect(selectionOf('.entry[aria-current="page"]', parts)).toMatchObject({
      matches: ['control'],
      when: '(current="page")',
      specificity: 200,
    });
    expect(selectionOf(".label[aria-pressed='true']:focus-visible", parts)).toMatchObject({
      matches: ['label'],
      when: '(focus-visible, pressed)',
    });
  });

  it('leaves conditions outside the grammar unread for every part they may style', () => {
    const unread = (selector: string) => {
      const selection = selectionOf(selector, parts);
      return { matches: selection.matches, unread: selection.unread };
    };
    // Class selectors may match elements with a computed class list.
    expect(unread('.send')).toEqual({ matches: ['send'], unread: ['diff'] });
    expect(unread(".entry:not(:disabled, [aria-disabled='true']):hover")).toEqual({
      matches: [],
      unread: ['control', 'diff'],
    });
    expect(unread('.root .label')).toEqual({ matches: [], unread: ['label', 'diff'] });
    expect(unread(':host > button')).toEqual({ matches: [], unread: ['control', 'send'] });
    expect(unread(':host button span')).toEqual({ matches: [], unread: ['label'] });
    expect(unread("span[data-tone='x']")).toEqual({ matches: [], unread: ['label'] });
    expect(unread(':host(:hover)')).toEqual({ matches: [], unread: [undefined] });
    expect(unread(':host-context(.dark)')).toEqual({ matches: [], unread: [undefined] });
    expect(unread(':focus-visible')).toEqual({ matches: [], unread: parts.all });
    expect(unread('*')).toEqual({ matches: [], unread: parts.all });
    // Pseudo-elements and slotted content style no part; other elements match nothing.
    expect(unread('.label::before')).toEqual({ matches: [], unread: [] });
    expect(unread('::slotted(a:hover)')).toEqual({ matches: [], unread: [] });
    expect(unread('div')).toEqual({ matches: [], unread: [] });
  });
});

describe('styleMappingsOf', () => {
  it('maps the declaration that wins for each part, condition, and property', () => {
    expect(
      mappings(`
        :host { font-size: token(font.md); }
        /* A later rule of equal specificity wins; a comment { is skipped. */
        :host { font-size: token(font.xs); color: token(text.primary); }
        .send { padding-inline: token(space.xs); }
        button { padding-inline: token(space.sm); min-block-size: max(token(h.md), token(target)); }
        span { color: token(text.secondary); }
        span { color: inherit; }
        span { content: '{;}'; margin: token(space.2xs); }
      `),
    ).toEqual([
      'host | default | font-size -> font.xs',
      'host | default | color -> text.primary',
      'send | default | padding-inline -> space.xs',
      'control | default | padding-inline -> space.sm',
      'control | default | min-block-size -> h.md',
      'control | default | min-block-size -> target',
      'send | default | min-block-size -> h.md',
      'send | default | min-block-size -> target',
      'label | default | margin -> space.2xs',
    ]);
  });

  it('applies !important and cascade layers before specificity', () => {
    expect(
      mappings(`
        @layer base, theme;
        @layer theme { .send { color: token(theme); } }
        @layer base { :host .send { color: token(base); background: token(base.bg) !important; } }
        span { color: token(unlayered); }
        @layer theme { span { color: token(layered) !important; } }
        @layer base { span { color: token(first.layer) !important; } }
        :host .send { background: token(unlayered.bg) !important; }
      `),
    ).toEqual([
      // A later layer beats specificity; unlayered beats layers; `!important` reverses both.
      'send | default | color -> theme',
      'send | default | background -> base.bg',
      'label | default | color -> first.layer',
    ]);
  });

  it('states media, support, and container conditions; skips keyframes and starting styles', () => {
    expect(
      mappings(`
        @media (hover:  hover) { :host([appearance='primary']) button:hover { background: token(hover); } }
        @supports (display: grid) { @container nav (min-width: 40rem) { span { gap: token(gap.wide); } } }
        @keyframes spin { 50% { gap: token(never); } }
        @starting-style { span { gap: token(start); } }
      `),
    ).toEqual([
      'control | appearance="primary" (hover) @media (hover: hover) | background -> hover',
      'send | appearance="primary" (hover) @media (hover: hover) | background -> hover',
      'label | @supports (display: grid) @container nav (min-width: 40rem) | gap -> gap.wide',
    ]);
  });

  it('leaves a property unmapped when any rule that may set it is unread', () => {
    expect(
      mappings(`
        span { color: token(text); gap: token(gap); }
        span:hover { color: token(hover); }
        .root span { color: CanvasText; }
        @scope (.card) { button { gap: token(scoped); } }
        .send:focus-visible { outline-color: token(focus); }
        .other { outline-color: red; }
      `),
    ).toEqual([
      'label | default | gap -> gap',
      // `.other` may match only elements with a computed class list.
      'send | (focus-visible) | outline-color -> focus',
    ]);
  });

  it('reads nothing from nested style rules or computed selectors', () => {
    // The nested block hides `.label`'s own declarations, which outrank `span`.
    expect(
      mappings('span { color: token(a); } .label { color: token(b); & .y { gap: 0; } }'),
    ).toEqual([]);
    // A computed selector may style any part, even one this text never names.
    expect(mappings('span { color: token(a); } unknown() { color: red; }')).toEqual([]);
    expect(mappings('span { color: token(a); width: unknown(); }')).toEqual([
      'label | default | color -> a',
    ]);
  });
});
