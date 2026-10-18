// TypeScript authoring of the same elements. Types come from the public API: `prop.string`
// infers `label: string`, `signal(0)` is `Signal<number>`, and hooks use `protected override`.
import { OddkinElement, define, html, prop, signal, type Signal } from '@oddkin/core';

export class WalkDirectTs extends OddkinElement {
  readonly count: Signal<number> = signal(0);
  renders = 0;
  protected override render() {
    this.renders++;
    return html`<output>${this.count}</output>`;
  }
}

export class WalkTrackedTs extends OddkinElement {
  readonly count = signal(0);
  renders = 0;
  protected override render() {
    this.renders++;
    return html`<output>${this.count.value}</output>`;
  }
}

export class WalkDualTs extends OddkinElement {
  readonly count = signal(0);
  renders = 0;
  protected override render() {
    this.renders++;
    return html`<span>${this.count.value > 10 ? 'big' : 'small'}</span>
      <output>${this.count}</output>`;
  }
}

export class WalkSnapshotTs extends OddkinElement {
  readonly count = signal(0);
  renders = 0;
  readonly seen: number[] = [];
  later: Promise<number | undefined> = Promise.resolve(undefined);
  readonly capture = (): void => {
    this.seen.push(this.count.value);
    this.later = new Promise((resolve) => setTimeout(() => resolve(this.count.value), 0));
  };
  protected override render() {
    this.renders++;
    return html`<button type="button" @click=${this.capture}>Read count</button>`;
  }
}

export class WalkPropTs extends OddkinElement.with({ label: prop.string({ default: 'reader' }) }) {
  renders = 0;
  readonly changes: string[][] = [];
  protected override render() {
    this.renders++;
    const label: string = this.label;
    return html`<p>Hello, ${label}</p>`;
  }
  protected override updated(changes: ReadonlyMap<string, unknown>): void {
    this.changes.push([...changes.keys()]);
  }
}

define('walk-direct-ts', WalkDirectTs);
define('walk-tracked-ts', WalkTrackedTs);
define('walk-dual-ts', WalkDualTs);
define('walk-snapshot-ts', WalkSnapshotTs);
define('walk-prop-ts', WalkPropTs);

declare global {
  interface HTMLElementTagNameMap {
    'walk-direct-ts': WalkDirectTs;
    'walk-tracked-ts': WalkTrackedTs;
    'walk-dual-ts': WalkDualTs;
    'walk-snapshot-ts': WalkSnapshotTs;
    'walk-prop-ts': WalkPropTs;
  }
}
