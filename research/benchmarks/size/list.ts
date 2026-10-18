// Collections + keyed repeat for a data-driven list (what a navigation component would add).
import { OddkinElement, define, html, repeat } from '@oddkin/core';
import { collection } from '@oddkin/core/collections';

interface Item {
  id: string;
  label: string;
}

class XList extends OddkinElement.with({}) {
  readonly items = collection<Item>({ key: (item) => item.id });
  protected override render() {
    return html`<ul>
      ${repeat(
        this.items.flat,
        (e) => e.key,
        (e) => html`<li>${e.item.label}</li>`,
      )}
    </ul>`;
  }
}

define('x-list', XList);
