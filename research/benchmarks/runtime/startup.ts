// Startup benchmark page module: a minimal production counter, as an application would ship it.
// Marks: module evaluated (after define), first render committed. Click timing measures input to
// the next frame (requestAnimationFrame + task), plus Event Timing duration where supported.
import { OddkinElement, define, html, signal } from '@oddkin/core';

performance.mark('oddkin:evaluated-start');

interface Startup {
  evaluatedMs: number;
  renderedMs: number;
  scriptResponseEndMs: number;
  clicks: { nextFrameMs: number }[];
  /** Control: a plain DOM button updated by hand, timed the same way. */
  plainClicks: { nextFrameMs: number }[];
  eventTiming: number[];
}
const result: Startup = {
  evaluatedMs: 0,
  renderedMs: 0,
  scriptResponseEndMs: 0,
  clicks: [],
  plainClicks: [],
  eventTiming: [],
};

class StartupCounter extends OddkinElement {
  readonly count = signal(0);
  readonly increment = (event: Event) => {
    this.count.value++;
    const start = event.timeStamp;
    requestAnimationFrame(() =>
      setTimeout(() => result.clicks.push({ nextFrameMs: performance.now() - start })),
    );
  };
  protected override render() {
    return html`<button type="button" @click=${this.increment}>Count: ${this.count}</button>`;
  }
}
define('startup-counter', StartupCounter);
result.evaluatedMs = performance.now();

if (
  'PerformanceObserver' in globalThis &&
  PerformanceObserver.supportedEntryTypes?.includes('event')
) {
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.name === 'click') result.eventTiming.push(entry.duration);
    }
  }).observe({ type: 'event', buffered: true, durationThreshold: 16 } as PerformanceObserverInit);
}

const plain = document.createElement('button');
plain.id = 'plain';
plain.type = 'button';
plain.textContent = 'Plain: 0';
let plainCount = 0;
plain.addEventListener('click', (event) => {
  plain.textContent = `Plain: ${++plainCount}`;
  const start = event.timeStamp;
  requestAnimationFrame(() =>
    setTimeout(() => result.plainClicks.push({ nextFrameMs: performance.now() - start })),
  );
});
document.body.append(plain);

const counter = document.createElement('startup-counter') as StartupCounter;
document.body.append(counter);
await counter.updateComplete;
result.renderedMs = performance.now();
const script = performance
  .getEntriesByType('resource')
  .find((e) => e.name.endsWith('/startup.js')) as PerformanceResourceTiming | undefined;
result.scriptResponseEndMs = script?.responseEnd ?? Number.NaN;
(globalThis as unknown as { startup: Startup }).startup = result;
