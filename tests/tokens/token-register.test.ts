import { describe, expect, it } from 'vitest';
import {
  checkCss,
  checkRegister,
  familyOf,
  loadRegister,
  run,
  type InspectedToken as Token,
} from '../../scripts/check-tokens.mjs';

// Contract: theming-and-styling.md §10.8. The repository passes (first case); the other cases
// prove each rule catches what it claims to.
const register = loadRegister();
const token = (name: string, extra: Partial<Token> = {}): Token => ({
  name,
  cssVariable: `--odd-${name.replaceAll('.', '-')}`,
  category: 'foundation',
  type: 'dimension',
  origin: 'preset',
  definition: '1rem',
  ...extra,
});
const css = (text: string, tokens: Token[], documented: string[] = []) =>
  checkCss(text, {
    file: 'case.css',
    tokensByVariable: new Map(tokens.map((t) => [t.cssVariable, t])),
    documented: new Set(documented),
  });

describe('token register', () => {
  it('the default theme and every shipped stylesheet pass', async () => {
    const result = await run();
    expect(result.problems).toEqual([]);
    expect(result.sheets).toBeGreaterThan(100);
  });

  it('a token outside every reviewed family fails', () => {
    expect(familyOf(register, 'control.radius')?.name).toBe('Control');
    expect(familyOf(register, 'surprise.gap')).toBeUndefined();
    const problems = checkRegister(register, [token('surprise.gap')], new Set(['surprise.gap']));
    expect(
      problems.some((p: string) => p.startsWith('surprise.gap: not in the token register')),
    ).toBe(true);
  });

  it('a role that only names another token needs a description or a theme override', () => {
    const alias = (extra: Partial<Token>) =>
      token('control.radius', { category: 'semantic', definition: '{radius.md}', ...extra });
    const purpose = (t: Token) =>
      checkRegister(register, [t], new Set([t.name])).filter((p: string) =>
        p.includes('only names'),
      );
    expect(purpose(alias({}))).toHaveLength(1);
    expect(purpose(alias({ description: 'Corners of every control.' }))).toEqual([]);
    expect(purpose(alias({ origin: 'overridden' }))).toEqual([]);
    expect(
      purpose(token('type.ui.size', { category: 'semantic', definition: '{font.size.sm}' })),
    ).toEqual([]);
    // An expression is not an alias, and foundation steps may name each other.
    expect(purpose(alias({ definition: 'calc({radius.md} / 2)' }))).toEqual([]);
    expect(purpose(token('font.family.display', { definition: '{font.family.sans}' }))).toEqual([]);
  });

  it('a role no shipped CSS reads fails unless the register offers it', () => {
    const role = token('layout.gap', {
      category: 'layout',
      definition: '{space.md}',
      description: 'x',
    });
    expect(
      checkRegister(register, [role], new Set()).some((p: string) =>
        p.includes('no shipped CSS reads it'),
      ),
    ).toBe(true);
    const offered = token('color.accent.decorative', { category: 'semantic', type: 'color' });
    expect(
      checkRegister(register, [offered], new Set()).filter((p: string) =>
        p.includes('no shipped CSS'),
      ),
    ).toEqual([]);
    expect(
      checkRegister(register, [offered], new Set([offered.name])).some((p: string) =>
        p.includes('is now read'),
      ),
    ).toBe(true);
  });

  it('a --odd-* name that is not a token or a documented CSS property fails', () => {
    const space = token('space.md');
    expect(css('.a { gap: var(--odd-space-md); }', [space]).problems).toEqual([]);
    expect(
      css('.a { gap: var(--odd-card-gap, var(--odd-space-md)); }', [space], ['--odd-card-gap'])
        .problems,
    ).toEqual([]);
    expect(css('.a { gap: var(--odd-mystery-gap); }', [space]).problems).toEqual([
      'case.css: gap reads --odd-mystery-gap, which is not a token or a documented CSS property',
    ]);
  });

  it('a token on the wrong kind of property fails, as the whole value', () => {
    const tokens = [
      token('radius.md'),
      token('space.2xs'),
      token('focus.offset'),
      token('color.text.primary', { type: 'color', category: 'semantic' }),
      token('elevation.md', { type: 'shadow' }),
    ];
    const problems = (text: string) => css(text, tokens).problems;
    expect(
      problems(
        '.a { border-radius: var(--odd-radius-md); color: var(--odd-color-text-primary); box-shadow: var(--odd-elevation-md); outline-offset: var(--odd-focus-offset); }',
      ),
    ).toEqual([]);
    expect(problems('.a { padding: var(--odd-radius-md); }')).toEqual([
      'case.css: padding uses radius.md, a radius token',
    ]);
    expect(problems('.a { margin: var(--odd-color-text-primary); }')).toEqual([
      'case.css: margin uses color.text.primary, a color token',
    ]);
    expect(problems('.a { outline-offset: var(--odd-space-2xs); }')).toEqual([
      'case.css: outline-offset uses space.2xs; use focus.offset',
    ]);
    // Inside an expression a token is geometry, not a role: a border width in a size is fine.
    expect(
      problems(
        '.a { inset: calc(-1 * var(--odd-focus-offset)); padding: calc(var(--odd-radius-md) / 2); }',
      ),
    ).toEqual([]);
  });

  it('counts a token as used when shipped CSS reads it, and through custom properties', () => {
    const { used, problems } = css(
      '.a { --x: var(--odd-space-md); --y: var(--odd-color-text-primary); }',
      [token('space.md'), token('color.text.primary', { type: 'color' })],
    );
    expect([...used].sort()).toEqual(['color.text.primary', 'space.md']);
    // A custom property takes any token: its kind is checked where it is used.
    expect(problems).toEqual([]);
  });

  it('counts a role as used when a used token names it', () => {
    const inset = token('layout.inset', {
      category: 'layout',
      definition: '{space.lg}',
      description: 'x',
    });
    const padding = token('card.padding', {
      category: 'component',
      definition: '{layout.inset}',
      description: 'x',
    });
    const unread = (read: string[]) =>
      checkRegister(register, [inset, padding], new Set(read)).filter((p: string) =>
        p.includes('no shipped CSS'),
      );
    expect(unread(['card.padding'])).toEqual([]);
    expect(unread([])).toHaveLength(2);
    // Through a chain, and through per-mode values.
    const page = token('layout.measure', {
      category: 'layout',
      definition: { light: '{card.padding}', dark: '{card.padding}' },
      description: 'x',
    });
    const chain = checkRegister(register, [inset, padding, page], new Set(['layout.measure']));
    expect(chain.filter((p: string) => p.includes('no shipped CSS'))).toEqual([]);
  });

  it('checks the kind of every family of tokens', () => {
    const cases: Array<[Token, string, string]> = [
      [token('elevation.md', { type: 'shadow' }), 'box-shadow', 'padding'],
      [token('z-index.raised', { type: 'number' }), 'z-index', 'order'],
      [token('motion.duration.fast', { type: 'duration' }), 'transition-duration', 'inline-size'],
      [
        token('motion.easing.standard', { type: 'cubicBezier' }),
        'animation-timing-function',
        'margin',
      ],
      [token('font.family.sans', { type: 'fontFamily' }), 'font-family', 'content'],
      [token('font.weight.medium', { type: 'fontWeight' }), 'font-weight', 'opacity'],
      [
        token('type.ui.line-height', { type: 'number', category: 'semantic' }),
        'line-height',
        'flex-grow',
      ],
      [token('letter-spacing.wide'), 'letter-spacing', 'gap'],
      [token('card.radius', { category: 'component' }), 'border-start-end-radius', 'inset'],
      [
        token('color.border.default', { type: 'color', category: 'semantic' }),
        'border-inline-start-color',
        'border-width',
      ],
    ];
    for (const [t, right, wrong] of cases) {
      expect(
        css(`.a { ${right}: var(${t.cssVariable}); }`, [t]).problems,
        `${t.name} on ${right}`,
      ).toEqual([]);
      expect(
        css(`.a { ${wrong}: var(${t.cssVariable}); }`, [t]).problems,
        `${t.name} on ${wrong}`,
      ).toHaveLength(1);
    }
    // Lengths may set any length property; only outline-offset is kept for focus.offset.
    expect(css('.a { inset: var(--odd-space-md); }', [token('space.md')]).problems).toEqual([]);
  });

  it('reports a family with no token, and stale offered entries', () => {
    const lone = {
      ...register,
      families: [{ name: 'Empty', tokens: ['nothing.*'], purpose: 'x' }],
      offered: { 'gone.token': 'x' },
    };
    const problems = checkRegister(lone, [], new Set());
    expect(problems).toContain('register family "Empty" matches no token; remove it');
    expect(problems).toContain('offered "gone.token" is not a token; remove it from the register');
  });
});
