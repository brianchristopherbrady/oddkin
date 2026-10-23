import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OddkinElement, define, prop } from '@oddkin/core/element';
import { flush } from '@oddkin/core/reactive';
import { scopeStats, type Scope } from '@oddkin/core/scope';
import { html, repeat } from '@oddkin/core/template';
import {
  CollectionSource,
  readLinks,
  readMenuItems,
  readOptions,
  type Declared,
  type LinkRecord,
  type MenuItemRecord,
  type OptionRecord,
} from '../src/collection/collection.js';

// Test elements on the collection source, one tag per test (definitions are global).
let count = 0;
const tagFor = <R>(read: (host: HTMLElement) => Declared<R>, name = 'options') => {
  const tag = `test-collection-${++count}`;
  class TestCollection extends OddkinElement.with({
    options: prop.object<readonly R[]>({ description: 'Records.' }),
  }) {
    readonly source = new CollectionSource<R>({
      host: this,
      name,
      property: () => this.options,
      read,
    });
    protected override connected(scope: Scope): void {
      scope.use(this.source);
    }
    override render() {
      return html`<ul>
        ${repeat(
          this.source.records.value,
          (_record, index) => index,
          (record) => html`<li>${JSON.stringify(record)}</li>`,
        )}
      </ul>`;
    }
  }
  define(tag, TestCollection);
  return tag;
};
type Host<R> = HTMLElement & { options: readonly R[] | undefined; source: CollectionSource<R> };

let container: HTMLElement;
let baseline: ReturnType<typeof scopeStats>;
const mutations = async () => {
  await new Promise((resolve) => setTimeout(resolve));
  flush();
};

beforeEach(() => {
  baseline = scopeStats();
  container = document.createElement('div');
  document.body.append(container);
});
afterEach(() => {
  container.remove();
  flush();
  vi.restoreAllMocks();
  expect(scopeStats()).toEqual(baseline);
});

describe('readOptions', () => {
  it('reads options and groups as native ones are read, and the selected values', () => {
    const host = document.createElement('div');
    host.innerHTML = `
      <option value="a" title="First letter">Apple</option>
      <option>  Banana
        split </option>
      <option value="c" label="Cherry (label)" disabled selected>Cherry</option>
      <span slot="empty">Nothing</span>
      <optgroup label="Citrus">
        <option value="l" selected>Lemon</option>
        <hr>
      </optgroup>
      <optgroup label="Off" disabled><option value="x">Lime</option></optgroup>`;
    expect(readOptions(host)).toEqual({
      records: [
        { value: 'a', label: 'Apple', description: 'First letter' },
        { value: 'Banana split', label: 'Banana split' },
        { value: 'c', label: 'Cherry (label)', disabled: true },
        { value: 'l', label: 'Lemon', group: 'Citrus' },
        { value: 'x', label: 'Lime', disabled: true, group: 'Off' },
      ],
      selected: ['c', 'l'],
    });
  });
});

describe('readMenuItems', () => {
  it('reads options as actions (value = id), groups, and separators', () => {
    const host = document.createElement('div');
    host.innerHTML = `
      <option value="copy" title="Copy the selection">Copy</option>
      <hr>
      <optgroup label="Share" disabled><option value="link">Copy link</option><p>no</p></optgroup>
      <option value="delete" disabled selected>Delete</option>`;
    const items: MenuItemRecord[] = [
      { id: 'copy', label: 'Copy', description: 'Copy the selection' },
      { kind: 'separator' },
      {
        kind: 'group',
        label: 'Share',
        items: [{ id: 'link', label: 'Copy link', disabled: true }],
      },
      { id: 'delete', label: 'Delete', disabled: true },
    ];
    expect(readMenuItems(host)).toEqual({ records: items, selected: [] });
  });
});

describe('readLinks', () => {
  it('reads links anywhere inside, so a server-rendered list works, with collapsed text and the raw href', () => {
    const host = document.createElement('nav');
    host.innerHTML = `<ol><li><a href="/">Home</a></li><li><a>No href</a></li>
      <li><a href="docs/guide?x=1">  Docs
        guide </a></li></ol>`;
    const links: LinkRecord[] = [
      { label: 'Home', href: '/' },
      { label: 'Docs guide', href: 'docs/guide?x=1' },
    ];
    expect(readLinks(host)).toEqual({ records: links, selected: [] });
  });
});

describe('CollectionSource', () => {
  const texts = (el: Element) =>
    [...el.shadowRoot!.querySelectorAll('li')].map((li) => JSON.parse(li.textContent!));

  it('renders children that existed before the element was defined in its first render', () => {
    container.innerHTML =
      '<test-collection-early><option>One</option><option>Two</option></test-collection-early>';
    const el = container.firstElementChild as Host<OptionRecord>;
    class Early extends OddkinElement.with({ options: prop.object<readonly OptionRecord[]>() }) {
      readonly source = new CollectionSource<OptionRecord>({
        host: this,
        name: 'options',
        property: () => this.options,
        read: readOptions,
      });
      seen: unknown[] = [];
      protected override connected(scope: Scope): void {
        scope.use(this.source);
      }
      override render() {
        this.seen.push(this.source.records.value.map((r) => r.label));
        return html``;
      }
    }
    define('test-collection-early', Early);
    // Upgraded synchronously by define: the first render already has the children.
    expect((el as unknown as Early).seen[0]).toEqual(['One', 'Two']);
  });

  it('follows children added, removed, and edited later, including inside groups', async () => {
    const tag = tagFor(readOptions);
    const el = document.createElement(tag) as Host<OptionRecord>;
    container.append(el);
    expect(texts(el)).toEqual([]);
    el.innerHTML = '<option value="a">Apple</option><optgroup label="G"></optgroup>';
    await mutations();
    expect(texts(el)).toEqual([{ value: 'a', label: 'Apple' }]);
    el.querySelector('optgroup')!.append(new Option('Grape', 'g'));
    await mutations();
    expect(texts(el).at(-1)).toEqual({ value: 'g', label: 'Grape', group: 'G' });
    el.querySelector('option')!.firstChild!.textContent = 'Apricot';
    await mutations();
    expect(texts(el)[0]).toEqual({ value: 'a', label: 'Apricot' });
    el.querySelector('option')!.setAttribute('disabled', '');
    await mutations();
    expect(texts(el)[0]).toEqual({ value: 'a', label: 'Apricot', disabled: true });
    el.querySelector('optgroup')!.remove();
    await mutations();
    expect(texts(el)).toEqual([{ value: 'a', label: 'Apricot', disabled: true }]);
    expect(el.source.selected.value).toEqual([]);
    el.querySelector('option')!.setAttribute('selected', '');
    await mutations();
    expect(el.source.selected.value).toEqual(['a']);
  });

  it('follows every attribute the records hold, on options, groups, and links', async () => {
    const tag = tagFor(readOptions);
    const el = document.createElement(tag) as Host<OptionRecord>;
    el.innerHTML = '<optgroup label="G"><option value="a">Apple</option></optgroup>';
    container.append(el);
    const option = el.querySelector('option')!;
    const group = el.querySelector('optgroup')!;
    option.setAttribute('value', 'b');
    await mutations();
    expect(texts(el)).toEqual([{ value: 'b', label: 'Apple', group: 'G' }]);
    option.setAttribute('label', 'Banana');
    await mutations();
    expect(texts(el)[0].label).toBe('Banana');
    option.setAttribute('title', 'Yellow');
    await mutations();
    expect(texts(el)[0].description).toBe('Yellow');
    group.setAttribute('label', 'H');
    await mutations();
    expect(texts(el)[0].group).toBe('H');
    group.setAttribute('disabled', '');
    await mutations();
    expect(texts(el)).toEqual([
      { value: 'b', label: 'Banana', description: 'Yellow', group: 'H', disabled: true },
    ]);
    const links = document.createElement(tagFor(readLinks)) as Host<LinkRecord>;
    links.innerHTML = '<a href="/a">A</a>';
    container.append(links);
    links.querySelector('a')!.setAttribute('href', '/b');
    await mutations();
    expect(links.source.records.value).toEqual([{ label: 'A', href: '/b' }]);
  });

  it('keeps the same records when a mutation changes nothing they hold', async () => {
    const tag = tagFor(readOptions);
    const el = document.createElement(tag) as Host<OptionRecord>;
    el.innerHTML = '<option value="a" title="t">Apple</option>';
    container.append(el);
    const before = el.source.records.value;
    el.querySelector('option')!.setAttribute('title', 't');
    el.querySelector('option')!.setAttribute('class', 'x');
    el.append(document.createElement('span'));
    await mutations();
    expect(el.source.records.value).toBe(before);
  });

  it('lets the property win, even when empty, and reports both sources once', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const tag = tagFor(readOptions);
    const el = document.createElement(tag) as Host<OptionRecord>;
    el.innerHTML = '<option value="a" selected>Apple</option>';
    container.append(el);
    expect(warn).not.toHaveBeenCalled();
    el.options = [{ value: 'b', label: 'Banana' }];
    flush();
    expect(texts(el)).toEqual([{ value: 'b', label: 'Banana' }]);
    expect(el.source.selected.value).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toMatch(
      /^\[collection\.source\.conflict\] <test-collection-\d+> has both `options` and declarative children/,
    );
    el.options = [];
    flush();
    expect(texts(el)).toEqual([]);
    el.append(new Option('Cherry', 'c'));
    await mutations();
    expect(warn).toHaveBeenCalledTimes(1);
    el.options = undefined;
    flush();
    expect(texts(el).map((r) => r.value)).toEqual(['a', 'c']);
    expect(el.source.selected.value).toEqual(['a']);
  });

  it('does not report a property with no children, or children with no property', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const tag = tagFor(readOptions);
    const a = document.createElement(tag) as Host<OptionRecord>;
    a.options = [{ value: 'b', label: 'Banana' }];
    a.append(document.createElement('span'));
    const b = document.createElement(tag) as Host<OptionRecord>;
    b.innerHTML = '<option>Apple</option>';
    container.append(a, b);
    await mutations();
    expect(warn).not.toHaveBeenCalled();
  });

  it('names the property it was given in the report', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const tag = tagFor(readMenuItems, 'items');
    const el = document.createElement(tag) as Host<MenuItemRecord>;
    el.innerHTML = '<hr>';
    el.options = [];
    container.append(el);
    flush();
    expect(warn.mock.calls[0]![0]).toContain('both `items` and declarative children; `items` wins');
  });

  it('stops following children when disconnected and catches up when connected again', async () => {
    const tag = tagFor(readLinks);
    const el = document.createElement(tag) as Host<LinkRecord>;
    el.innerHTML = '<a href="/a">A</a>';
    container.append(el);
    el.remove();
    flush();
    expect(scopeStats()).toEqual(baseline);
    el.innerHTML = '<a href="/b">B</a>';
    await mutations();
    expect(el.source.records.value).toEqual([{ label: 'A', href: '/a' }]);
    container.append(el);
    expect(el.source.records.value).toEqual([{ label: 'B', href: '/b' }]);
  });
});
