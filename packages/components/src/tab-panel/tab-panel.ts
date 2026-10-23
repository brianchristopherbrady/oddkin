import { OddkinElement, prop } from '@oddkin/core/element';
import type { Scope } from '@oddkin/core/scope';

/**
 * One panel of `odd-tabs`: its tab's text, its value, and the content shown while its tab is
 * selected. `odd-tabs` assigns it to a tab panel inside its own shadow root, so the tab and the
 * panel reference each other while the content stays in the light DOM.
 *
 * @slot - The panel content.
 * @a11y The surrounding `odd-tabs` gives the panel `role="tabpanel"`, names it by its tab, and hides it while another tab is selected; on its own it has no role.
 * @previewRole tabPanel
 * @useFor The content of one tab of odd-tabs.
 * @notFor Content outside odd-tabs (use a section with a heading).
 * @category Navigation
 */
export class OddkinTabPanel extends OddkinElement.with({
  label: prop.string({ default: '', description: 'The text of its tab.' }),
  value: prop.string({
    default: '',
    description:
      'Identifies the panel in `odd-tabs` `value`; without it, its position ("0", "1", …).',
  }),
  disabled: prop.boolean({ reflect: true, description: 'Its tab cannot be selected.' }),
}) {
  protected override connected(_scope: Scope): void {
    // An odd-tabs parent rendered before this panel was defined learns about it now.
    (this.parentElement as { _panelsChanged?: () => void } | null)?._panelsChanged?.();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'odd-tab-panel': OddkinTabPanel;
  }
}
