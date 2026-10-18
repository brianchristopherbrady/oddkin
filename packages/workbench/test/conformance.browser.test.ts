import { expect, describe, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import {
  OddkinButton,
  buttonDefinition,
  buttonStructuralStyles,
  buttonTemplate,
} from '@oddkin/components/button';
import { compose, define } from '@oddkin/core/element';
import type { Scope } from '@oddkin/core/scope';
import { css } from '@oddkin/core/styles';
import { html } from '@oddkin/core/template';
import { checkConformance, toConformanceJSON } from '../src/conformance/index.js';
import { buttonConformance } from '../src/conformance/button.js';
import { runConformance } from '../src/testing/index.js';

// Each run executes 11 cases with real input; allow for load while three browser projects run.
vi.setConfig({ testTimeout: 60_000 });

// Conformance prototype (IMPLEMENTATION_PLAN.md M4, ADR 0034): the odd-button suite must
// accept the default element and legitimate product implementations, and reject mutants.

const studioStyles = css`
  button {
    border-radius: var(--odd-button-radius, 2px);
    background: var(--odd-button-background, rebeccapurple);
    color: white;
    min-block-size: 32px;
  }
`;

// Legitimate implementations --------------------------------------------------------------
class StudioButton extends OddkinButton {}
class AltTemplateButton extends OddkinButton {}
define(buttonDefinition);
define(compose({
  ...buttonDefinition,
  name: 'studio-button',
  element: StudioButton,
  styles: [buttonStructuralStyles, studioStyles],
}));
// A different template that keeps the anatomy: a native <button part="control">, the slots,
// the spinner, and the disabled/aria-disabled/label relationships.
define(compose({
  ...buttonDefinition,
  name: 'alt-template-button',
  element: AltTemplateButton,
  template: (b) =>
    html`<button
      part="control"
      type="button"
      class="pill"
      ?disabled=${b.disabled || b._formDisabled.value}
      aria-disabled=${b.loading ? 'true' : null}
      aria-label=${b.label || null}
    >
      <span class="content"><slot name="start"></slot><slot></slot></span>
      <slot name="end"></slot>
      <span part="spinner" aria-hidden="true" ?hidden=${!b.loading}>…</span>
    </button>`,
}));

// Mutants ---------------------------------------------------------------------------------
class DivControl extends OddkinButton {}
class NoisyButton extends OddkinButton {
  protected override updated(): void {
    this.dispatchEvent(new Event('change', { bubbles: true }));
  }
}
class NoDisabledButton extends OddkinButton {}
class LeakyButton extends OddkinButton {
  protected override connected(scope: Scope): void {
    super.connected(scope);
    // Unowned listener: added on every connection and never removed.
    this.addEventListener('click', () => this.form?.requestSubmit());
  }
}
class UnfocusableLoading extends OddkinButton {}
define(compose({
  ...buttonDefinition,
  name: 'mutant-div-control',
  element: DivControl,
  template: () => html`<div part="control" role="button" tabindex="0"><slot></slot></div>`,
}));
define(compose({ ...buttonDefinition, name: 'mutant-noisy', element: NoisyButton }));
define(compose({
  ...buttonDefinition,
  name: 'mutant-no-disabled',
  element: NoDisabledButton,
  template: (b) =>
    html`<button part="control" type="button" aria-disabled=${b.loading ? 'true' : null}>
      <slot></slot>
    </button>`,
}));
define(compose({ ...buttonDefinition, name: 'mutant-leaky', element: LeakyButton }));
define(compose({
  ...buttonDefinition,
  name: 'mutant-unfocusable-loading',
  element: UnfocusableLoading,
  template: (b) =>
    html`<button part="control" type="button" ?disabled=${b.disabled || b.loading}>
      <slot></slot>
    </button>`,
}));

const run = (tag: string) =>
  runConformance(buttonConformance, {
    tag,
    expect,
    user: userEvent,
    configuration: { theme: 'none', product: tag },
  });
const failed = (result: Awaited<ReturnType<typeof run>>) =>
  result.results.filter((r) => r.state === 'failed').map((r) => r.case);

describe('odd-button conformance suite', () => {
  it('is structurally valid and serializes to conformance.v1', () => {
    expect(checkConformance(buttonConformance)).toEqual([]);
    const json = toConformanceJSON(buttonConformance) as { cases: { id: string }[] };
    expect(json.cases.map((c) => c.id)).toContain('reconnect');
    expect(JSON.parse(JSON.stringify(json))).toEqual(json);
  });

  for (const tag of ['odd-button', 'studio-button', 'alt-template-button']) {
    it(`accepts <${tag}>`, async () => {
      const result = await run(tag);
      expect(failed(result), JSON.stringify(result.results)).toEqual([]);
      expect(result.results.every((r) => r.state === 'passed')).toBe(true);
      expect(result.implementation.tag).toBe(tag);
      expect(result.suite).toEqual({ id: 'oddkin.button', version: '0.1.0' });
    });
  }

  const mutants: [string, string[]][] = [
    ['mutant-div-control', ['native-control', 'keyboard-activation']],
    ['mutant-noisy', ['programmatic-updates']],
    ['mutant-no-disabled', ['disabled']],
    ['mutant-leaky', ['reconnect']],
    ['mutant-unfocusable-loading', ['loading']],
  ];
  for (const [tag, expected] of mutants) {
    it(`rejects <${tag}> on ${expected.join(', ')}`, async () => {
      const result = await run(tag);
      for (const id of expected) expect(failed(result)).toContain(id);
    });
  }

  it('reports cases it did not run as not-executed, never passed', async () => {
    const result = await runConformance(buttonConformance, {
      tag: 'odd-button',
      expect,
      user: userEvent,
      only: ['native-control'],
    });
    expect(result.results.find((r) => r.case === 'native-control')?.state).toBe('passed');
    expect(result.results.filter((r) => r.state === 'not-executed')).toHaveLength(
      buttonConformance.cases.length - 1,
    );
  });
});
