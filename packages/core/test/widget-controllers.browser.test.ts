import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { ActiveDescendant } from '../src/controllers/active-descendant.js';
import { ResizeHandle } from '../src/controllers/resize.js';
import { Typeahead } from '../src/controllers/typeahead.js';
import { flush } from '../src/reactive/index.js';
import { createScope, scopeStats, type Scope } from '../src/scope/index.js';

let container: HTMLElement;
let scope: Scope;
let baseline: ReturnType<typeof scopeStats>;

beforeEach(() => {
  baseline = scopeStats();
  container = document.createElement('div');
  document.body.append(container);
  scope = createScope({ name: 'test' });
});
afterEach(() => {
  scope.dispose();
  flush();
  container.remove();
  expect(scopeStats()).toEqual(baseline);
});

const key = (target: Element, name: string, init: KeyboardEventInit = {}) =>
  target.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: name,
      bubbles: true,
      composed: true,
      cancelable: true,
      ...init,
    }),
  );

const listbox = (markup: string) => {
  container.innerHTML = `<div role="listbox" tabindex="0" aria-label="Fruit">${markup}</div>`;
  const box = container.firstElementChild as HTMLElement;
  const items = () => [...box.querySelectorAll<HTMLElement>('[role="option"]')];
  return { box, items };
};

describe('Typeahead (keys)', () => {
  const setup = (markup: string, before?: (box: HTMLElement) => void) => {
    const { box, items } = listbox(markup);
    before?.(box);
    let active = -1;
    const moved: string[] = [];
    const typeahead = scope.use(
      new Typeahead({
        target: () => box,
        items,
        active: () => active,
        onMatch: (index, item) => {
          active = index;
          moved.push(item.textContent!);
        },
      }),
    );
    return { box, items, moved, typeahead };
  };

  it('moves on real typing, skipping disabled, aria-disabled, and hidden items by default', async () => {
    const { box, moved } = setup(
      '<div role="option">Cherry</div><button role="option" disabled>Cranberry</button>' +
        '<div role="option" aria-disabled="true">Currant</div><div role="option" hidden>Citron</div>' +
        '<div role="option"> Clementine </div>',
    );
    box.focus();
    await userEvent.keyboard('c');
    await userEvent.keyboard('c');
    expect(moved).toEqual(['Cherry', ' Clementine ']);
  });

  it('listens in the capture phase: the widget’s own handler sees the keys typeahead used', () => {
    const seen: [string, boolean][] = [];
    // Registered first, on the focused element itself, as a template's listener is.
    const { box, typeahead } = setup(
      '<div role="option">New file</div><div role="option">New folder</div>',
      (box) =>
        box.addEventListener('keydown', (event) => seen.push([event.key, event.defaultPrevented])),
    );
    key(box, ' ');
    key(box, 'n');
    key(box, ' ');
    key(box, 'Enter');
    expect(seen).toEqual([
      [' ', false],
      ['n', true],
      [' ', true],
      ['Enter', false],
    ]);
    expect(typeahead.query).toBe('n ');
  });

  it('ignores modified keys, composition, keys already handled, and typing in a text field inside the widget', () => {
    const { box, moved, typeahead } = setup(
      '<input aria-label="Filter"><div role="option">Apple</div>',
    );
    const input = box.querySelector('input')!;
    expect(key(input, 'a')).toBe(true);
    expect(key(box, 'a', { ctrlKey: true })).toBe(true);
    expect(key(box, 'a', { metaKey: true })).toBe(true);
    expect(key(box, 'a', { altKey: true })).toBe(true);
    expect(key(box, 'a', { isComposing: true })).toBe(true);
    container.addEventListener('keydown', (event) => event.preventDefault(), { capture: true });
    expect(key(box, 'a')).toBe(false);
    expect(moved).toEqual([]);
    expect(typeahead.query).toBe('');
  });

  it('stops listening when its scope is disposed', () => {
    const own = scope.child();
    const { box, items } = listbox('<div role="option">Apple</div>');
    const moved: number[] = [];
    own.use(
      new Typeahead({ target: () => box, items, active: () => -1, onMatch: (i) => moved.push(i) }),
    );
    own.dispose();
    expect(key(box, 'a')).toBe(true);
    expect(moved).toEqual([]);
  });
});

describe('ActiveDescendant', () => {
  const setup = (
    markup: string,
    options: Partial<ConstructorParameters<typeof ActiveDescendant>[0]> = {},
  ) => {
    const { box, items } = listbox(markup);
    const changes: [number, string | undefined, boolean | undefined][] = [];
    const ad = scope.use(
      new ActiveDescendant({
        target: () => box,
        items,
        onActiveChange: (index, item, event) =>
          changes.push([index, item?.textContent ?? undefined, event?.shiftKey]),
        ...options,
      }),
    );
    return { box, items, ad, changes };
  };
  const named = (box: HTMLElement) =>
    box.getAttribute('aria-activedescendant') === null
      ? null
      : box.querySelector(`#${box.getAttribute('aria-activedescendant')}`)?.textContent;

  it('keeps DOM focus on the target while real arrow keys, Home, and End move the active item', async () => {
    const { box, items, ad } = setup(
      '<div role="option" id="a">A</div><div role="option">B</div><div role="option">C</div>',
    );
    box.focus();
    expect(box.hasAttribute('aria-activedescendant')).toBe(false);
    await userEvent.keyboard('{ArrowDown}');
    expect(box.getAttribute('aria-activedescendant')).toBe('a');
    await userEvent.keyboard('{ArrowDown}');
    // An item without an id gets a generated one.
    expect(items()[1]!.id).toMatch(/^active-descendant-\d+$/);
    expect(named(box)).toBe('B');
    await userEvent.keyboard('{End}');
    expect(named(box)).toBe('C');
    await userEvent.keyboard('{Home}');
    expect(named(box)).toBe('A');
    expect(document.activeElement).toBe(box);
    expect(ad.activeIndex).toBe(0);
    expect(ad.activeItem).toBe(items()[0]);
  });

  it('stops at the ends without wrapping by default, keeping the keys from scrolling the page', () => {
    const { box, changes } = setup('<div role="option">A</div><div role="option">B</div>');
    expect(key(box, 'ArrowUp')).toBe(false);
    expect(named(box)).toBe('B');
    expect(key(box, 'ArrowDown')).toBe(false);
    expect(named(box)).toBe('B');
    key(box, 'ArrowUp');
    expect(key(box, 'ArrowUp')).toBe(false);
    expect(named(box)).toBe('A');
    expect(changes.map(([index]) => index)).toEqual([1, 0]);
  });

  it('wraps when asked, skipping disabled, aria-disabled, and hidden items', () => {
    const { box } = setup(
      '<div role="option">A</div><button role="option" disabled>B</button>' +
        '<div role="option" aria-disabled="true">C</div><div role="option" hidden>D</div>' +
        '<div role="option">E</div>',
      { wrap: true },
    );
    key(box, 'ArrowDown');
    key(box, 'ArrowDown');
    expect(named(box)).toBe('E');
    key(box, 'ArrowDown');
    expect(named(box)).toBe('A');
    key(box, 'ArrowUp');
    expect(named(box)).toBe('E');
    key(box, 'End');
    expect(named(box)).toBe('E');
  });

  it('moves horizontally, mirrored in right-to-left text, and leaves the other axis alone', () => {
    const { box } = setup('<div role="option">A</div><div role="option">B</div>', {
      orientation: 'horizontal',
    });
    expect(key(box, 'ArrowDown')).toBe(true);
    expect(named(box)).toBe(null);
    key(box, 'ArrowRight');
    key(box, 'ArrowRight');
    expect(named(box)).toBe('B');
    box.dir = 'rtl';
    key(box, 'ArrowRight');
    expect(named(box)).toBe('A');
    key(box, 'ArrowLeft');
    expect(named(box)).toBe('B');
  });

  it('moves on both axes when asked', () => {
    const { box } = setup('<div role="option">A</div><div role="option">B</div>', {
      orientation: 'both',
    });
    key(box, 'ArrowRight');
    key(box, 'ArrowDown');
    expect(named(box)).toBe('B');
    key(box, 'ArrowLeft');
    expect(named(box)).toBe('A');
  });

  it('leaves Home, End, and modified keys to a text field, and reports the key that moved', () => {
    container.innerHTML =
      '<input role="combobox" aria-label="Fruit"><div role="listbox"><div role="option">A</div><div role="option">B</div></div>';
    const input = container.querySelector('input')!;
    const changes: (boolean | undefined)[] = [];
    scope.use(
      new ActiveDescendant({
        target: () => input,
        items: () => [...container.querySelectorAll<HTMLElement>('[role="option"]')],
        homeEnd: false,
        onActiveChange: (_index, _item, event) => changes.push(event?.shiftKey),
      }),
    );
    expect(key(input, 'Home')).toBe(true);
    expect(key(input, 'End')).toBe(true);
    expect(key(input, 'ArrowDown', { altKey: true })).toBe(true);
    expect(key(input, 'ArrowDown', { ctrlKey: true })).toBe(true);
    expect(key(input, 'ArrowDown', { metaKey: true })).toBe(true);
    expect(input.hasAttribute('aria-activedescendant')).toBe(false);
    key(input, 'ArrowDown');
    key(input, 'ArrowDown', { shiftKey: true });
    expect(changes).toEqual([false, true]);
    // Handled elsewhere first: not moved.
    input.addEventListener('keydown', (event) => event.preventDefault(), { capture: true });
    key(input, 'ArrowUp');
    expect(changes).toEqual([false, true]);
  });

  it('follows the active item through reordering and drops it when removed or disabled', () => {
    const { box, items, ad, changes } = setup(
      '<div role="option">A</div><div role="option">B</div><div role="option">C</div>',
    );
    ad.setActive(1);
    expect(named(box)).toBe('B');
    box.prepend(items()[2]!);
    ad.sync();
    expect(ad.activeIndex).toBe(2);
    expect(named(box)).toBe('B');
    key(box, 'ArrowUp');
    expect(named(box)).toBe('A');
    items()[1]!.setAttribute('aria-disabled', 'true');
    ad.sync();
    expect(named(box)).toBe(null);
    ad.setActive(2);
    items()[2]!.remove();
    ad.sync();
    expect(ad.activeItem).toBe(undefined);
    expect(changes.map(([index]) => index)).toEqual([1, 1, -1, 2, -1]);
  });

  it('drops an active item the items no longer include, even while it is still shown', () => {
    const { box, ad } = setup('<div role="option">A</div><div role="option">B</div>', {
      items: () => [...box.querySelectorAll<HTMLElement>('[role="option"]:not(.out)')],
    });
    ad.setActive(1);
    box.lastElementChild!.classList.add('out');
    ad.sync();
    expect(ad.activeItem).toBe(undefined);
    expect(box.hasAttribute('aria-activedescendant')).toBe(false);
  });

  it('does not activate a skipped or missing item, and setActive(-1) clears', () => {
    const { box, ad, changes } = setup(
      '<div role="option" aria-disabled="true">A</div><div role="option">B</div>',
    );
    ad.setActive(0);
    ad.setActive(5);
    expect(box.hasAttribute('aria-activedescendant')).toBe(false);
    ad.setActive(1);
    expect(named(box)).toBe('B');
    ad.setActive(1);
    expect(changes).toHaveLength(1);
    ad.setActive(-1);
    expect(box.hasAttribute('aria-activedescendant')).toBe(false);
    expect(ad.activeIndex).toBe(-1);
  });

  it('scrolls the active item into view unless told not to', () => {
    const rows = Array.from(
      { length: 30 },
      (_, i) => `<div role="option" style="height:20px">${i}</div>`,
    );
    const { box, ad } = setup(rows.join(''));
    box.style.cssText = 'height:100px;overflow:auto';
    ad.setActive(20, { scroll: false });
    expect(box.scrollTop).toBe(0);
    ad.setActive(25);
    expect(box.scrollTop).toBeGreaterThan(0);
    const top = box.scrollTop;
    key(box, 'Home');
    expect(box.scrollTop).toBeLessThan(top);
  });

  it('works inside a shadow root and stops on dispose', () => {
    const host = document.createElement('div');
    container.append(host);
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML =
      '<div role="listbox" tabindex="0"><div role="option">A</div><div role="option">B</div></div>';
    const box = root.querySelector<HTMLElement>('[role="listbox"]')!;
    const own = scope.child();
    const ad = own.use(
      new ActiveDescendant({
        target: () => box,
        items: () => [...root.querySelectorAll<HTMLElement>('[role="option"]')],
      }),
    );
    key(box, 'ArrowDown');
    const id = box.getAttribute('aria-activedescendant')!;
    expect(root.getElementById(id)?.textContent).toBe('A');
    own.dispose();
    expect(key(box, 'ArrowDown')).toBe(true);
    ad.setActive(1);
    expect(box.getAttribute('aria-activedescendant')).toBe(id);
  });

  it('does nothing without a target', () => {
    const ad = scope.use(new ActiveDescendant({ target: () => null, items: () => [] }));
    ad.setActive(0);
    expect(ad.activeItem).toBe(undefined);
  });

  it('clears a reference left from before it connected', () => {
    const { box } = listbox('<div role="option" id="x">A</div>');
    box.setAttribute('aria-activedescendant', 'x');
    scope.use(new ActiveDescendant({ target: () => box, items: () => [] }));
    expect(box.hasAttribute('aria-activedescendant')).toBe(false);
  });
});

describe('ResizeHandle', () => {
  const setup = (
    options: Partial<ConstructorParameters<typeof ResizeHandle>[0]> = {},
    dir: 'ltr' | 'rtl' = 'ltr',
  ) => {
    container.innerHTML = `<div dir="${dir}" style="position:fixed;left:100px;top:50px;width:400px;height:200px;display:flex">
      <div class="start" style="flex:1"></div>
      <div role="separator" tabindex="0" aria-label="Resize" style="width:8px;touch-action:none"></div>
      <div class="end" style="flex:1"></div></div>`;
    const box = container.firstElementChild as HTMLElement;
    const handle = box.querySelector<HTMLElement>('[role="separator"]')!;
    let value = 50;
    const log: string[] = [];
    const resize = scope.use(
      new ResizeHandle({
        handle: () => handle,
        container: () => box,
        value: () => value,
        onInput: (next) => {
          value = next;
          log.push(`input ${next}`);
        },
        onChange: (next) => log.push(`change ${next}`),
        onDrag: (dragging) => log.push(dragging ? 'drag' : 'drop'),
        ...options,
      }),
    );
    return { box, handle, log, resize, value: () => value };
  };
  const pointer = (
    target: EventTarget,
    type: string,
    clientX: number,
    clientY = 100,
    init: PointerEventInit = {},
  ) =>
    target.dispatchEvent(
      new PointerEvent(type, {
        pointerId: 7,
        isPrimary: true,
        button: type === 'pointermove' ? -1 : 0,
        clientX,
        clientY,
        bubbles: true,
        composed: true,
        cancelable: true,
        ...init,
      }),
    );

  it('steps with the inline arrows, goes to the limits with Home and End, and commits each key', () => {
    const { handle, log } = setup({ min: () => 10, max: () => 80, step: 5 });
    expect(key(handle, 'ArrowRight')).toBe(false);
    expect(key(handle, 'ArrowLeft')).toBe(false);
    key(handle, 'ArrowLeft');
    key(handle, 'Home');
    expect(key(handle, 'Home')).toBe(false);
    key(handle, 'End');
    expect(log).toEqual([
      'input 55',
      'change 55',
      'input 50',
      'change 50',
      'input 45',
      'change 45',
      'input 10',
      'change 10',
      'input 80',
      'change 80',
    ]);
    // Up and Down belong to stacked panes; modified keys to the page.
    expect(key(handle, 'ArrowUp')).toBe(true);
    expect(key(handle, 'ArrowLeft', { ctrlKey: true })).toBe(true);
    expect(log).toHaveLength(10);
  });

  it('mirrors the inline arrows in right-to-left text', () => {
    const { handle, value } = setup({}, 'rtl');
    key(handle, 'ArrowRight');
    expect(value()).toBe(49);
    key(handle, 'ArrowLeft');
    key(handle, 'ArrowLeft');
    expect(value()).toBe(51);
  });

  it('uses Up and Down for stacked panes, reading the orientation on each key', () => {
    let orientation: 'horizontal' | 'vertical' = 'vertical';
    const { handle, value } = setup({ orientation: () => orientation });
    expect(key(handle, 'ArrowRight')).toBe(true);
    key(handle, 'ArrowDown');
    expect(value()).toBe(51);
    key(handle, 'ArrowUp');
    key(handle, 'ArrowUp');
    expect(value()).toBe(49);
    orientation = 'horizontal';
    key(handle, 'ArrowRight');
    expect(value()).toBe(50);
  });

  it('drags by the distance moved, clamped, focusing the handle and committing once on release', () => {
    const { handle, log, resize } = setup({ min: () => 20, max: () => 75 });
    // Pressed off-centre at x = 250: no jump to the pointer.
    expect(pointer(handle, 'pointerdown', 250)).toBe(false);
    expect(document.activeElement).toBe(handle);
    expect(resize.dragging).toBe(true);
    pointer(document, 'pointermove', 290);
    pointer(document, 'pointermove', 290);
    pointer(handle, 'pointermove', 500);
    pointer(document, 'pointermove', 150, 100, { pointerId: 8 });
    pointer(document, 'pointermove', 0);
    pointer(document, 'pointerup', 0);
    expect(resize.dragging).toBe(false);
    pointer(document, 'pointermove', 250);
    expect(log).toEqual(['drag', 'input 60', 'input 75', 'input 20', 'drop', 'change 20']);
  });

  it('mirrors dragging in right-to-left text and follows the block axis for stacked panes', () => {
    const rtl = setup({}, 'rtl');
    pointer(rtl.handle, 'pointerdown', 300);
    pointer(document, 'pointermove', 260);
    pointer(document, 'pointerup', 260);
    expect(rtl.value()).toBe(60);
    const stacked = setup({ orientation: () => 'vertical' });
    pointer(stacked.handle, 'pointerdown', 0, 150);
    pointer(document, 'pointermove', 999, 170);
    pointer(document, 'pointercancel', 999, 170);
    expect(stacked.value()).toBe(60);
    expect(stacked.log).toEqual(['drag', 'input 60', 'drop', 'change 60']);
  });

  it('does not commit a drag that ends where it started, and ignores other buttons and pointers', () => {
    const { handle, log } = setup();
    pointer(handle, 'pointerdown', 300, 100, { button: 2 });
    pointer(handle, 'pointerdown', 300, 100, { isPrimary: false });
    expect(log).toEqual([]);
    pointer(handle, 'pointerdown', 300);
    pointer(handle, 'pointerdown', 100, 100, { pointerId: 9 });
    pointer(document, 'pointermove', 340);
    pointer(document, 'pointerup', 340, 100, { pointerId: 9 });
    pointer(document, 'pointercancel', 340, 100, { pointerId: 9 });
    pointer(document, 'pointermove', 300);
    pointer(document, 'pointerup', 300);
    expect(log).toEqual(['drag', 'input 60', 'input 50', 'drop']);
  });

  it('ignores a drag when the container has no size', () => {
    const { box, handle, log, resize } = setup();
    box.style.width = '0';
    box.style.display = 'block';
    pointer(handle, 'pointerdown', 300);
    expect(resize.dragging).toBe(false);
    expect(log).toEqual([]);
  });

  it('drags with a real pointer, captured by the handle', async () => {
    const { box, handle, value, log } = setup();
    const marker = document.createElement('div');
    marker.style.cssText = 'position:fixed;left:390px;top:140px;width:20px;height:20px';
    box.append(marker);
    let captured = false;
    handle.addEventListener('gotpointercapture', () => (captured = true));
    await userEvent.dragAndDrop(handle, marker);
    // The handle's centre (x = 300) moved to the marker's centre (x = 400): 100 px of 400.
    expect(value()).toBeCloseTo(75, 0);
    expect(log.at(-1)).toMatch(/^change /);
    // Captured, so a release outside the window still ends the drag.
    expect(captured).toBe(true);
  });

  it('releases the drag listeners when its scope is disposed mid-drag', () => {
    const own = scope.child();
    container.innerHTML = '<div style="width:400px;height:100px"><div tabindex="0">|</div></div>';
    const box = container.firstElementChild as HTMLElement;
    const handle = box.firstElementChild as HTMLElement;
    const inputs: number[] = [];
    const resize = own.use(
      new ResizeHandle({
        handle: () => handle,
        container: () => box,
        value: () => 50,
        onInput: (v) => inputs.push(v),
      }),
    );
    pointer(handle, 'pointerdown', 200);
    const during = scopeStats();
    expect(during.listeners).toBeGreaterThan(baseline.listeners + 2);
    own.dispose();
    expect(resize.dragging).toBe(false);
    pointer(document, 'pointermove', 240);
    expect(key(handle, 'ArrowRight')).toBe(true);
    expect(inputs).toEqual([]);
  });

  it('does nothing without a handle or a container', () => {
    scope.use(
      new ResizeHandle({
        handle: () => null,
        container: () => null,
        value: () => 0,
        onInput: () => {},
      }),
    );
    container.innerHTML = '<div tabindex="0"></div>';
    const handle = container.firstElementChild as HTMLElement;
    const inputs: number[] = [];
    const resize = scope.use(
      new ResizeHandle({
        handle: () => handle,
        container: () => null,
        value: () => 0,
        onInput: (v) => inputs.push(v),
      }),
    );
    pointer(handle, 'pointerdown', 10);
    expect(resize.dragging).toBe(false);
    key(handle, 'End');
    expect(inputs).toEqual([100]);
  });
});
