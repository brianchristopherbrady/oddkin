/**
 * Conformance suite for the `odd-button` foundation contract. Implementation-agnostic: it
 * reaches the element only through its tag, public properties, native events, and the
 * documented `control` anatomy role (a native, focusable `<button>`).
 */
import { defineConformance, type ConformanceContext } from './index.js';

const control = (ctx: ConformanceContext, host: HTMLElement) => {
  const part = ctx.adapter.part(host, 'control');
  ctx.expect(part !== null, 'the implementation exposes its control').toBe(true);
  return part as HTMLElement;
};
const countClicks = (host: HTMLElement) => {
  const counter = { count: 0 };
  host.addEventListener('click', () => counter.count++);
  return counter;
};
type ButtonLike = HTMLElement & Record<string, unknown>;

export const buttonConformance = defineConformance({
  id: 'oddkin.button',
  version: '0.1.0',
  contract: { component: 'component:odd-button', versions: '0.x' },
  description: 'Interaction contract shared by odd-button and its product implementations.',
  requires: {
    properties: [
      'appearance',
      'size',
      'type',
      'disabled',
      'loading',
      'fullWidth',
      'name',
      'value',
      'label',
    ],
    events: ['click'],
    slots: ['', 'start', 'end'],
    anatomy: ['control'],
  },
  cases: [
    {
      id: 'properties-attributes',
      title: 'Attributes convert to properties; boolean and enum state reflects',
      kind: 'assertion',
      async run(ctx) {
        const host = (await ctx.mount({
          attributes: { appearance: 'primary', 'full-width': '' },
          content: 'Go',
        })) as ButtonLike;
        ctx.expect(host['appearance']).toBe('primary');
        ctx.expect(host['fullWidth']).toBe(true);
        host['disabled'] = true;
        host['size'] = 'lg';
        await ctx.adapter.settle(host);
        ctx.expect(host.hasAttribute('disabled')).toBe(true);
        ctx.expect(host.getAttribute('size')).toBe('lg');
      },
    },
    {
      id: 'native-control',
      title: 'The control is a native button and the default slot names it',
      kind: 'assertion',
      async run(ctx) {
        const host = await ctx.mount({ content: 'Save' });
        const part = control(ctx, host);
        ctx.expect(part.localName).toBe('button');
        ctx.expect((part as HTMLButtonElement).type).toBe('button');
      },
    },
    {
      id: 'keyboard-activation',
      title: 'Click, Enter, and Space each dispatch one click at the host',
      kind: 'assertion',
      async run(ctx) {
        const host = await ctx.mount({ content: 'Save' });
        const clicks = countClicks(host);
        await ctx.user.click(host);
        host.focus();
        await ctx.user.keyboard('{Enter}');
        await ctx.user.keyboard(' ');
        ctx.expect(clicks.count).toBe(3);
      },
    },
    {
      id: 'focus',
      title: 'Focusing the host focuses the control',
      kind: 'assertion',
      async run(ctx) {
        const host = await ctx.mount({ content: 'Save' });
        host.focus();
        const active = host.shadowRoot?.activeElement ?? document.activeElement;
        ctx.expect(active).toBe(control(ctx, host));
      },
    },
    {
      id: 'disabled',
      title: 'Disabled ignores activation and is not focusable',
      kind: 'assertion',
      async run(ctx) {
        const host = await ctx.mount({ attributes: { disabled: '' }, content: 'Save' });
        const clicks = countClicks(host);
        host.click();
        control(ctx, host).click();
        host.focus();
        ctx.expect(clicks.count).toBe(0);
        ctx.expect(host.shadowRoot?.activeElement ?? null).toBe(null);
      },
    },
    {
      id: 'loading',
      title: 'Loading ignores activation but stays focusable and exposes aria-disabled',
      kind: 'assertion',
      async run(ctx) {
        const host = await ctx.mount({ attributes: { loading: '' }, content: 'Save' });
        const clicks = countClicks(host);
        host.focus();
        await ctx.user.keyboard('{Enter}');
        host.click();
        ctx.expect(clicks.count).toBe(0);
        ctx.expect(host.shadowRoot?.activeElement).toBe(control(ctx, host));
        ctx.expect(control(ctx, host).getAttribute('aria-disabled')).toBe('true');
      },
    },
    {
      id: 'form-submission',
      title: 'type="submit" submits its form once, including name and value',
      kind: 'assertion',
      async run(ctx) {
        const host = await ctx.mount({
          attributes: { type: 'submit', name: 'intent', value: 'save' },
          content: 'Save',
          within: '<form><input name="q" value="a">{{element}}</form>',
        });
        const form = host.closest('form') as HTMLFormElement;
        const submitted: [string, FormDataEntryValue][][] = [];
        form.addEventListener('submit', (event) => {
          event.preventDefault();
          submitted.push([...new FormData(form, event.submitter)]);
        });
        await ctx.user.click(host);
        await ctx.nextTask();
        ctx.expect(submitted).toEqual([
          [
            ['q', 'a'],
            ['intent', 'save'],
          ],
        ]);
      },
    },
    {
      id: 'cancelled-click',
      title: 'A cancelled click does not submit',
      kind: 'assertion',
      async run(ctx) {
        const host = await ctx.mount({
          attributes: { type: 'submit' },
          content: 'Save',
          within: '<form>{{element}}</form>',
        });
        let submits = 0;
        host.closest('form')!.addEventListener('submit', (event) => {
          event.preventDefault();
          submits++;
        });
        host.addEventListener('click', (event) => event.preventDefault());
        await ctx.user.click(host);
        await ctx.nextTask();
        ctx.expect(submits).toBe(0);
      },
    },
    {
      id: 'reconnect',
      title: 'Reconnecting neither leaks owned work nor duplicates activation',
      kind: 'invariant',
      change: 'reconnect',
      async run(ctx) {
        const host = await ctx.mount({
          attributes: { type: 'submit' },
          content: 'Save',
          within: '<form>{{element}}</form>',
        });
        const form = host.closest('form') as HTMLFormElement;
        const parent = host.parentNode as ParentNode;
        const before = ctx.ownedWork();
        for (let i = 0; i < 5; i++) {
          host.remove();
          parent.append(host);
          await ctx.adapter.settle(host);
        }
        ctx.expect(ctx.ownedWork()).toEqual(before);
        let submits = 0;
        form.addEventListener('submit', (event) => {
          event.preventDefault();
          submits++;
        });
        await ctx.user.click(host);
        await ctx.nextTask();
        ctx.expect(submits).toBe(1);
      },
    },
    {
      id: 'programmatic-updates',
      title: 'Programmatic property changes dispatch no user-intent events',
      kind: 'invariant',
      change: 'programmatic',
      async run(ctx) {
        const host = (await ctx.mount({ content: 'Save' })) as ButtonLike;
        const events: string[] = [];
        for (const type of ['click', 'input', 'change'])
          host.addEventListener(type, () => events.push(type));
        host['appearance'] = 'ghost';
        host['value'] = 'x';
        host['loading'] = true;
        host['disabled'] = true;
        await ctx.adapter.settle(host);
        ctx.expect(events).toEqual([]);
      },
    },
    {
      id: 'theme-value',
      title: 'A theme-value change keeps the control node and applies',
      kind: 'invariant',
      change: 'theme-value',
      async run(ctx) {
        const host = await ctx.mount({ content: 'Save' });
        const before = control(ctx, host);
        (host.parentElement as HTMLElement).style.setProperty('--odd-button-radius', '0px');
        await ctx.adapter.settle(host);
        ctx.expect(control(ctx, host)).toBe(before);
        ctx.expect(getComputedStyle(before).borderTopLeftRadius).toBe('0px');
      },
    },
  ],
});
