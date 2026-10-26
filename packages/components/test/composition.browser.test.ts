import { afterEach, describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { flush } from '@oddkin/core/reactive';
import {
  CATALOG,
  NATIVE,
  renderComposition,
  type CompositionAction,
  type CompositionDocument,
} from '../src/composition/index.js';
import './register.js';
import { settle } from './probe.js';

// ADR 0046 D3 (data-composition.md §8): a composition renders what the same hand-written markup
// renders, creates nothing it was not allowed to, and carries no executable value.

const ALLOW = [...Object.keys(CATALOG), ...Object.keys(NATIVE)];
let containers: HTMLElement[] = [];
const container = () => {
  const el = document.createElement('div');
  document.body.append(el);
  containers.push(el);
  return el;
};
afterEach(() => {
  for (const el of containers) el.remove();
  containers = [];
  flush();
});

const settleAll = async (root: Element) => {
  for (const el of root.querySelectorAll('*'))
    if (el.localName.startsWith('odd-')) await settle(el);
};

/** Light and shadow DOM, attributes sorted, for comparing two renderings of one interface. */
function serialize(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
  if (node.nodeType === Node.COMMENT_NODE) return '';
  const el = node as Element;
  const attributes = [...el.attributes]
    .map((a) => `${a.name}="${a.value}"`)
    .sort()
    .join(' ');
  const shadow = el.shadowRoot
    ? `#shadow(${[...el.shadowRoot.childNodes].map(serialize).join('')})`
    : '';
  return `<${el.localName}${attributes ? ` ${attributes}` : ''}>${shadow}${[...el.childNodes].map(serialize).join('')}</${el.localName}>`;
}

const items = [
  { kind: 'link', id: 'home', label: 'Home', href: '#home' },
  {
    kind: 'group',
    id: 'projects',
    label: 'Projects',
    items: [{ kind: 'link', id: 'atlas', label: 'Atlas', href: '#atlas' }],
  },
];
const composition: CompositionDocument = {
  version: 1,
  root: [
    {
      element: 'odd-side-nav',
      attributes: { label: 'Primary', current: 'home' },
      properties: { items },
    },
    {
      element: 'odd-card',
      id: 'profile',
      attributes: { appearance: 'filled', label: 'Profile' },
      children: [
        { element: 'h2', slot: 'header', children: ['Profile'] },
        {
          element: 'p',
          children: ['Signed in as ', { element: 'strong', children: ['Ada'] }, '.'],
        },
        {
          element: 'odd-input',
          attributes: { label: 'Display name', name: 'name', required: true },
          properties: { value: 'Ada' },
        },
        {
          element: 'odd-checkbox',
          attributes: { name: 'email' },
          children: ['Show my email'],
        },
        {
          element: 'odd-alert',
          attributes: { tone: 'info' },
          children: ['Changes apply after you save.'],
        },
        {
          element: 'odd-disclosure',
          attributes: { label: 'Advanced' },
          children: [{ element: 'odd-badge', attributes: { tone: 'success' }, children: ['Beta'] }],
        },
        {
          element: 'odd-button',
          slot: 'footer',
          attributes: { appearance: 'primary' },
          children: ['Save'],
        },
      ],
    },
  ],
};
const markup = `<odd-side-nav label="Primary" current="home"></odd-side-nav><odd-card id="profile" appearance="filled" label="Profile"><h2 slot="header">Profile</h2><p>Signed in as <strong>Ada</strong>.</p><odd-input label="Display name" name="name" required></odd-input><odd-checkbox name="email">Show my email</odd-checkbox><odd-alert tone="info">Changes apply after you save.</odd-alert><odd-disclosure label="Advanced"><odd-badge tone="success">Beta</odd-badge></odd-disclosure><odd-button slot="footer" appearance="primary">Save</odd-button></odd-card>`;

describe('renderComposition', () => {
  it('renders the same DOM, names, and roles as the hand-written markup', async () => {
    const composed = container();
    const result = renderComposition(composition, composed, { allow: ALLOW });
    expect([result.ok, result.diagnostics]).toEqual([true, []]);
    expect(result.nodes.map((n) => (n as Element).localName)).toEqual(['odd-side-nav', 'odd-card']);
    const written = container();
    written.innerHTML = markup;
    Object.assign(written.querySelector('odd-side-nav')!, { items });
    Object.assign(written.querySelector('odd-input')!, { value: 'Ada' });
    await settleAll(composed);
    await settleAll(written);
    expect(serialize(composed)).toBe(serialize(written));
    for (const [role, name] of [
      ['navigation', 'Primary'],
      ['link', 'Home'],
      ['heading', 'Profile'],
      ['textbox', 'Display name'],
      ['checkbox', 'Show my email'],
      ['button', 'Save'],
    ] as const) {
      const found = (root: HTMLElement) =>
        page.elementLocator(root).getByRole(role, { name, exact: true }).elements().length;
      expect([role, name, found(composed)]).toEqual([role, name, found(written)]);
      expect(found(composed), `${role} ${name}`).toBeGreaterThan(0);
    }
    expect(composed.querySelector('odd-input')!.value).toBe('Ada');
  });

  it('reports mapped events as action names, and disposes of nodes and listeners', async () => {
    const target = container();
    const actions: CompositionAction[] = [];
    const result = renderComposition(
      {
        version: 1,
        root: [
          {
            element: 'odd-checkbox',
            id: 'terms',
            actions: { change: 'terms.toggle' },
            children: ['I agree'],
          },
          { element: 'odd-button', actions: { click: 'terms.submit' }, children: ['Continue'] },
          {
            element: 'odd-button',
            attributes: { disabled: true },
            actions: { click: 'terms.never' },
            children: ['Skip'],
          },
        ],
      },
      target,
      { allow: ['odd-checkbox', 'odd-button'], onAction: (action) => actions.push(action) },
    );
    const checkbox = target.querySelector('odd-checkbox')!;
    const [button, disabled] = target.querySelectorAll('odd-button');
    await settleAll(target);
    await userEvent.click(page.getByRole('checkbox', { name: 'I agree' }));
    await userEvent.click(page.getByRole('button', { name: 'Continue' }));
    // A disabled odd-button stops the click at its host, so no action is reported.
    (disabled as HTMLElement).click();
    expect(actions.map((a) => [a.action, a.id, a.element, a.event.type])).toEqual([
      ['terms.toggle', 'terms', checkbox, 'change'],
      ['terms.submit', undefined, button, 'click'],
    ]);
    result.dispose();
    expect(target.childNodes).toHaveLength(0);
    checkbox.dispatchEvent(new Event('change'));
    button!.dispatchEvent(new Event('click'));
    expect(actions).toHaveLength(2);
  });

  it('refuses the whole document when an element is not allowed or not registered', async () => {
    const target = container();
    const document_ = {
      version: 1,
      root: [
        { element: 'p', children: ['Hi'] },
        { element: 'odd-button', children: ['Go'] },
      ],
    };
    const refused = renderComposition(document_, target, { allow: ['p'] });
    expect([refused.ok, refused.nodes, target.childNodes.length]).toEqual([false, [], 0]);
    expect(refused.diagnostics.map((d) => [d.code, d.path])).toEqual([
      ['composition.element.notAllowed', '/root/1/element'],
    ]);
    // A frame's registry has no Oddkin elements.
    const frame = document.createElement('iframe');
    target.append(frame);
    const body = frame.contentDocument!.body;
    const unregistered = renderComposition(document_, body, { allow: ['p', 'odd-button'] });
    expect(unregistered.diagnostics.map((d) => d.code)).toEqual([
      'composition.element.unregistered',
    ]);
    expect(body.childNodes).toHaveLength(0);
  });

  it('keeps adversarial content inert: text stays text, executable values are refused', async () => {
    const flag = vi.fn();
    (window as unknown as { __pwned: () => void }).__pwned = flag;
    const target = container();
    const text = '<img src=x onerror="__pwned()"><script>__pwned()</script>';
    expect(
      renderComposition({ version: 1, root: [{ element: 'p', children: [text] }, text] }, target, {
        allow: ALLOW,
      }).ok,
    ).toBe(true);
    expect(target.querySelectorAll('img, script')).toHaveLength(0);
    expect(target.textContent).toBe(text + text);
    for (const hostile of [
      { element: 'script', children: ['__pwned()'] },
      { element: 'odd-button', attributes: { onclick: '__pwned()' } },
      { element: 'odd-button', attributes: { style: 'background: url(javascript:__pwned())' } },
      { element: 'a', attributes: { href: 'javascript:__pwned()' }, children: ['x'] },
      { element: 'odd-button', attributes: { formaction: 'JaVaScRiPt:__pwned()' } },
      { element: 'odd-card', properties: { innerHTML: '<img src=x onerror=__pwned()>' } },
      { element: 'odd-button', actions: { change: '__pwned()' } },
      { element: 'odd-side-nav', properties: { renderLabel: '() => __pwned()' } },
    ]) {
      const other = container();
      const result = renderComposition({ version: 1, root: [hostile] }, other, { allow: ALLOW });
      expect([result.ok, other.childNodes.length], JSON.stringify(hostile)).toEqual([false, 0]);
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(flag).not.toHaveBeenCalled();
  });
});
