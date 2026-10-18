// A vendored package: the analyzer finds it by its own package.json, whatever the specifier.
import { LegacyButton, LegacyPanel, legacyButtonDefinition } from '../vendor/legacy-ui/index.js';
import { compose, define } from '@oddkin/core/element';
import { css } from '@oddkin/core/styles';

class AcmeLegacyButton extends LegacyButton {}

/** Extends an element class its package does not document. */
export class AcmePanel extends LegacyPanel {}

export const acmeLegacyButtonDefinition = compose({
  ...legacyButtonDefinition,
  name: 'acme-legacy-button',
  element: AcmeLegacyButton,
  styles: [
    css`
      :host {
        color: var(--acme-ink);
      }
    `,
  ],
});
define(acmeLegacyButtonDefinition);
