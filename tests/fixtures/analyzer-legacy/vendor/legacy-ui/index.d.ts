import { OddkinElement } from '@oddkin/core';
import type { ElementDefinition } from '@oddkin/core/element';

/** Published by an older analyzer: CEM and definition facts, no per-source facts. */
export declare class LegacyButton extends OddkinElement {
  tone: string;
}
/** An element class the package does not document in its CEM. */
export declare class LegacyPanel extends HTMLElement {}
export declare const legacyButtonDefinition: ElementDefinition<LegacyButton>;

declare global {
  interface HTMLElementTagNameMap {
    'legacy-button': LegacyButton;
  }
}
