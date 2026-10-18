/**
 * `@oddkin/ai/highlight` — an optional, small lexical highlighter for common languages. Loaded
 * separately from the Markdown renderer; returns tokens (never HTML) whose texts concatenate to
 * the input exactly, so the renderer can verify it before use. Specialized highlighters can
 * replace it through the same `Highlighter` contract.
 */
import type { HighlightToken } from '../markdown/render.js';

interface Grammar {
  readonly keywords: ReadonlySet<string>;
  readonly lineComment?: string;
  readonly blockComment?: readonly [string, string];
  readonly strings: string;
}

const words = (list: string) => new Set(list.split(' '));
const C_LIKE = { lineComment: '//', blockComment: ['/*', '*/'] as const, strings: '"\'`' };

const GRAMMARS: Record<string, Grammar> = {
  js: {
    ...C_LIKE,
    keywords: words(
      'async await break case catch class const continue default delete do else export extends false finally for from function if import in instanceof let new null of return static super switch this throw true try typeof undefined var void while yield',
    ),
  },
  ts: {
    ...C_LIKE,
    keywords: words(
      'abstract as async await break case catch class const continue declare default delete do else enum export extends false finally for from function if implements import in instanceof interface keyof let new null of private protected public readonly return satisfies static super switch this throw true try type typeof undefined var void while yield',
    ),
  },
  json: { strings: '"', keywords: words('true false null') },
  css: {
    blockComment: ['/*', '*/'],
    strings: '"\'',
    keywords: words('important inherit initial unset revert'),
  },
  py: {
    lineComment: '#',
    strings: '"\'',
    keywords: words(
      'and as assert async await break class continue def del elif else except False finally for from global if import in is lambda None nonlocal not or pass raise return True try while with yield',
    ),
  },
  sh: {
    lineComment: '#',
    strings: '"\'',
    keywords: words(
      'if then else elif fi for while do done case esac function in export local return',
    ),
  },
  html: { blockComment: ['<!--', '-->'], strings: '"\'', keywords: new Set() },
};
const ALIASES: Record<string, string> = {
  javascript: 'js',
  mjs: 'js',
  jsx: 'js',
  typescript: 'ts',
  tsx: 'ts',
  python: 'py',
  bash: 'sh',
  shell: 'sh',
  zsh: 'sh',
  xml: 'html',
  svg: 'html',
  jsonc: 'json',
  scss: 'css',
};

export const highlightLanguages: readonly string[] = [
  ...Object.keys(GRAMMARS),
  ...Object.keys(ALIASES),
];

/** Tokenize `code`; undefined for unknown languages (the renderer shows plain text). */
export function highlight(code: string, language: string): HighlightToken[] | undefined {
  const key = language.toLowerCase();
  const grammar = GRAMMARS[ALIASES[key] ?? key];
  if (!grammar) return undefined;
  const tokens: HighlightToken[] = [];
  let plain = '';
  const push = (text: string, kind?: string) => {
    if (!kind) {
      plain += text;
      return;
    }
    if (plain) tokens.push({ text: plain });
    plain = '';
    tokens.push({ text, kind });
  };
  let i = 0;
  while (i < code.length) {
    const rest = code.slice(i);
    if (grammar.lineComment && rest.startsWith(grammar.lineComment)) {
      const end = code.indexOf('\n', i);
      const text = end === -1 ? rest : code.slice(i, end);
      push(text, 'comment');
      i += text.length;
      continue;
    }
    if (grammar.blockComment && rest.startsWith(grammar.blockComment[0])) {
      const end = code.indexOf(grammar.blockComment[1], i + grammar.blockComment[0].length);
      const text = end === -1 ? rest : code.slice(i, end + grammar.blockComment[1].length);
      push(text, 'comment');
      i += text.length;
      continue;
    }
    const ch = code[i] as string;
    if (grammar.strings.includes(ch)) {
      let k = i + 1;
      while (k < code.length && code[k] !== ch) {
        if (code[k] === '\\') k++;
        if (code[k] === '\n' && ch !== '`') break;
        k++;
      }
      const text = code.slice(i, Math.min(k + 1, code.length));
      push(text, 'string');
      i += text.length;
      continue;
    }
    const number = /^\d[\d_.]*(?:e[+-]?\d+)?/i.exec(rest);
    if (number && !/[\w$]/.test(code[i - 1] ?? '')) {
      push(number[0], 'number');
      i += number[0].length;
      continue;
    }
    const word = /^[A-Za-z_$][\w$]*/.exec(rest);
    if (word) {
      push(word[0], grammar.keywords.has(word[0]) ? 'keyword' : undefined);
      i += word[0].length;
      continue;
    }
    push(ch);
    i++;
  }
  if (plain) tokens.push({ text: plain });
  return tokens;
}
