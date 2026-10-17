import { expect, describe, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import {
  MoteButton,
  buttonDefinition,
  buttonStructuralStyles,
  buttonTemplate,
} from '@mote/components/button';
import { compose, define } from '@mote/core/element';
import type { Scope } from '@mote/core/scope';
import { css } from '@mote/core/styles';
import { html } from '@mote/core/template';
import { checkConformance, toConformanceJSON } from '../src/conformance/index.js';
import { buttonConformance } from '../src/conformance/button.js';
import { runConformance } from '../src/testing/index.js';

// Each run executes 11 cases with real input; allow for load while three browser projects run.
vi.setConfig({ testTimeout: 60_000 });

// Conformance prototype (IMPLEMENTATION_PLAN.md M4, ADR 0034): the mote-button suite must
// accept the default element and legitimate product implementations, and reject mutants.

const studioStyles = css`
  button {
    border-radius: var(--mote-button-radius, 2px);
    background: var(--mote-button-background, rebeccapurple);
    color: white;
    min-block-size: 32px;
  }
`;

// Legitimate implementations --------------------------------------------------------------
class StudioButton extends MoteButton {}
class AltTemplateButton extends MoteButton {}
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
class DivControl extends MoteButton {}
class NoisyButton extends MoteButton {
  protected override updated(): void {
    this.dispatchEvent(new Event('change', { bubbles: true }));
  }
}
class NoDisabledButton extends MoteButton {}
class LeakyButton extends MoteButton {
  protected override connected(scope: Scope): void {
    super.connected(scope);
    // Unowned listener: added on every connection and never removed.
    this.addEventListener('click', () => this.form?.requestSubmit());
  }
}
class UnfocusableLoading extends MoteButton {}
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

describe('mote-button conformance suite', () => {
  it('is structurally valid and serializes to conformance.v1', () => {
    expect(checkConformance(buttonConformance)).toEqual([]);
    const json = toConformanceJSON(buttonConformance) as { cases: { id: string }[] };
    expect(json.cases.map((c) => c.id)).toContain('reconnect');
    expect(JSON.parse(JSON.stringify(json))).toEqual(json);
  });

  for (const tag of ['mote-button', 'studio-button', 'alt-template-button']) {
    it(`accepts <${tag}>`, async () => {
      const result = await run(tag);
      expect(failed(result), JSON.stringify(result.results)).toEqual([]);
      expect(result.results.every((r) => r.state === 'passed')).toBe(true);
      expect(result.implementation.tag).toBe(tag);
      expect(result.suite).toEqual({ id: 'mote.button', version: '0.1.0' });
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
      tag: 'mote-button',
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
