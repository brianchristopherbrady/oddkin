// Plain JavaScript authoring: no build step, no decorators, no TypeScript.
// Each element counts its own render() runs so the walkthrough can show which updates re-render.
import { MoteElement, define, html, prop, signal } from '@mote/core';

/** Direct binding: the readable itself is interpolated, so only its text node updates. */
class WalkDirectJs extends MoteElement {
  count = signal(0);
  renders = 0;
  render() {
    this.renders++;
    return html`<output>${this.count}</output>`;
  }
}

/** Render-tracked: `.value` is read during render(), so a change re-runs render() (once per flush). */
class WalkTrackedJs extends MoteElement {
  count = signal(0);
  renders = 0;
  render() {
    this.renders++;
    return html`<output>${this.count.value}</output>`;
  }
}

/** Both paths: render() reads `.value` for a label, and a direct binding shows the number. */
class WalkDualJs extends MoteElement {
  count = signal(0);
  renders = 0;
  render() {
    this.renders++;
    return html`<span>${this.count.value > 10 ? 'big' : 'small'}</span>
      <output>${this.count}</output>`;
  }
}

/** Snapshots: an event handler and an async callback read `.value` without subscribing anything. */
class WalkSnapshotJs extends MoteElement {
  count = signal(0);
  renders = 0;
  seen = [];
  later = Promise.resolve(undefined);
  capture = () => {
    this.seen.push(this.count.value);
    this.later = new Promise((resolve) => setTimeout(() => resolve(this.count.value), 0));
  };
  render() {
    this.renders++;
    return html`<button type="button" @click=${this.capture}>Read count</button>`;
  }
}

/** Public property: ordinary DOM code sets it; reading it in render() re-renders on change. */
class WalkPropJs extends MoteElement.with({ label: prop.string({ default: 'reader' }) }) {
  renders = 0;
  changes = [];
  render() {
    this.renders++;
    return html`<p>Hello, ${this.label}</p>`;
  }
  updated(changes) {
    this.changes.push([...changes.keys()]);
  }
}

define('walk-direct-js', WalkDirectJs);
define('walk-tracked-js', WalkTrackedJs);
define('walk-dual-js', WalkDualJs);
define('walk-snapshot-js', WalkSnapshotJs);
define('walk-prop-js', WalkPropJs);
