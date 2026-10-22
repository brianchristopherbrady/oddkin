import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  PositionController,
  type Placement,
  type PositionOptions,
} from '../src/controllers/position.js';
import { createScope, type Scope } from '../src/scope/index.js';

let container: HTMLElement;
let scope: Scope;

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  scope = createScope({ name: 'test' });
});
afterEach(() => {
  scope.dispose();
  container.remove();
});

const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
const frames = async (n = 2) => {
  for (let i = 0; i < n; i++) await frame();
};
const settle = () => Promise.resolve();

function styled<T extends HTMLElement>(el: T, css: Record<string, string>): T {
  for (const [name, value] of Object.entries(css)) el.style.setProperty(name, value);
  return el;
}

/** A 80×20 anchor at (left, top) and a 100×50 popover surface, both in `parent`. */
function fixture(left: number, top: number, parent: Element | ShadowRoot = container) {
  const anchor = styled(document.createElement('button'), {
    position: 'fixed',
    left: `${left}px`,
    top: `${top}px`,
    width: '80px',
    height: '20px',
    margin: '0',
    padding: '0',
    border: '0',
  });
  const surface = styled(document.createElement('div'), {
    width: '100px',
    height: '50px',
    padding: '0',
    border: '0',
  });
  surface.popover = 'manual';
  parent.append(anchor, surface);
  return { anchor, surface };
}

function position(
  anchor: Element,
  surface: HTMLElement,
  options: Partial<PositionOptions> = {},
): { controller: PositionController; placements: Placement[] } {
  const placements: Placement[] = [];
  const controller = scope.use(
    new PositionController({
      anchor: () => anchor,
      surface: () => surface,
      onPlace: (placement) => placements.push(placement),
      ...options,
    }),
  );
  return { controller, placements };
}

const rect = (el: Element) => {
  const r = el.getBoundingClientRect();
  return {
    left: Math.round(r.left),
    top: Math.round(r.top),
    right: Math.round(r.right),
    bottom: Math.round(r.bottom),
  };
};
const viewport = () => {
  const view = window.visualViewport!;
  return { width: view.width, height: view.height };
};

describe('PositionController', () => {
  it('places the surface below the anchor, aligned to its start, before the next frame', async () => {
    const { anchor, surface } = fixture(100, 100);
    position(anchor, surface, { offset: 4 });
    surface.showPopover();
    await settle();
    expect(rect(surface)).toEqual({ left: 100, top: 124, right: 200, bottom: 174 });
  });

  it('aligns to the start edge in right-to-left text, and centres or aligns the end on request', async () => {
    container.dir = 'rtl';
    const { anchor, surface } = fixture(100, 100);
    const { controller } = position(anchor, surface);
    surface.showPopover();
    await settle();
    expect(rect(surface).right).toBe(180);
    surface.hidePopover();
    scope.dispose();
    scope = createScope({ name: 'center' });
    position(anchor, surface, { align: 'center' });
    surface.showPopover();
    await settle();
    expect(rect(surface).left).toBe(90);
    expect(controller.placement?.side).toBe('block-end');
  });

  it('flips to the opposite side when the surface does not fit and that side has more room', async () => {
    const { height } = viewport();
    const { anchor, surface } = fixture(100, height - 30);
    const { placements } = position(anchor, surface, { offset: 4 });
    surface.showPopover();
    await settle();
    expect(rect(surface).bottom).toBe(height - 30 - 4);
    expect(placements.at(-1)?.side).toBe('block-start');
  });

  it('keeps the preferred side when flipping is off', async () => {
    const { height } = viewport();
    const { anchor, surface } = fixture(100, height - 30);
    position(anchor, surface, { flip: false });
    surface.showPopover();
    await settle();
    expect(rect(surface).top).toBe(height - 10);
  });

  it('shifts along the other axis to stay inside the viewport margin', async () => {
    const { width } = viewport();
    const { anchor, surface } = fixture(width - 40, 100);
    position(anchor, surface, { viewportMargin: 8 });
    surface.showPopover();
    await settle();
    expect(rect(surface).right).toBe(Math.round(width - 8));
  });

  it('resolves inline sides through the direction', async () => {
    const { anchor, surface } = fixture(200, 100);
    position(anchor, surface, { side: 'inline-end', offset: 4 });
    surface.showPopover();
    await settle();
    expect(rect(surface)).toMatchObject({ left: 284, top: 100 });
    surface.hidePopover();
    container.dir = 'rtl';
    surface.showPopover();
    await settle();
    expect(rect(surface)).toMatchObject({ right: 196, top: 100 });
  });

  it('resolves block sides through a vertical writing mode', async () => {
    container.style.setProperty('writing-mode', 'vertical-rl');
    const { anchor, surface } = fixture(300, 100);
    position(anchor, surface, { offset: 4 });
    surface.showPopover();
    await settle();
    // vertical-rl: block-end is the left, inline-start the top.
    expect(rect(surface)).toMatchObject({ right: 296, top: 100 });
  });

  it('reports the room on the side used', async () => {
    const { height, width } = viewport();
    const { anchor, surface } = fixture(100, 100);
    const { placements } = position(anchor, surface, { offset: 4, viewportMargin: 8 });
    surface.showPopover();
    await settle();
    const placement = placements.at(-1)!;
    expect(placement.availableHeight).toBe(height - 8 - 120 - 4);
    expect(placement.availableWidth).toBe(width - 16);
    expect(placement.anchor.top).toBe(100);
  });

  it('follows scrolling in containers outside a shadow root only while open', async () => {
    const scroller = styled(document.createElement('div'), {
      overflow: 'auto',
      height: '200px',
      position: 'relative',
    });
    const host = document.createElement('div');
    scroller.append(host, styled(document.createElement('div'), { height: '1000px' }));
    container.append(scroller);
    const root = host.attachShadow({ mode: 'open' });
    const anchor = styled(document.createElement('button'), {
      display: 'block',
      height: '20px',
      width: '80px',
      margin: '100px 0 0',
    });
    const surface = styled(document.createElement('div'), {
      width: '100px',
      height: '50px',
      padding: '0',
      border: '0',
    });
    surface.popover = 'manual';
    root.append(anchor, surface);
    position(anchor, surface);
    surface.showPopover();
    await settle();
    // The size observer's first delivery re-places; scroll only after it.
    await frames();
    const before = rect(surface).top;
    scroller.scrollTop = 30;
    await frames();
    expect(rect(surface).top).toBe(before - 30);
    surface.hidePopover();
    await frames();
    const closedTop = surface.style.getPropertyValue('top');
    scroller.scrollTop = 60;
    await frames();
    expect(surface.style.getPropertyValue('top')).toBe(closedTop);
    surface.showPopover();
    await settle();
    expect(rect(surface).top).toBe(before - 60);
  });

  it('follows the anchor resizing', async () => {
    const { anchor, surface } = fixture(100, 100);
    position(anchor, surface);
    surface.showPopover();
    await settle();
    await frames();
    anchor.style.setProperty('height', '40px');
    await frames();
    expect(rect(surface).top).toBe(140);
  });

  it('stops listening when its scope is disposed', async () => {
    const { anchor, surface } = fixture(100, 100);
    position(anchor, surface);
    surface.showPopover();
    await settle();
    scope.dispose();
    anchor.style.setProperty('height', '40px');
    window.dispatchEvent(new Event('resize'));
    await frames();
    expect(rect(surface).top).toBe(120);
    surface.hidePopover();
    surface.style.removeProperty('top');
    surface.showPopover();
    await settle();
    expect(surface.style.getPropertyValue('top')).toBe('');
  });

  it('places a surface that was already open when it connects', async () => {
    const { anchor, surface } = fixture(100, 100);
    surface.showPopover();
    position(anchor, surface);
    expect(rect(surface).top).toBe(120);
  });

  it('keeps the surface in place in the DOM, so scopes and direction are inherited', async () => {
    container.style.setProperty('--probe', 'rgb(1, 2, 3)');
    container.dir = 'rtl';
    const { anchor, surface } = fixture(100, 100);
    surface.style.setProperty('color', 'var(--probe)');
    position(anchor, surface);
    surface.showPopover();
    await settle();
    expect(surface.parentElement).toBe(container);
    expect(getComputedStyle(surface).color).toBe('rgb(1, 2, 3)');
    expect(getComputedStyle(surface).direction).toBe('rtl');
  });
});
