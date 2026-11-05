import { describe, expect, it } from 'vitest';
import {
  extractDiagnostics,
  namesAnAction,
  renderDiagnostics,
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
      this.#report({ code: 'ai.event.stale', message: 'Dropped a late event.' });
      const STRINGS = { 'ai.attachment.size': '{name} is larger than {limit}.' };
      reportOddkinError(error, { code: 'autoload.import.failed', origin: tag });
      button('footer', 'primary', 'Sign in', 'signIn.submit');
      files.set('kit.json', JSON.stringify(manifest));
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
      ['analyzer.dynamic.tagName', 'error', 'The name is computed.', 'Use a string literal.'],
      ['ai.event.stale', '', 'Dropped a late event.', undefined],
      ['ai.attachment.size', '', '{name} is larger than {limit}.', undefined],
      // Its message is the reported error's: reviewed by hand.
      ['autoload.import.failed', '', '', undefined],
    ]);
  });

  it('flags a message that names no action and links nowhere', () => {
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
});
