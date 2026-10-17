import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setErrorHandler, type ErrorContext } from '../src/diagnostics/index.js';
import { classMap } from '../src/helpers/class-map.js';
import { live } from '../src/helpers/live.js';
import { createRef, ref } from '../src/helpers/ref.js';
import { styleMap } from '../src/helpers/style-map.js';
import { effect, flush, signal } from '../src/reactive/index.js';
import { html, render } from '../src/template/index.js';

let reported: ErrorContext[];
let container: HTMLElement;

beforeEach(() => {
  reported = [];
  setErrorHandler((_error, context) => reported.push(context));
  container = document.createElement('div');
  document.body.append(container);
});

afterEach(() => {
  flush();
  container.remove();
  setErrorHandler(undefined);
});

const codeOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (error) {
    return (error as { code?: string }).code;
  }
  return undefined;
};

describe('classMap', () => {
  it('toggles its classes and leaves static and external classes alone', () => {
    const view = (active: boolean) =>
      html`<p class="static" class=${classMap({ active, 'a b': !active })}></p>`;
    render(view(true), container);
    const p = container.querySelector('p') as HTMLElement;
    p.classList.add('external');
    expect([...p.classList].sort()).toEqual(['active', 'external', 'static']);
    render(view(false), container);
    expect([...p.classList].sort()).toEqual(['a', 'b', 'external', 'static']);
  });

  it('binds readable values without re-rendering and clears on removal', () => {
    const on = signal(false);
    const root = render(html`<p class=${classMap({ on })}></p>`, container);
    const p = container.querySelector('p') as HTMLElement;
    on.value = true;
    flush();
    expect(p.classList.contains('on')).toBe(true);
    root.dispose();
    expect(p.classList.contains('on')).toBe(false);
  });

  it('must be the whole value of a class binding', () => {
    expect(codeOf(() => render(html`<p title=${classMap({ a: true })}></p>`, container))).toBe(
      'template.directive.binding',
    );
    const other = document.createElement('div');
    expect(codeOf(() => render(html`<p class="x ${classMap({ a: true })}"></p>`, other))).toBe(
      'template.directive.position',
    );
  });
});

describe('styleMap', () => {
  it('sets properties through the CSSOM, including custom properties and !important', () => {
    const view = (styles: Parameters<typeof styleMap>[0]) =>
      html`<p style=${styleMap(styles)}></p>`;
    render(
      view({ backgroundColor: 'rgb(1, 2, 3)', '--accent': 'blue', marginTop: '4px !important' }),
      container,
    );
    const p = container.querySelector('p') as HTMLElement;
    expect(p.style.backgroundColor).toBe('rgb(1, 2, 3)');
    expect(p.style.getPropertyValue('--accent').trim()).toBe('blue');
    expect(p.style.getPropertyPriority('margin-top')).toBe('important');
    render(view({ '--accent': null, marginTop: false }), container);
    expect([
      p.style.backgroundColor,
      p.style.getPropertyValue('--accent'),
      p.style.marginTop,
    ]).toEqual(['', '', '']);
  });

  it('updates readable values', () => {
    const width = signal('10px');
    render(html`<p style=${styleMap({ width })}></p>`, container);
    width.value = '20px';
    flush();
    expect((container.querySelector('p') as HTMLElement).style.width).toBe('20px');
  });
});

describe('ref', () => {
  it('holds the element while rendered and clears it when the template is removed', () => {
    const input = createRef<HTMLInputElement>();
    const seen: Array<string | undefined> = [];
    const stop = effect(() => {
      seen.push(input.value?.localName);
    });
    const view = (show: boolean) => (show ? html`<input ref=${input} />` : html`<span></span>`);
    render(view(true), container);
    flush();
    expect(input.value).toBe(container.querySelector('input'));
    expect(input.value?.hasAttribute('ref')).toBe(false);
    render(view(false), container);
    flush();
    expect(input.value).toBeUndefined();
    expect(seen).toEqual([undefined, 'input', undefined]);
    stop();
  });

  it('calls callback refs with the element and then undefined', () => {
    const calls: Array<string | undefined> = [];
    const root = render(html`<b ref=${ref((el) => calls.push(el?.localName))}></b>`, container);
    render(html`<b ref=${ref((el) => calls.push(el?.localName))}></b>`, container);
    root.dispose();
    expect(calls).toEqual(['b', undefined, 'b', undefined]);
  });
});

describe('live', () => {
  it('restores an edited field even when the model value did not change', () => {
    const view = (value: string) => html`<input .value=${live(value)} />`;
    render(view('model'), container);
    const input = container.querySelector('input') as HTMLInputElement;
    input.value = 'user typed';
    render(view('model'), container);
    expect(input.value).toBe('model');
  });

  it('defers writes during IME composition', () => {
    const model = signal('a');
    render(html`<input .value=${live(model)} />`, container);
    const input = container.querySelector('input') as HTMLInputElement;
    input.dispatchEvent(new CompositionEvent('compositionstart'));
    model.value = 'b';
    flush();
    expect(input.value).toBe('a');
    input.dispatchEvent(new CompositionEvent('compositionend'));
    expect(input.value).toBe('b');
  });

  it('keeps the caret when updating a focused field', () => {
    const model = signal('hello world');
    render(html`<input .value=${live(model)} />`, container);
    const input = container.querySelector('input') as HTMLInputElement;
    input.focus();
    input.setSelectionRange(5, 5);
    model.value = 'hello there world';
    flush();
    expect([input.value, input.selectionStart, input.selectionEnd]).toEqual([
      'hello there world',
      5,
      5,
    ]);
  });

  it('is limited to property bindings', () => {
    expect(codeOf(() => render(html`<input value=${live('x')} />`, container))).toBe(
      'template.directive.binding',
    );
  });
});

describe('event options', () => {
  it('applies once, capture, and re-adds only when options change', () => {
    const calls: string[] = [];
    const once = { handleEvent: () => calls.push('once'), once: true };
    const view = (handler: unknown) => html`<button @click=${handler}>x</button>`;
    render(view(once), container);
    const button = container.querySelector('button') as HTMLButtonElement;
    button.click();
    button.click();
    expect(calls).toEqual(['once']);

    const order: string[] = [];
    render(
      html`<div @click=${{ handleEvent: () => order.push('capture'), capture: true }}>
        <button @click=${() => order.push('target')}>y</button>
      </div>`,
      container,
    );
    (container.querySelector('div button') as HTMLButtonElement).click();
    expect(order).toEqual(['capture', 'target']);
  });

  it('marks passive listeners so preventDefault is ignored', () => {
    let prevented: boolean | undefined;
    render(
      html`<div
        @wheel=${{
          passive: true,
          handleEvent: (e: Event) => {
            e.preventDefault();
            prevented = e.defaultPrevented;
          },
        }}
      ></div>`,
      container,
    );
    (container.querySelector('div') as HTMLElement).dispatchEvent(
      new WheelEvent('wheel', { cancelable: true }),
    );
    expect(prevented).toBe(false);
  });
});
