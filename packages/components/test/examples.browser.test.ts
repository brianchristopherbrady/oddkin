import { afterEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { flush } from '@oddkin/core/reactive';
import { setErrorHandler } from '@oddkin/core/diagnostics';
import { scopeStats } from '@oddkin/core/scope';
import { mountExample, type MountedExample } from '@oddkin/workbench/testing';
import button from '../src/button/button.examples.js';
import card from '../src/card/card.examples.js';
import input from '../src/input/input.examples.js';
import sideNav from '../src/side-nav/side-nav.examples.js';
import { exampleSets } from './catalog.js';
import './register.js';

const mounted: MountedExample<Element>[] = [];
afterEach(() => {
  for (const example of mounted.splice(0)) example.dispose();
  flush();
});

const settle = async (root: Element) => {
  flush();
  const elements = [...root.querySelectorAll<Element & { updateComplete?: Promise<void> }>('*')];
  await Promise.all(elements.map((el) => el.updateComplete));
  flush();
};

async function mount<E extends Element>(
  set: Parameters<typeof mountExample<E>>[0],
  name: string,
  container?: HTMLElement,
) {
  const example = await mountExample(set, name, container);
  mounted.push(example);
  await settle(example.root);
  return example;
}

// odd-button submits after the click's task, through a temporary native button.
const output = (root: Element) => expect.poll(() => root.querySelector('output')!.value);

describe('authored examples', () => {
  it('each example mounts with its properties, attributes, and slots, then releases everything', async () => {
    for (const set of Object.values(exampleSets)) {
      for (const [name, example] of Object.entries(set.examples)) {
        if (example.incorrect) continue;
        const before = scopeStats();
        const { element, root, dispose } = await mountExample(set as never, name);
        await settle(root);
        const label = `${set.component}/${name}`;
        expect(element.isConnected, label).toBe(true);
        expect(element.shadowRoot?.childElementCount, label).toBeGreaterThan(0);
        for (const [key, value] of Object.entries(example.props ?? {}))
          expect((element as unknown as Record<string, unknown>)[key], `${label}.${key}`).toEqual(
            value,
          );
        for (const [attribute, value] of Object.entries(example.attributes ?? {}))
          expect(element.getAttribute(attribute), `${label}[${attribute}]`).toBe(value);
        for (const text of Object.values(example.slots ?? {}))
          expect(element.textContent, label).toContain(text);
        dispose();
        flush();
        expect(scopeStats(), label).toEqual(before);
      }
    }
  });

  // What each explained mistake does when mounted: the observation differs from its correct
  // example, and only the mistakes core can see at runtime are reported.
  type Observed = Element & Record<string, unknown>;
  const effects: Record<string, { observe: (el: Observed) => unknown; wrong: unknown }> = {
    'odd-side-nav/itemsAttribute': {
      observe: (el) => el.shadowRoot!.querySelectorAll('a[href]').length,
      wrong: 0,
    },
    'odd-button/disabledFalse': { observe: (el) => el['disabled'], wrong: true },
    'odd-button/dangerAppearance': { observe: (el) => el['appearance'], wrong: 'secondary' },
    'odd-input/requiredFalse': {
      observe: (el) => (el['validity'] as ValidityState).valueMissing,
      wrong: true,
    },
    'odd-checkbox-group/requiredFalse': {
      observe: (el) => (el['validity'] as ValidityState).valueMissing,
      wrong: true,
    },
    'odd-radio-group/requiredFalse': {
      observe: (el) => (el['validity'] as ValidityState).valueMissing,
      wrong: true,
    },
    'odd-segmented-control/requiredFalse': {
      observe: (el) => (el['validity'] as ValidityState).valueMissing,
      wrong: true,
    },
    'odd-rating/requiredFalse': {
      observe: (el) => (el['validity'] as ValidityState).valueMissing,
      wrong: true,
    },
    'odd-textarea/requiredFalse': {
      observe: (el) => (el['validity'] as ValidityState).valueMissing,
      wrong: true,
    },
    'odd-card/bodySlot': {
      observe: (el) => [...el.children].every((child) => child.assignedSlot !== null),
      wrong: false,
    },
    'odd-badge/colorOnly': { observe: (el) => el['tone'], wrong: 'neutral' },
    'odd-alert/colorOnly': { observe: (el) => el['tone'], wrong: 'neutral' },
    'odd-container/measureWide': { observe: (el) => el['measure'], wrong: 'constrained' },
    'odd-status-marker/statusError': { observe: (el) => el['status'], wrong: 'idle' },
    'odd-relative-time/detailFalse': { observe: (el) => el['detail'], wrong: true },
    'odd-copy-button/disabledFalse': { observe: (el) => el['disabled'], wrong: true },
    'odd-stat/trendUp': { observe: (el) => el['trend'], wrong: 'none' },
    'odd-scroll-region/heightAttribute': {
      observe: (el) => {
        const base = el.shadowRoot!.querySelector('[part~="base"]')!;
        return base.scrollHeight > base.clientHeight;
      },
      wrong: false,
    },
    'odd-avatar/nameAttribute': { observe: (el) => el['label'], wrong: '' },
    'odd-checkbox/checkedFalse': { observe: (el) => el['checked'], wrong: true },
    'odd-switch/onAttribute': { observe: (el) => el['checked'], wrong: false },
    'odd-chip/removableFalse': { observe: (el) => el['removable'], wrong: true },
    'odd-disclosure/openFalse': { observe: (el) => el['open'], wrong: true },
    'odd-disclosure/summarySlot': {
      observe: (el) => el.shadowRoot!.querySelector('[part="label"]')!.textContent,
      wrong: '',
    },
    'odd-tabs/orientationColumn': { observe: (el) => el['orientation'], wrong: 'horizontal' },
    'odd-toolbar/orientationRow': { observe: (el) => el['orientation'], wrong: 'horizontal' },
    'odd-split-panel/orientationColumn': {
      observe: (el) => el['orientation'],
      wrong: 'horizontal',
    },
    'odd-pagination/currentPageAttribute': { observe: (el) => el['current'], wrong: '1' },
    'odd-popover/openFalse': { observe: (el) => el['open'], wrong: true },
    'odd-popover/physicalSide': { observe: (el) => el['side'], wrong: 'block-end' },
    'odd-dialog/closedByBackdrop': { observe: (el) => el['closedBy'], wrong: 'closerequest' },
    'odd-tooltip/physicalSide': { observe: (el) => el['side'], wrong: 'block-start' },
    'odd-drawer/physicalSide': { observe: (el) => el['side'], wrong: 'inline-end' },
    'odd-toast/errorTone': { observe: (el) => el['tone'], wrong: 'neutral' },
    'odd-file-input/multipleFalse': { observe: (el) => el['multiple'], wrong: true },
    'odd-calendar/requiredFalse': { observe: (el) => el['required'], wrong: true },
    'odd-date-picker/requiredFalse': { observe: (el) => el['required'], wrong: true },
    'odd-validation-summary/forAttribute': {
      observe: (el) => el.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!.hidden,
      wrong: true,
    },
    'odd-breadcrumbs/itemsAttribute': {
      observe: (el) => el.shadowRoot!.querySelectorAll('[part~="item"]').length,
      wrong: 0,
    },
    'odd-tree/itemsAttribute': {
      observe: (el) => el.shadowRoot!.querySelectorAll('[role="treeitem"]').length,
      wrong: 0,
    },
    'odd-listbox/optionsAttribute': {
      observe: (el) => el.shadowRoot!.querySelectorAll('[role="option"]').length,
      wrong: 0,
    },
    'odd-combobox/optionsAttribute': {
      observe: (el) => el.shadowRoot!.querySelectorAll('[role="option"]').length,
      wrong: 0,
    },
    'odd-command-palette/itemsAttribute': {
      observe: (el) => el.shadowRoot!.querySelectorAll('[role="option"]').length,
      wrong: 0,
    },
    'odd-select/optionsAttribute': {
      observe: (el) => el.shadowRoot!.querySelectorAll('option').length,
      wrong: 0,
    },
    'odd-menu/itemsAttribute': {
      observe: (el) => el.shadowRoot!.querySelectorAll('[role="menuitem"]').length,
      wrong: 0,
    },
    'odd-split-button/itemsAttribute': {
      observe: (el) =>
        el.shadowRoot!.querySelector('odd-menu')!.shadowRoot!.querySelectorAll('[role="menuitem"]')
          .length,
      wrong: 0,
    },
    'odd-empty-state/actionsSlot': {
      observe: (el) => [...el.children].every((child) => child.assignedSlot !== null),
      wrong: false,
    },
    'odd-icon/altAttribute': { observe: (el) => el['label'], wrong: '' },
    'odd-progress/percentAttribute': { observe: (el) => el['value'], wrong: undefined },
    'odd-skeleton/shapeSquare': { observe: (el) => el['shape'], wrong: 'text' },
    'odd-spinner/sizeWord': { observe: (el) => el['size'], wrong: 'md' },
  };
  const reported: Record<string, string[]> = {
    'odd-alert/colorOnly': ['element.attribute.invalid'],
    'odd-badge/colorOnly': ['element.attribute.invalid'],
    'odd-skeleton/shapeSquare': ['element.attribute.invalid'],
    'odd-spinner/sizeWord': ['element.attribute.invalid'],
    'odd-tabs/orientationColumn': ['element.attribute.invalid'],
    'odd-toolbar/orientationRow': ['element.attribute.invalid'],
    'odd-split-panel/orientationColumn': ['element.attribute.invalid'],
    'odd-container/measureWide': ['element.attribute.invalid'],
    'odd-status-marker/statusError': ['element.attribute.invalid'],
    'odd-stat/trendUp': ['element.attribute.invalid'],
    'odd-button/dangerAppearance': ['element.attribute.invalid'],
    'odd-side-nav/itemsAttribute': ['element.attribute.propertyOnly'],
    'odd-breadcrumbs/itemsAttribute': ['element.attribute.propertyOnly'],
    'odd-tree/itemsAttribute': ['element.attribute.propertyOnly'],
    'odd-listbox/optionsAttribute': ['element.attribute.propertyOnly'],
    'odd-combobox/optionsAttribute': ['element.attribute.propertyOnly'],
    'odd-command-palette/itemsAttribute': ['element.attribute.propertyOnly'],
    'odd-select/optionsAttribute': ['element.attribute.propertyOnly'],
    'odd-menu/itemsAttribute': ['element.attribute.propertyOnly'],
    'odd-split-button/itemsAttribute': ['element.attribute.propertyOnly'],
    'odd-popover/physicalSide': ['element.attribute.invalid'],
    'odd-dialog/closedByBackdrop': ['element.attribute.invalid'],
    'odd-tooltip/physicalSide': ['element.attribute.invalid'],
    'odd-drawer/physicalSide': ['element.attribute.invalid'],
    'odd-toast/errorTone': ['element.attribute.invalid'],
  };

  it('each explained mistake does what its explanation says, unlike its correct example', async () => {
    const seen: string[] = [];
    for (const set of Object.values(exampleSets)) {
      for (const [name, example] of Object.entries(set.examples)) {
        if (!example.incorrect) continue;
        const label = `${set.component}/${name}`;
        const effect = effects[label];
        expect(effect, `${label} has no observed effect`).toBeDefined();
        const codes: string[] = [];
        setErrorHandler((_error, context) => codes.push(context.code ?? ''));
        try {
          const wrong = await mount(set as never, name);
          const right = await mount(set as never, example.incorrect.correct);
          expect(effect!.observe(wrong.element as Observed), label).toEqual(effect!.wrong);
          expect(effect!.observe(right.element as Observed), label).not.toEqual(effect!.wrong);
        } finally {
          setErrorHandler(undefined);
        }
        expect(codes, label).toEqual(reported[label] ?? []);
        seen.push(label);
      }
    }
    expect(seen.sort()).toEqual(Object.keys(effects).sort());
  });

  it('button inForm submits its own name and value with the form', async () => {
    const { element, root } = await mount(button, 'inForm');
    await userEvent.click(element);
    await output(root).toBe('project=Atlas&intent=create');
  });

  it('input inForm blocks an empty submission, then submits the typed address', async () => {
    const { element, root } = await mount(input, 'inForm');
    const submit = root.querySelector('odd-button')!;
    await userEvent.click(submit);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(root.querySelector('output')!.value).toBe('');
    expect(element.validity.valueMissing).toBe(true);
    await userEvent.type(element.shadowRoot!.querySelector('input')!, 'ada@example.com');
    await userEvent.click(submit);
    await output(root).toBe('email=ada%40example.com');
  });

  it('input invalid shows its error through custom validity', async () => {
    const { element } = await mount(input, 'invalid');
    expect(element.validity.customError).toBe(true);
    expect(element.shadowRoot!.querySelector('input')!.getAttribute('aria-invalid')).toBe('true');
    expect(element.shadowRoot!.textContent).toContain('Enter an address like ada@example.com.');
  });

  it('card headed puts a heading in the header and an action in the footer', async () => {
    const { element } = await mount(card, 'headed');
    expect(element.querySelector('h3')!.slot).toBe('header');
    expect(element.querySelector('odd-button')!.slot).toBe('footer');
    expect(element.shadowRoot!.querySelector<HTMLElement>('[part="header"]')!.hidden).toBe(false);
    expect(element.shadowRoot!.querySelector<HTMLElement>('[part="footer"]')!.hidden).toBe(false);
  });

  it('side-nav controlled lets the page own expansion through odd-toggle', async () => {
    const { element } = await mount(sideNav, 'controlled');
    const toggle = element.shadowRoot!.querySelector<HTMLButtonElement>('[part="group-toggle"]')!;
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    toggle.click();
    await settle(element);
    expect(element.expanded).toEqual(['guides']);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });

  it('side-nav wide and declarative show the container layout and slotted links', async () => {
    // The test frame is narrower than 40rem; a preview at that width would stay one column.
    const frame = document.createElement('div');
    frame.style.inlineSize = '1000px';
    document.body.append(frame);
    const wide = await mount(sideNav, 'wide', frame);
    const content = wide.element.shadowRoot!.querySelector('.content')!;
    expect(getComputedStyle(content).gridTemplateColumns.split(' ')).toHaveLength(3);
    frame.remove();
    const declarative = await mount(sideNav, 'declarative');
    expect(declarative.element.querySelectorAll('a')).toHaveLength(3);
    expect(declarative.element.shadowRoot!.querySelector('slot:not([name])')).not.toBeNull();
  });
});
