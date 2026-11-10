import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';
import { contextPickerRecipeStyles } from './context-picker.recipe.styles.js';

/**
 * The C07 look (Figma page 767:2) on the shared sheets: the overlay surface, the field control for
 * the search and the scope, option rows with the control indicator, and native buttons. Here only
 * what they leave: the surface 26rem wide (20 to 28 within the room the placement leaves) and at
 * most 30rem tall, with only the results scrolling; rows at least 3.5rem with a one-line name and
 * two lines of metadata; the query's match in the link colour; the loading placeholders; the count
 * that pushes the footer's buttons to the end. The arrangement is the layout recipe.
 */
export const contextPickerStyles = css`
  ${contextPickerRecipeStyles}
  :host {
    display: inline-block;
  }
  .trigger {
    gap: ${token('control.gap')};
  }
  .surface:popover-open {
    display: flex;
    inline-size: min(26rem, max(20rem, var(--_overlay-max-inline-size, 26rem)));
    max-inline-size: min(28rem, var(--_overlay-max-inline-size, 28rem));
    max-block-size: min(30rem, var(--_overlay-max-block-size, 30rem));
    padding: ${token('space.sm')} ${token('space.sm')} 0;
    overflow: hidden;
  }
  .title {
    margin: 0;
    font-family: ${token('type.ui.family')};
    font-size: ${token('type.ui.size')};
    font-weight: ${token('font.weight.semibold')};
    line-height: ${token('type.ui.line-height')};
  }
  .search-field {
    padding-block: ${token('space.2xs')};
  }
  .search {
    inline-size: 100%;
  }
  .status-line {
    margin: 0;
    color: ${token('color.text.secondary')};
    font-size: ${token('type.small.size')};
    line-height: ${token('type.small.line-height')};
  }
  .status-line.danger,
  .feedback-title.danger {
    color: ${token('color.danger.foreground')};
  }
  .results {
    flex: 1 1 auto;
    min-block-size: 0;
    overflow-y: auto;
  }
  .results:focus-visible {
    outline: none;
  }
  .option {
    min-block-size: max(3.5rem, ${token('target.min')});
    padding-block: ${token('space.2xs')};
    cursor: pointer;
  }
  .option-icon {
    display: inline-flex;
    flex: none;
    font-size: ${token('icon.size.md')};
  }
  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .option .option-description {
    max-block-size: calc(2 * ${token('type.small.line-height')} * 1em);
    overflow: hidden;
  }
  .match {
    background: none;
    color: ${token('color.link')};
  }
  .feedback {
    padding: ${token('space.sm')} ${token('space.md')};
  }
  .feedback[hidden] {
    display: none;
  }
  .feedback p {
    margin: 0;
  }
  .feedback-title {
    font-weight: ${token('font.weight.medium')};
  }
  .feedback-text {
    color: ${token('color.text.secondary')};
  }
  .placeholder {
    inline-size: 100%;
    block-size: ${token('space.sm')};
    background: ${token('color.surface.sunken')};
  }
  .footer {
    min-block-size: 3.5rem;
    margin-inline: calc(-1 * ${token('space.sm')});
    padding-inline: ${token('space.sm')};
    border-block-start: ${token('border.width.default')} solid ${token('color.border.default')};
  }
  .count {
    flex: 1 1 auto;
    color: ${token('color.text.secondary')};
    font-size: ${token('type.small.size')};
  }
`;
