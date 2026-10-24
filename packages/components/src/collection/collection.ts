/**
 * Authoring collections (component-contracts.md §2.2): the record types of value, action, and link
 * collections, readers for their declarative children (read as data, never rendered), and
 * `CollectionSource`, which normalizes the children and the element's property into one readable,
 * following the children with a `MutationObserver` owned by the element's scope. Internal to
 * `@oddkin/components`; elements re-export the record types they take.
 */
import { computed, signal, type Readable } from '@oddkin/core/reactive';
import type { Controller, Scope } from '@oddkin/core/scope';

/** One choice of a value collection (`odd-select`, `odd-listbox`, `odd-combobox`, radio groups). */
export interface OptionRecord {
  /** Submitted and compared value. */
  readonly value: string;
  /** Visible text and accessible name. */
  readonly label: string;
  /** Secondary text; from a declarative option's `title`. */
  readonly description?: string;
  readonly disabled?: boolean;
  /** Label of the group the option belongs to (a declarative `<optgroup label>`). */
  readonly group?: string;
}

/** One entry of an action collection (`odd-menu`, `odd-split-button`). */
export type MenuItemRecord = MenuActionRecord | MenuGroupRecord | MenuSeparatorRecord;

/** An action; with `items`, it opens a submenu instead. */
export interface MenuActionRecord {
  readonly kind?: 'item';
  /** Reported as the `odd-action` detail's `id` when the action is chosen. */
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  /** Icon URL, drawn as `odd-icon` draws `src`. */
  readonly icon?: string;
  /** Keyboard shortcut shown at the end, e.g. "Ctrl+S"; the host handles the keys. */
  readonly shortcut?: string;
  readonly disabled?: boolean;
  readonly tone?: 'danger';
  readonly items?: readonly MenuItemRecord[];
}

/** A labelled group of entries (a declarative `<optgroup label>`). */
export interface MenuGroupRecord {
  readonly kind: 'group';
  readonly id?: string;
  readonly label: string;
  readonly items: readonly MenuItemRecord[];
}

/** A separator between entries (a declarative `<hr>`). */
export interface MenuSeparatorRecord {
  readonly kind: 'separator';
  readonly id?: string;
}

/** One link of a link collection (`odd-breadcrumbs`). */
export interface LinkRecord {
  readonly label: string;
  readonly href: string;
}

/** One item of a hierarchy (`odd-tree`); from data only, there are no declarative children. */
export interface TreeItemRecord {
  /** Reported as the `odd-toggle` detail's `id`, and as the selected `value`. */
  readonly id: string;
  readonly label: string;
  /** Icon URL, drawn as `odd-icon` draws `src`. */
  readonly icon?: string;
  readonly disabled?: boolean;
  readonly children?: readonly TreeItemRecord[];
  /** Children not loaded yet: the item can expand, and is busy until `children` is set. */
  readonly lazy?: boolean;
}

/** What a reader found in the declarative children. */
export interface Declared<R> {
  readonly records: readonly R[];
  /** Values of `<option selected>` children, in order (value collections). */
  readonly selected: readonly string[];
}

const text = (node: Node) => (node.textContent ?? '').replace(/\s+/g, ' ').trim();

function optionRecord(option: HTMLOptionElement, group: HTMLOptGroupElement | null): OptionRecord {
  return {
    value: option.value,
    label: option.label,
    ...(option.title ? { description: option.title } : {}),
    ...(option.disabled || group?.disabled ? { disabled: true } : {}),
    ...(group ? { group: group.label } : {}),
  };
}

/** `<option value disabled selected title>` and `<optgroup label disabled>` children. */
export function readOptions(host: Element): Declared<OptionRecord> {
  const records: OptionRecord[] = [];
  const selected: string[] = [];
  const add = (option: HTMLOptionElement, group: HTMLOptGroupElement | null) => {
    records.push(optionRecord(option, group));
    if (option.defaultSelected) selected.push(option.value);
  };
  for (const child of host.children) {
    if (child instanceof HTMLOptionElement) add(child, null);
    else if (child instanceof HTMLOptGroupElement)
      for (const option of child.children)
        if (option instanceof HTMLOptionElement) add(option, child);
  }
  return { records, selected };
}

/** An option and its index in the collection. */
export interface OptionRow {
  readonly option: OptionRecord;
  readonly index: number;
}
/** A run of options; `label` is the group's, or undefined for an option outside any group. */
export interface OptionGroup {
  readonly label: string | undefined;
  readonly rows: OptionRow[];
}

/** Consecutive options with the same `group` form one group; options without one stand alone. */
export function groupsOf(options: readonly OptionRecord[]): OptionGroup[] {
  const groups: OptionGroup[] = [];
  options.forEach((option, index) => {
    const last = groups[groups.length - 1];
    if (last && option.group !== undefined && last.label === option.group)
      last.rows.push({ option, index });
    else groups.push({ label: option.group, rows: [{ option, index }] });
  });
  return groups;
}

function menuItem(option: HTMLOptionElement, group: HTMLOptGroupElement | null): MenuActionRecord {
  return {
    id: option.value,
    label: option.label,
    ...(option.title ? { description: option.title } : {}),
    ...(option.disabled || group?.disabled ? { disabled: true } : {}),
  };
}

/** `<option value disabled title>` (value = item id), `<optgroup label>`, and `<hr>` children. */
export function readMenuItems(host: Element): Declared<MenuItemRecord> {
  const records: MenuItemRecord[] = [];
  for (const child of host.children) {
    if (child instanceof HTMLOptionElement) records.push(menuItem(child, null));
    else if (child instanceof HTMLHRElement) records.push({ kind: 'separator' });
    else if (child instanceof HTMLOptGroupElement)
      records.push({
        kind: 'group',
        label: child.label,
        items: [...child.children]
          .filter((option): option is HTMLOptionElement => option instanceof HTMLOptionElement)
          .map((option) => menuItem(option, child)),
      });
  }
  return { records, selected: [] };
}

/**
 * Assigns the host's child nodes that are not collection entries (`<option>`, `<optgroup>`, `<hr>`)
 * to `slot`, in a shadow root with `slotAssignment: 'manual'`, and again whenever the children
 * change while `scope` lives: an element whose default slot holds its own content (a trigger's
 * label) never renders its entries.
 */
export function assignContent(
  scope: Scope,
  host: HTMLElement,
  slot: () => HTMLSlotElement | null | undefined,
): void {
  const assign = () =>
    slot()?.assign(
      ...[...host.childNodes].filter(
        (node): node is Element | Text =>
          (node instanceof Element || node instanceof Text) &&
          !(
            node instanceof HTMLOptionElement ||
            node instanceof HTMLOptGroupElement ||
            node instanceof HTMLHRElement
          ),
      ),
    );
  assign();
  const observer = new MutationObserver(assign);
  observer.observe(host, { childList: true });
  scope.add(() => observer.disconnect(), 'slotted content');
}

/** `<a href>` descendants (text = label), so a server-rendered list of links works as it is. */
export function readLinks(host: Element): Declared<LinkRecord> {
  const records = [...host.querySelectorAll('a[href]')].map((link) => ({
    label: text(link),
    href: link.getAttribute('href') as string,
  }));
  return { records, selected: [] };
}

const same = (a: Declared<unknown>, b: Declared<unknown>) =>
  JSON.stringify(a) === JSON.stringify(b);

export interface CollectionSourceOptions<R> {
  /** The element whose light-DOM children are read. */
  readonly host: HTMLElement;
  /** The element's property name, for the conflict report. */
  readonly name: string;
  /** The property's value; `undefined` (not set) means the children are the source. */
  readonly property: () => readonly R[] | undefined;
  /** `readOptions`, `readMenuItems`, or `readLinks`. */
  readonly read: (host: HTMLElement) => Declared<R>;
}

/**
 * One collection from two forms: the property when it is set (even to an empty array), otherwise
 * the declarative children. Connect it in `connected(scope)`, before the first render, so children
 * that already exist (server-rendered, or written before the element was defined) render at once;
 * children added, removed, or edited later are followed while connected. Both present: the
 * property wins and `collection.source.conflict` is reported once per element.
 */
export class CollectionSource<R> implements Controller {
  readonly #options: CollectionSourceOptions<R>;
  readonly #declared = signal<Declared<R>>({ records: [], selected: [] }, { equals: same });
  #warned = false;

  /** The records in use. */
  readonly records: Readable<readonly R[]>;
  /** Values of `<option selected>` children; empty while the property is set. */
  readonly selected: Readable<readonly string[]>;

  constructor(options: CollectionSourceOptions<R>) {
    this.#options = options;
    this.records = computed(() => options.property() ?? this.#declared.value.records);
    this.selected = computed(() => (options.property() ? [] : this.#declared.value.selected));
  }

  connect(scope: Scope): void {
    const { host, read } = this.#options;
    const refresh = () => (this.#declared.value = read(host));
    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(host, {
      childList: true,
      subtree: true,
      characterData: true,
      attributeFilter: ['value', 'label', 'disabled', 'selected', 'title', 'href'],
    });
    scope.add(() => observer.disconnect(), 'collection source');
    scope.effect(() => {
      if (this.#warned || !this.#options.property() || !this.#declared.value.records.length) return;
      this.#warned = true;
      console.warn(
        `[collection.source.conflict] <${host.localName}> has both \`${this.#options.name}\` and declarative children; \`${this.#options.name}\` wins and the children are ignored.`,
      );
    });
  }
}
