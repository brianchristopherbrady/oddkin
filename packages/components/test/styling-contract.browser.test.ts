import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { flush } from '@oddkin/core/reactive';

// Styling contract with the shipped theme loaded (theming-and-styling.md §7): each documented
// component variable takes effect on the host or an ancestor and otherwise falls back to the role
// inherited in the element's scope; state rules win over variables; documented parts are the
// styling hooks into the shadow root and combine with custom states.
type Host = HTMLElement & { updateComplete: Promise<void> };
interface Declaration {
  tagName?: string;
  cssProperties?: { name: string }[];
  cssParts?: { name: string }[];
}
const cem = (await (await fetch(new URL('../custom-elements.json', import.meta.url))).json()) as {
  modules: { declarations?: Declaration[] }[];
};
const declared = (tag: string) =>
  cem.modules.flatMap((m) => m.declarations ?? []).find((d) => d.tagName === tag)!;

interface Variable {
  property: string;
  /** A value to set, and the role the component falls back to while the variable is unset. */
  value: string;
  role: string;
  /** How the component applies the value, e.g. never below the target size. */
  wrap?: (value: string) => string;
  attributes?: string;
  /** Declared by the theme (a component role), so never unset. */
  themeRole?: boolean;
}
const atLeastTarget = (value: string) => `max(${value}, var(--odd-target-min))`;
const components: Record<
  string,
  {
    part: string;
    content: string;
    variables: Record<string, Variable>;
    /** Attributes under which every documented part renders. */
    allParts?: string;
  }
> = {
  'odd-button': {
    part: 'control',
    content: 'Save',
    variables: {
      '--odd-button-background': {
        property: 'background-color',
        value: 'rgb(1, 2, 3)',
        role: 'var(--odd-color-surface-default)',
      },
      '--odd-button-color': {
        property: 'color',
        value: 'rgb(4, 5, 6)',
        role: 'var(--odd-color-text-primary)',
      },
      '--odd-button-border-color': {
        property: 'border-top-color',
        value: 'rgb(7, 8, 9)',
        role: 'var(--odd-color-border-strong)',
      },
      '--odd-button-radius': {
        property: 'border-top-left-radius',
        value: '3px',
        role: 'var(--odd-control-radius)',
      },
      '--odd-button-height': {
        property: 'min-height',
        value: '5rem',
        role: 'var(--odd-control-height-md)',
        wrap: atLeastTarget,
      },
      '--odd-button-padding-inline': {
        property: 'padding-left',
        value: '33px',
        role: 'var(--odd-control-padding-inline-md)',
      },
    },
  },
  'odd-input': {
    part: 'control',
    content: '',
    allParts: 'type="search"',
    variables: {
      '--odd-field-background': {
        property: 'background-color',
        value: 'rgb(1, 2, 3)',
        role: 'var(--odd-color-surface-default)',
      },
      '--odd-field-border-color': {
        property: 'border-top-color',
        value: 'rgb(7, 8, 9)',
        role: 'var(--odd-color-border-strong)',
      },
      '--odd-field-radius': {
        property: 'border-top-left-radius',
        value: '3px',
        role: 'var(--odd-control-radius)',
      },
      '--odd-field-height': {
        property: 'min-height',
        value: '5rem',
        role: 'var(--odd-control-height-md)',
        wrap: atLeastTarget,
      },
    },
  },
  'odd-card': {
    part: 'base',
    content: '<p>Body</p>',
    variables: {
      '--odd-card-background': {
        property: 'background-color',
        value: 'rgb(1, 2, 3)',
        role: 'var(--odd-color-surface-default)',
      },
      '--odd-card-border-color': {
        property: 'border-top-color',
        value: 'rgb(7, 8, 9)',
        role: 'var(--odd-color-border-default)',
      },
      '--odd-card-gap': { property: 'row-gap', value: '17px', role: 'var(--odd-space-sm)' },
      '--odd-card-padding': {
        property: 'padding-top',
        value: '33px',
        role: 'var(--odd-card-padding)',
        themeRole: true,
      },
      '--odd-card-radius': {
        property: 'border-top-left-radius',
        value: '3px',
        role: 'var(--odd-card-radius)',
        themeRole: true,
      },
      '--odd-card-shadow': {
        property: 'box-shadow',
        value: '0 0 0 3px rgb(1, 2, 3)',
        role: 'var(--odd-elevation-md)',
        attributes: 'appearance="elevated"',
      },
    },
  },
};
const tags = Object.keys(components);

let tokens: HTMLLinkElement;
let container: HTMLElement;
beforeAll(async () => {
  await import('../src/button/button.define.js');
  await import('../src/card/card.define.js');
  await import('../src/input/input.define.js');
  tokens = document.createElement('link');
  tokens.rel = 'stylesheet';
  tokens.href = new URL('../../tokens/dist/css/default.css', import.meta.url).href;
  const loaded = new Promise((resolve, reject) => {
    tokens.onload = resolve;
    tokens.onerror = reject;
  });
  document.head.append(tokens);
  await loaded;
});
afterAll(() => tokens.remove());
beforeEach(async () => {
  container = document.createElement('div');
  // Transitions are not under test: values must be final when read.
  container.style.setProperty('--odd-motion-duration-fast', '0s');
  // The pointer rests on plain text above everything rendered, never over a control.
  const rest = document.createElement('p');
  rest.textContent = 'Pointer rests here';
  container.append(rest);
  document.body.append(container);
  await userEvent.hover(rest);
});
afterEach(() => {
  container.remove();
  flush();
});

async function render(markup: string, root: ParentNode = container): Promise<Host[]> {
  const holder = document.createElement('div');
  holder.innerHTML = markup;
  root.append(holder);
  const hosts = [...holder.querySelectorAll<Host>(tags.join(', '))];
  for (const host of hosts) await host.updateComplete;
  flush();
  return hosts;
}
const instance = (tag: string, variable?: Variable, attributes = variable?.attributes ?? '') =>
  `<${tag} label="Name" ${attributes}>${components[tag]!.content}</${tag}>`;
const partOf = (host: Element, name: string) =>
  host.shadowRoot!.querySelector<HTMLElement>(`[part~="${name}"]`)!;
/** The computed value of `property: value` for an element beside `host`, in the same scope. */
function resolve(host: Element, property: string, value: string): string {
  const probe = document.createElement('div');
  probe.style.setProperty(property, value);
  host.after(probe);
  const computed = getComputedStyle(probe).getPropertyValue(property);
  probe.remove();
  return computed;
}
function check(host: Element, tag: string, variable: Variable, value: string, label: string) {
  const actual = getComputedStyle(partOf(host, components[tag]!.part)).getPropertyValue(
    variable.property,
  );
  const wrap = variable.wrap ?? ((v: string) => v);
  expect(actual, label).toBe(resolve(host, variable.property, wrap(value)));
}

describe.each(tags)('%s component variables', (tag) => {
  const { variables } = components[tag]!;

  it('cover exactly the documented variables', () => {
    expect(Object.keys(variables).sort()).toEqual(
      declared(tag)
        .cssProperties!.map((p) => p.name)
        .sort(),
    );
  });

  it('override their roles on the host or an ancestor; `initial` on the host opts out', async () => {
    for (const [name, variable] of Object.entries(variables)) {
      const [host] = await render(`<div>${instance(tag, variable)}</div>`);
      const scope = host!.parentElement!;
      check(host!, tag, variable, variable.role, `${name} unset`);
      host!.style.setProperty(name, variable.value);
      check(host!, tag, variable, variable.value, `${name} on the host`);
      host!.style.removeProperty(name);
      scope.style.setProperty(name, variable.value);
      check(host!, tag, variable, variable.value, `${name} on an ancestor`);
      host!.style.setProperty(name, 'initial');
      // `initial` restores the role fallback; a theme role has none, so its property resets.
      if (variable.themeRole)
        expect(
          getComputedStyle(partOf(host!, components[tag]!.part)).getPropertyValue(
            variable.property,
          ),
          `${name}: initial`,
        ).toBe(resolve(host!, variable.property, 'initial'));
      else check(host!, tag, variable, variable.role, `${name}: initial`);
    }
  });

  it('fall back to the roles of the nearest scope, also inside another shadow root', async () => {
    container.insertAdjacentHTML(
      'beforeend',
      '<div data-odd-mode="light" id="light"></div><div data-odd-mode="dark" id="dark"><span id="shadow-host"></span></div>',
    );
    const shadow = container.querySelector('#shadow-host')!.attachShadow({ mode: 'open' });
    const scopes = {
      light: container.querySelector('#light')!,
      dark: container.querySelector('#dark')!,
      'dark, in a shadow root': shadow,
    };
    const seen: Record<string, string> = {};
    for (const [scope, root] of Object.entries(scopes))
      for (const [name, variable] of Object.entries(variables)) {
        const [host] = await render(instance(tag, variable), root);
        check(host!, tag, variable, variable.role, `${name} in ${scope}`);
        if (variable.property === 'background-color')
          seen[scope] = getComputedStyle(partOf(host!, components[tag]!.part)).backgroundColor;
      }
    // The scopes differ, so the equality above is not vacuous.
    expect(seen['dark']).not.toBe(seen['light']);
    expect(seen['dark, in a shadow root']).toBe(seen['dark']);
  });
});

describe('roles and attributes', () => {
  it('styles authored as CSS (odd-card) and in CSS-in-TS (odd-button, odd-input) follow theme changes alike', async () => {
    container.insertAdjacentHTML('beforeend', '<div id="scope" data-odd-mode="light"></div>');
    const scope = container.querySelector<HTMLElement>('#scope')!;
    const hosts = await render(
      '<odd-card><p>Body</p></odd-card><odd-button>Save</odd-button><odd-input label="Name"></odd-input>',
      scope,
    );
    const surfaces = () =>
      hosts.map(
        (host) => getComputedStyle(partOf(host, components[host.localName]!.part)).backgroundColor,
      );
    const role = () => resolve(hosts[0]!, 'background-color', 'var(--odd-color-surface-default)');
    const light = surfaces();
    expect(light).toEqual([role(), role(), role()]);
    scope.dataset['oddMode'] = 'dark';
    expect(surfaces()).toEqual([role(), role(), role()]);
    expect(surfaces()[0]).not.toBe(light[0]);
    scope.style.setProperty('--odd-color-surface-default', 'rgb(10, 20, 30)');
    expect(surfaces()).toEqual(['rgb(10, 20, 30)', 'rgb(10, 20, 30)', 'rgb(10, 20, 30)']);
  });
  it('odd-card padding steps replace the theme padding role, which follows the compact profile', async () => {
    container.insertAdjacentHTML(
      'beforeend',
      '<div id="default"></div><div id="compact" data-odd-profile="layout.compact"></div>',
    );
    const paddings: Record<string, string[]> = {};
    for (const id of ['default', 'compact']) {
      const hosts = await render(
        ['none', 'sm', 'md', 'lg']
          .map((step) => `<odd-card padding="${step}"><p>Body</p></odd-card>`)
          .join(''),
        container.querySelector(`#${id}`)!,
      );
      paddings[id] = hosts.map((host) => getComputedStyle(partOf(host, 'base')).paddingTop);
      const role = (value: string) => resolve(hosts[0]!, 'padding-top', value);
      expect(paddings[id], id).toEqual([
        '0px',
        role('var(--odd-space-sm)'),
        role('var(--odd-card-padding)'),
        role('var(--odd-space-lg)'),
      ]);
      // The variable sets the default step only.
      for (const host of hosts) host.style.setProperty('--odd-card-padding', '33px');
      expect(hosts.map((host) => getComputedStyle(partOf(host, 'base')).paddingTop)).toEqual([
        '0px',
        role('var(--odd-space-sm)'),
        '33px',
        role('var(--odd-space-lg)'),
      ]);
    }
    expect(paddings['compact']![2]).not.toBe(paddings['default']![2]);
  });

  it('a variable holding a value the property rejects resets the property instead of falling back', async () => {
    const [host] = await render('<odd-button>Save</odd-button>');
    host!.style.setProperty('--odd-button-radius', 'banana');
    expect(getComputedStyle(partOf(host!, 'control')).borderTopLeftRadius).toBe(
      resolve(host!, 'border-top-left-radius', 'initial'),
    );
  });

  it('disabled and invalid states win over component variables', async () => {
    const [button, input] = await render(
      '<odd-button disabled>Save</odd-button><odd-input label="Name" error="Taken"></odd-input>',
    );
    for (const [name, value] of [
      ['--odd-button-background', 'rgb(1, 2, 3)'],
      ['--odd-button-color', 'rgb(4, 5, 6)'],
      ['--odd-button-border-color', 'rgb(7, 8, 9)'],
    ])
      button!.style.setProperty(name!, value!);
    input!.style.setProperty('--odd-field-border-color', 'rgb(7, 8, 9)');
    await input!.updateComplete;
    flush();
    const control = getComputedStyle(partOf(button!, 'control'));
    expect([control.backgroundColor, control.color, control.borderTopColor]).toEqual([
      resolve(button!, 'background-color', 'var(--odd-color-surface-sunken)'),
      resolve(button!, 'color', 'var(--odd-color-text-disabled)'),
      resolve(button!, 'border-top-color', 'transparent'),
    ]);
    expect(getComputedStyle(partOf(input!, 'control')).borderTopColor).toBe(
      resolve(input!, 'border-top-color', 'var(--odd-color-danger-foreground)'),
    );
  });

  it('a background variable applies on hover too; ::part(control):hover styles the hover state', async () => {
    if (!matchMedia('(hover: hover)').matches) return;
    const [plain, custom] = await render(
      '<odd-button>Plain</odd-button> <odd-button id="custom">Custom</odd-button>',
    );
    for (const host of [plain!, custom!])
      host.style.setProperty('--odd-button-background', 'rgb(1, 2, 3)');
    const page = new CSSStyleSheet();
    page.replaceSync('#custom::part(control):hover { background-color: rgb(9, 9, 9); }');
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, page];
    try {
      const background = (host: Element) =>
        getComputedStyle(partOf(host, 'control')).backgroundColor;
      await userEvent.hover(partOf(plain!, 'control'));
      await expect.poll(() => background(plain!)).toBe('rgb(1, 2, 3)');
      await userEvent.hover(partOf(custom!, 'control'));
      await expect.poll(() => background(custom!)).toBe('rgb(9, 9, 9)');
      await userEvent.hover(container.querySelector('p')!);
      await expect.poll(() => background(custom!)).toBe('rgb(1, 2, 3)');
    } finally {
      document.adoptedStyleSheets = document.adoptedStyleSheets.filter((s) => s !== page);
    }
  });
});

describe('parts', () => {
  let page: CSSStyleSheet;
  beforeEach(() => {
    page = new CSSStyleSheet();
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, page];
  });
  afterEach(() => {
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter((s) => s !== page);
  });

  it.each(tags)('%s exposes exactly its documented parts, each styled by ::part()', async (tag) => {
    const parts = declared(tag).cssParts!.map((p) => p.name);
    page.replaceSync(
      parts.map((name) => `${tag}::part(${name}) { outline: 3px dotted rgb(9, 8, 7); }`).join('\n'),
    );
    const [host] = await render(instance(tag, undefined, components[tag]!.allParts));
    const rendered = [...host!.shadowRoot!.querySelectorAll('[part]')].flatMap((el) =>
      el.getAttribute('part')!.split(/\s+/),
    );
    expect(rendered.sort()).toEqual([...parts].sort());
    for (const name of parts) {
      const style = getComputedStyle(partOf(host!, name));
      expect([style.outlineStyle, style.outlineColor], name).toEqual(['dotted', 'rgb(9, 8, 7)']);
    }
  });

  it('odd-input custom state combines with parts', async () => {
    page.replaceSync(
      'odd-input:state(user-invalid)::part(control) { outline: 3px dashed rgb(1, 1, 1); }',
    );
    const [input] = (await render('<odd-input label="Name"></odd-input>')) as [
      Host & { error: string },
    ];
    const outline = () => getComputedStyle(partOf(input, 'control')).outlineStyle;
    expect(outline()).not.toBe('dashed');
    input.error = 'Taken';
    await input.updateComplete;
    flush();
    expect(outline()).toBe('dashed');
    input.error = '';
    await input.updateComplete;
    flush();
    expect(outline()).not.toBe('dashed');
  });
});
