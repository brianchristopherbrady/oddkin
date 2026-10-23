import { styleMap } from '@oddkin/core/helpers/style-map';
import { html } from '@oddkin/core/template';
import { moreGlyph } from '../styles/glyphs.js';
import type { OddkinSplitPanel } from './split-panel.js';

/**
 * Anatomy: `part="base"`, a grid of `part="start"` (slot `start`), `part="separator"` (the focusable
 * `role="separator"` with a grip glyph), and `part="end"` (slot `end`). The separator's centre sits
 * at the shown position, so a drag moves it exactly with the pointer.
 */
export const splitPanelTemplate = (panel: OddkinSplitPanel) => {
  const shown = panel._shown;
  const vertical = panel.orientation === 'vertical';
  return html`<div
    part="base"
    class=${panel._dragging.value ? 'split dragging' : 'split'}
    style=${styleMap({ '--_position': shown })}
  >
    <div part="start" class="pane start" id="start" ?hidden=${panel.collapsed}>
      <slot name="start"></slot>
    </div>
    <div
      part="separator"
      class="separator"
      role="separator"
      tabindex="0"
      aria-label=${panel._label}
      aria-orientation=${vertical ? 'horizontal' : 'vertical'}
      aria-controls="start"
      aria-valuenow=${String(Math.round(shown))}
      aria-valuemin=${String(panel.collapsed ? 0 : panel._min)}
      aria-valuemax=${String(panel._max)}
      @keydown=${panel._onKeydown}
    >
      ${moreGlyph}
    </div>
    <div part="end" class="pane end"><slot name="end"></slot></div>
  </div>`;
};
