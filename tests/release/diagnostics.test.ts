import { describe, expect, it } from 'vitest';
import {
  extractDiagnostics,
  listDiagnostics,
  namesAnAction,
  renderDiagnostics,
  withoutValues,
  type ListedDiagnostic,
} from '../../scripts/list-diagnostics.mjs';

// RF-19 (docs/commercialization/release-foundation-plan.md): the error-message audit reads each
// code and its message from the sources, and flags a message that names no action and links to
// no page that does.
describe('the diagnostic list', () => {
  it('reads codes and messages from the ways the packages emit them', () => {
    const source = `
      out.error('config.invalid', 'The configuration must be an object.', '/');
      out.warn('data.tokens.missing', \`Foundations reference tokens; \${n} are unknown.\`);
      throw new OddkinError('app.root.missing', DEV ? 'There is no root. Pass a root to createApp().' : '');
      report('analyzer.dynamic.tagName', node, 'The name is computed.', 'Use a string literal.');
      report('analyzer.metadata.invalid', tag, 'The comment is invalid.', undefined, 'error');
      this.#report({ code: 'ai.event.stale', message: 'Dropped a late event.' });
      const STRINGS = { 'ai.attachment.size': '{name} is larger than {limit}.' };
      reportOddkinError(error, { code: 'autoload.import.failed', origin: tag });
      console.warn(\`[core.copies] Two copies run (\${a}). Install one copy.\`);
      console.warn('[not a code] Text in brackets.');
      button('footer', 'primary', 'Sign in', 'signIn.submit');
      files.set('kit.json', JSON.stringify(manifest));
      const hint = near ? \`Did you mean "\${near}"?\` : undefined;
      out.error('alias.missing', path, 'The token is unknown.', hint);
      const suggestion = 'Set a darker value.';
      d.items.push({ code: 'contrast.fail', severity: 'warning', message: 'Too low.', suggestion });
    `;
    expect(
      extractDiagnostics(source).map((d) => [d.code, d.severity, d.message, d.suggestion]),
    ).toEqual([
      ['config.invalid', 'error', 'The configuration must be an object.', undefined],
      [
        'data.tokens.missing',
        'warning',
        'Foundations reference tokens; ${n} are unknown.',
        undefined,
      ],
      ['app.root.missing', 'error', 'There is no root. Pass a root to createApp().', undefined],
      ['analyzer.dynamic.tagName', '', 'The name is computed.', 'Use a string literal.'],
      ['analyzer.metadata.invalid', 'error', 'The comment is invalid.', undefined],
      ['ai.event.stale', '', 'Dropped a late event.', undefined],
      ['ai.attachment.size', '', '{name} is larger than {limit}.', undefined],
      // Its message is the reported error's: reviewed by hand.
      ['autoload.import.failed', '', '', undefined],
      // A development warning that leads with its code in brackets.
      ['core.copies', 'warning', 'Two copies run (${a}). Install one copy.', undefined],
      // A suggestion named by a const: an argument, or a shorthand property.
      ['alias.missing', 'error', 'The token is unknown.', 'Did you mean "${near}"?'],
      ['contrast.fail', 'warning', 'Too low.', 'Set a darker value.'],
    ]);
  });

  it('flags a message that names no action and links nowhere', () => {
    // Values filled in at run time are not the message's words, nested or not.
    expect(withoutValues('Ignored ${a ? `${b} now` : "c"} for {name}.')).toBe('Ignored x for x.');
    expect(namesAnAction('Ignored ${a ? `use ${b}` : ""}.')).toBe(false);
    expect(namesAnAction('categories.assign maps <x-a> to "b".')).toBe(false);
    expect(namesAnAction('Category id "x" is defined twice.')).toBe(false);
    expect(namesAnAction('Dropped a late event.')).toBe(false);
    expect(namesAnAction('hosting.basePath "/x" must start and end with "/".')).toBe(true);
    expect(namesAnAction('The parent has no default slot. Name one of its slots: a, b.')).toBe(
      true,
    );
    expect(namesAnAction('<x-a> has no attribute "foo"; use "bar".')).toBe(true);
    expect(namesAnAction('See https://oddkin.dev/docs/theming.')).toBe(true);
    expect(namesAnAction('Dropped a late event, as expected after a stop: nothing to do.')).toBe(
      true,
    );
    expect(namesAnAction('Unknown option "x". Did you mean "y"?')).toBe(true);
    expect(namesAnAction('profile "p" may only declare custom properties.')).toBe(true);
    expect(namesAnAction('brand.primary is required.')).toBe(true);
  });

  it('lists each package with its flags, and computed messages for review', () => {
    const list: ListedDiagnostic[] = [
      {
        package: 'core',
        file: 'packages/core/src/a.ts',
        line: 3,
        code: 'a.b',
        severity: 'error',
        message: 'Use a | b.',
        action: true,
      },
      {
        package: 'core',
        file: 'packages/core/src/a.ts',
        line: 9,
        code: 'a.c',
        severity: '',
        message: 'It failed.',
        action: false,
      },
      {
        package: 'state',
        file: 'packages/state/src/b.ts',
        line: 1,
        code: 'b.c',
        severity: '',
        message: '',
        action: null,
      },
    ];
    const text = renderDiagnostics(list);
    expect(text).toContain('3 messages, 3 codes; 1 flagged, 1 to review.');
    expect(text.split('\n').filter((line) => line.startsWith('| `'))).toEqual([
      '| `a.b` | error | Use a \\| b. | yes | `packages/core/src/a.ts:3` |',
      '| `a.c` | — | It failed. | **no** | `packages/core/src/a.ts:9` |',
      '| `b.c` | — | *(computed at run time)* | *review* | `packages/state/src/b.ts:1` |',
    ]);
    expect(text).toMatch(/## @oddkin\/core[\s\S]*## @oddkin\/state/);
  });

  it('finds no message in the packages that names no action (RF-19 done on 2026-11-08)', () => {
    const flagged = listDiagnostics()
      .filter((d) => d.action === false)
      .map((d) => `${d.file}:${d.line} ${d.code}: ${d.message}`);
    expect(flagged).toEqual([]);
  });
});
