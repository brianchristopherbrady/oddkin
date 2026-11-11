import '@oddkin/components/define/container';
import '@oddkin/workbench/frame';
import type { BehaviorCanvas, BehaviorMetrics, BehaviorPurpose } from './behavior-canvas.js';

const scene = document.querySelector<HTMLElement>('#behavior-scene')!;
const allocation = document.querySelector<HTMLElement>('#behavior-allocation')!;
const neighbor = document.querySelector<HTMLTextAreaElement>('#behavior-neighbor')!;
const listeners = new Set<(metrics: BehaviorMetrics) => void>();
let purpose: BehaviorPurpose = 'flow';
let baseline = 0;
let signature = '';
let frame = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
const offset = () =>
  neighbor.parentElement!.getBoundingClientRect().top - scene.getBoundingClientRect().top;

function measure(reset = false): BehaviorMetrics {
  const css = getComputedStyle(allocation);
  const text = getComputedStyle(neighbor);
  const capacity =
    allocation.clientWidth - parseFloat(css.paddingInlineStart) - parseFloat(css.paddingInlineEnd);
  const current = [
    capacity,
    purpose,
    text.fontSize,
    text.lineHeight,
    text.letterSpacing,
    text.wordSpacing,
  ].join('|');
  if (reset || signature !== current) baseline = offset();
  signature = current;
  const metrics: BehaviorMetrics = {
    width: innerWidth,
    capacity,
    height: Math.ceil(scene.getBoundingClientRect().height + 24),
    shift: Math.round((offset() - baseline) * 10) / 10,
    purpose,
  };
  document.querySelector('#behavior-movement')!.textContent =
    `${metrics.shift > 0 ? '+' : ''}${metrics.shift} px neighbor movement${purpose === 'flow' ? ' · growth allowed' : ''}`;
  for (const listener of listeners) listener(metrics);
  return metrics;
}

function schedule() {
  cancelAnimationFrame(frame);
  clearTimeout(timer);
  const run = () => {
    cancelAnimationFrame(frame);
    clearTimeout(timer);
    measure();
  };
  frame = requestAnimationFrame(run);
  // Offscreen previews can pause animation frames. Geometry reads still flush layout.
  timer = setTimeout(run, 120);
}

const canvas: BehaviorCanvas = {
  settle(reset = false) {
    return new Promise((resolve) => {
      let first = 0;
      let second = 0;
      const finish = () => {
        clearTimeout(timeout);
        cancelAnimationFrame(first);
        cancelAnimationFrame(second);
        resolve(measure(reset));
      };
      const timeout = setTimeout(finish, 120);
      first = requestAnimationFrame(() => {
        second = requestAnimationFrame(finish);
      });
    });
  },
  async configurePurpose(value) {
    purpose = value;
    allocation.dataset['purpose'] = value;
    document.querySelector('#behavior-grant')!.textContent =
      value === 'bounded'
        ? 'Long content scrolls inside the reserved region.'
        : 'Content can grow in this region.';
    return canvas.settle(true);
  },
  subscribe(listener) {
    listeners.add(listener);
    measure();
    return () => listeners.delete(listener);
  },
};
window.oddkinBehaviorCanvas = canvas;
new ResizeObserver(schedule).observe(scene);
new MutationObserver(schedule).observe(document.querySelector('#behavior-preview')!, {
  subtree: true,
  childList: true,
  characterData: true,
});
addEventListener('resize', schedule);
document.addEventListener('input', schedule, true);
document.addEventListener('click', schedule, true);
