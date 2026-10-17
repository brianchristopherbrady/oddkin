// Collections + keyed repeat for a data-driven list (what a navigation component would add).
import { MoteElement, define, html, repeat } from '@mote/core';
import { collection } from '@mote/core/collections';

interface Item {
  id: string;
  label: string;
}

class XList extends MoteElement.with({}) {
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
