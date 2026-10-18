import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { OddkinError, setErrorHandler, type ErrorContext } from '../src/diagnostics/index.js';
import {
  compose,
  define,
  isElementDefinition,
  OddkinElement,
  prop,
  type ElementDefinition,
} from '../src/element/index.js';
import { flush, signal } from '../src/reactive/index.js';
import type { Scope } from '../src/scope/index.js';
import { scopeStats } from '../src/scope/scope.js';
import { css } from '../src/styles/index.js';
import { html } from '../src/template/index.js';

let reported: ErrorContext[];
let container: HTMLElement;
let id = 0;
const tag = (base: string) => `${base}-${++id}`;

beforeEach(() => {
  reported = [];
  setErrorHandler((_error, context) => reported.push(context));
  container = document.createElement('div');
  document.body.append(container);
});

afterEach(() => {
  container.remove();
  flush();
  setErrorHandler(undefined);
});

function mount<E extends HTMLElement>(name: string): E {
  const el = document.createElement(name) as E;
  container.append(el);
  return el;
}

const codeOf = (run: () => unknown) => {
  try {
    run();
  } catch (error) {
    return (error as OddkinError).code;
  }
  return undefined;
};

// A behavior class with no render() and no styles; template and styles live outside it.
class Card extends OddkinElement.with({
  heading: prop.string({ default: 'Title', attribute: 'heading' }),
}) {
  readonly count = signal(0);
  templateRuns = 0;
  readonly increment = (): void => this.count.update((value) => value + 1);
}

const cardTemplate = (card: Card) => {
  card.templateRuns++;
  return html`<article part="base">
    <h2>${card.heading}</h2>
    <button type="button" @click=${card.increment}>${card.count}</button>
    <slot></slot>
  </article>`;
};
const cardStructuralStyles = css`
  :host {
    display: block;
  }
`;
const cardStyles = css`
  article {
    padding: 4px;
  }
`;
const cardDefinition = compose({
  name: tag('demo-card'),
  element: Card,
  template: cardTemplate,
  styles: [cardStructuralStyles, cardStyles],
});
define(cardDefinition);

describe('compose()', () => {
  it('returns a frozen definition that identifies itself as its source', () => {
    expect(Object.isFrozen(cardDefinition)).toBe(true);
    expect(cardDefinition.source).toBe(cardDefinition);
    expect(cardDefinition.extends).toBeUndefined();
    expect(isElementDefinition(cardDefinition)).toBe(true);
    expect(isElementDefinition({ ...cardDefinition })).toBe(false);
  });

  it('rejects invalid inputs with stable codes', () => {
    expect(codeOf(() => compose({ name: 'x-y', element: undefined as never }))).toBe(
      'definition.element.invalid',
    );
    expect(codeOf(() => compose({ name: 'x-y', element: Card, template: 'nope' as never }))).toBe(
      'definition.template.invalid',
    );
    expect(
      codeOf(() =>
        compose({ name: 'x-y', element: Card, dependencies: { child: {} as ElementDefinition } }),
      ),
    ).toBe('definition.dependency.invalid');
    expect(codeOf(() => define({ name: 'x-y' } as never))).toBe('registry.definition.invalid');
  });
});

describe('external templates', () => {
  it('render in shadow DOM and keep the binding rule: direct bindings skip the template', async () => {
    const el = mount<Card>(cardDefinition.name);
    const button = el.shadowRoot!.querySelector('button')!;
    expect(el.shadowRoot!.querySelector('h2')!.textContent).toBe('Title');
    expect(el.templateRuns).toBe(1);

    button.click();
    await el.updateComplete;
    expect(button.textContent).toBe('1');
    expect(el.templateRuns).toBe(1);
    // DOM identity survives the update.
    expect(el.shadowRoot!.querySelector('button')).toBe(button);
  });

  it('track .value reads like render(): a tracked read re-runs the template once per batch', async () => {
    class Tracked extends OddkinElement {
      readonly a = signal(1);
      readonly b = signal(2);
      runs = 0;
    }
    const definition = compose({
      name: tag('demo-tracked'),
      element: Tracked,
      template: (host) => {
        host.runs++;
        return html`<p>${host.a.value + host.b.value}</p>`;
      },
    });
    define(definition);
    const el = mount<Tracked>(definition.name);
    el.a.value = 10;
    el.b.value = 20;
    await el.updateComplete;
    expect(el.shadowRoot!.textContent).toBe('30');
    expect(el.runs).toBe(2);
  });

  it('public property writes update attribute-driven bindings', async () => {
    const el = mount<Card>(cardDefinition.name);
    el.setAttribute('heading', 'Changed');
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('h2')!.textContent).toBe('Changed');
  });
});

describe('definition styles', () => {
  it('apply in order and share one sheet per document across instances', () => {
    const a = mount<Card>(cardDefinition.name);
    const b = mount<Card>(cardDefinition.name);
    const sheetsA = a.shadowRoot!.adoptedStyleSheets;
    expect(sheetsA).toHaveLength(2);
    expect(sheetsA[0]).toBe(b.shadowRoot!.adoptedStyleSheets[0]);
    expect(sheetsA[1]).toBe(b.shadowRoot!.adoptedStyleSheets[1]);
    expect(getComputedStyle(a).display).toBe('block');
  });

  it('replace the class static styles; a definition without styles uses them', () => {
    class Styled extends OddkinElement {
      static override styles = css`
        :host {
          display: inline-block;
        }
      `;
    }
    const withStyles = compose({
      name: tag('demo-styled'),
      element: Styled,
      template: () => html`<span>x</span>`,
      styles: cardStructuralStyles,
    });
    define(withStyles);
    class StyledPlain extends Styled {}
    const without = compose({
      name: tag('demo-styled-plain'),
      element: StyledPlain,
      template: () => html`<span>y</span>`,
    });
    define(without);
    expect(getComputedStyle(mount(withStyles.name)).display).toBe('block');
    expect(getComputedStyle(mount(without.name)).display).toBe('inline-block');
  });
});

describe('recomposition', () => {
  class StudioCard extends Card {}
  const studioStyles = css`
    article {
      padding: 12px;
    }
  `;
  const studioCardDefinition = compose({
    ...cardDefinition,
    name: tag('studio-card'),
    element: StudioCard,
    styles: [cardStructuralStyles, studioStyles],
  });
  define(studioCardDefinition);

  it('creates a new frozen definition traced to its foundation without changing it', () => {
    expect(studioCardDefinition).not.toBe(cardDefinition);
    expect(studioCardDefinition.source).toBe(studioCardDefinition);
    expect(studioCardDefinition.extends).toBe(cardDefinition);
    expect(studioCardDefinition.template).toBe(cardTemplate);
    expect(cardDefinition.styles).toEqual([cardStructuralStyles, cardStyles]);
    expect(Object.getOwnPropertyNames(Card).includes('template')).toBe(false);
    expect(Object.getOwnPropertyNames(StudioCard)).not.toContain('styles');
  });

  it('coexists with its foundation in one document with distinct names and constructors', () => {
    const foundation = mount<Card>(cardDefinition.name);
    const studio = mount<StudioCard>(studioCardDefinition.name);
    const padding = (el: HTMLElement) =>
      getComputedStyle(el.shadowRoot!.querySelector('article')!).paddingTop;
    expect(padding(foundation)).toBe('4px');
    expect(padding(studio)).toBe('12px');
    expect(studio.shadowRoot!.querySelector('h2')!.textContent).toBe('Title');
    expect(customElements.getName(StudioCard)).toBe(studioCardDefinition.name);
  });

  it('subclasses never inherit a parent definition', () => {
    class Unconfigured extends Card {}
    const name = tag('demo-unconfigured');
    define(name, Unconfigured);
    const el = mount<Unconfigured>(name);
    expect(el.shadowRoot).toBeNull();
  });
});

describe('registration of definitions', () => {
  it('is idempotent for the same definition', () => {
    expect(define(cardDefinition)).toBe(cardDefinition);
  });

  it('reports a different definition for a registered name and class', () => {
    const conflicting = compose({ ...cardDefinition, styles: cardStyles });
    expect(codeOf(() => define(conflicting))).toBe('registry.definitionConflict');
  });

  it('reports a class reused for a second name', () => {
    const reused = compose({ ...cardDefinition, name: tag('demo-reused') });
    expect(codeOf(() => define(reused))).toBe('registry.constructorReused');
    expect(customElements.get(reused.name)).toBeUndefined();
  });

  it('reports a different class for a taken name and leaves the registry unchanged', () => {
    class Other extends OddkinElement {}
    const taken = compose({ name: cardDefinition.name, element: Other });
    expect(codeOf(() => define(taken))).toBe('registry.collision');
    expect(customElements.get(cardDefinition.name)).toBe(Card);
    // The failed attempt did not bind Other to the definition.
    const retry = compose({ name: tag('demo-other'), element: Other });
    expect(define(retry)).toBe(retry);
  });

  it('registers dependencies first and upgrades existing elements with the definition', () => {
    class Child extends OddkinElement {}
    class Parent extends OddkinElement {}
    const childDefinition = compose({
      name: tag('demo-child'),
      element: Child,
      template: () => html`<i>child</i>`,
    });
    const parentDefinition = compose({
      name: tag('demo-parent'),
      element: Parent,
      template: () => html`<b>parent</b>`,
      dependencies: { child: childDefinition },
    });
    const early = mount<Child>(childDefinition.name);
    define(parentDefinition);
    expect(customElements.get(childDefinition.name)).toBe(Child);
    expect(early.shadowRoot!.textContent).toBe('child');
    expect(Object.isFrozen(parentDefinition.dependencies)).toBe(true);
  });

  it('reports a template that replaces render()', () => {
    class Both extends OddkinElement {
      protected override render() {
        return html`<p>render</p>`;
      }
    }
    const both = compose({ name: tag('demo-both'), element: Both, template: () => html`<p>t</p>` });
    define(both);
    expect(reported.map((r) => r.code)).toContain('definition.render.ignored');
    expect(mount(both.name).shadowRoot!.textContent).toBe('t');
  });
});

describe('ownership with external templates', () => {
  it('connection-owned work returns to baseline across reconnects', async () => {
    class Listening extends OddkinElement {
      clicks = 0;
      protected override connected(scope: Scope): void {
        scope.listen(document, 'click', () => this.clicks++);
      }
    }
    const definition = compose({
      name: tag('demo-listening'),
      element: Listening,
      template: (host) => html`<span>${host.clicks}</span>`,
    });
    define(definition);
    const before = scopeStats();
    const el = mount<Listening>(definition.name);
    for (let i = 0; i < 5; i++) {
      el.remove();
      container.append(el);
    }
    document.dispatchEvent(new Event('click'));
    expect(el.clicks).toBe(1);
    el.remove();
    flush();
    expect(scopeStats()).toEqual(before);
  });
});
