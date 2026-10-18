import { describe, expect, it } from 'vitest';
import { buildTemplateHtml } from '../src/template/prepare.js';

const strings = (s: TemplateStringsArray, ..._values: unknown[]) => s;
const codeOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (error) {
    return (error as { code?: string }).code;
  }
  return undefined;
};

describe('template lexer', () => {
  it('marks child positions with comments and keeps static markup', () => {
    const { html, attributes } = buildTemplateHtml(strings`<p class="x">Hi ${0}!</p>${1}`);
    expect(html).toMatch(/^<p class="x">Hi <!--oddkin-[a-z0-9]+-->!<\/p><!--oddkin-[a-z0-9]+-->$/);
    expect(attributes).toEqual([]);
  });

  it('records attribute bindings with case-preserved names and prefixes', () => {
    const { attributes } = buildTemplateHtml(
      strings`<input .valueAsNumber=${0} ?disabled=${1} @keyDown=${2} aria-label="${3}" class="a ${4} b ${5}">`,
    );
    expect(attributes).toEqual([
      { type: 'property', name: 'valueAsNumber', strings: ['', ''] },
      { type: 'boolean', name: 'disabled', strings: ['', ''] },
      { type: 'event', name: 'keyDown', strings: ['', ''] },
      { type: 'attribute', name: 'aria-label', strings: ['', ''] },
      { type: 'attribute', name: 'class', strings: ['a ', ' b ', ''] },
    ]);
  });

  it('replaces bound attributes with markers and leaves static ones', () => {
    const { html } = buildTemplateHtml(strings`<a href=${0} title='t' data-x=${1}>x</a>`);
    expect(html).toMatch(/^<a oddkin-[a-z0-9]+-a0 title='t' oddkin-[a-z0-9]+-a1>x<\/a>$/);
  });

  it('ignores markup-like text in comments and raw-text elements', () => {
    const { attributes } = buildTemplateHtml(
      strings`<!-- <b x=1> --><style>p > a { color: red }</style><i title=${0}></i>`,
    );
    expect(attributes).toEqual([{ type: 'attribute', name: 'title', strings: ['', ''] }]);
  });

  it('rejects unsupported binding positions with stable codes', () => {
    expect(codeOf(() => buildTemplateHtml(strings`<${0}>`))).toBe('template.binding.position');
    expect(codeOf(() => buildTemplateHtml(strings`<p></${0}>`))).toBe('template.binding.position');
    expect(codeOf(() => buildTemplateHtml(strings`<div ${0}></div>`))).toBe(
      'template.binding.position',
    );
    expect(codeOf(() => buildTemplateHtml(strings`<!-- ${0} -->`))).toBe(
      'template.binding.position',
    );
    expect(codeOf(() => buildTemplateHtml(strings`<style>${0}</style>`))).toBe(
      'template.binding.rawText',
    );
    expect(codeOf(() => buildTemplateHtml(strings`<textarea>${0}</textarea>`))).toBe(
      'template.binding.rawText',
    );
    expect(codeOf(() => buildTemplateHtml(strings`<p .x="a${0}"></p>`))).toBe(
      'template.binding.mixed',
    );
    expect(codeOf(() => buildTemplateHtml(strings`<p onclick=${0}></p>`))).toBe(
      'template.attribute.unsafe',
    );
    expect(codeOf(() => buildTemplateHtml(strings`<p .innerHTML=${0}></p>`))).toBe(
      'template.sink.unsafe',
    );
    expect(codeOf(() => buildTemplateHtml(strings`<iframe srcdoc=${0}></iframe>`))).toBe(
      'template.sink.unsafe',
    );
    expect(codeOf(() => buildTemplateHtml(strings`<p title="x`))).toBe('template.parse.unclosed');
  });
});
