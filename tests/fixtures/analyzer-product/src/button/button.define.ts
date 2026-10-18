import { define } from '@oddkin/core/element';
import { studioButtonDefinition } from './button.definition.js';

define(studioButtonDefinition);

declare global {
  interface HTMLElementTagNameMap {
    'studio-button': import('./button.js').StudioButton;
  }
}
