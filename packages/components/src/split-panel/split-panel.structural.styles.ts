import { css } from '@oddkin/core/styles';

/**
 * Both panes and the separator on a grid whose first track ends half a separator before the shown
 * position (`--_position`, percent of the element), so the separator's centre sits on it. Panes
 * scroll their own overflow; a collapsed start pane is hidden and its track is empty. No visual
 * tokens.
 */
export const splitPanelStructuralStyles = css`
  :host {
    display: block;
  }
  .split {
    --_size: var(--odd-split-panel-separator-size, 1rem);
    --_first: max(0px, calc(var(--_position) * 1% - var(--_size) / 2));
    display: grid;
    grid-template-columns: var(--_first) var(--_size) minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr);
    block-size: 100%;
  }
  :host([orientation='vertical']) .split {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: var(--_first) var(--_size) minmax(0, 1fr);
  }
  .pane {
    min-inline-size: 0;
    min-block-size: 0;
    overflow: auto;
  }
  .start {
    grid-area: 1 / 1;
  }
  .separator {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    grid-area: 1 / 2;
    touch-action: none;
  }
  .end {
    grid-area: 1 / 3;
  }
  :host([orientation='vertical']) .separator {
    grid-area: 2 / 1;
  }
  :host([orientation='vertical']) .end {
    grid-area: 3 / 1;
  }
  /* The grip's dots run along the separator. */
  :host(:not([orientation='vertical'])) .separator .glyph {
    rotate: 90deg;
  }
  @media (forced-colors: active) {
    :host .separator {
      border-inline: 1px solid CanvasText;
    }
    :host([orientation='vertical']) .separator {
      border-inline: 0;
      border-block: 1px solid CanvasText;
    }
    :host .dragging .separator {
      background: Highlight;
      color: HighlightText;
    }
  }
`;
