import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';
import { contextPickerRecipeStyles } from './context-picker.recipe.styles.js';

/**
 * The C07 look (Figma page 767:2, `Oddkin/AI/ContextPicker/*`) on the shared sheets: the overlay
 * surface, the field control for the search and the scope, option rows with the control indicator,
 * and native buttons (md: secondary Done and Retry, ghost Close, Selected, Browse, Cancel, and the
 * browse buttons, primary Add N). Here only what they leave: the surface 26rem wide and 30rem tall
 * (the shared surface keeps it within the room the placement leaves), its content `space.xs` in,
 * with only the collection scrolling (its buttons' focus rings inset, as its rows' are, so it clips
 * none); the title in the AI title type; the search field `space.2xs` in on every side, so its focus
 * ring fills the search box as Figma's inline search draws it; rows `space.xs` in with the small
 * radius, at least 3.5rem, the sunken fill while pressed, two lines of name and two of metadata at
 * most, a single choice's indicator round with its dot (as the radio group draws it);
 * the query's match in the link colour; feedback `space.md` in, its title in the UI type and its
 * text in the field's small type; the loading placeholders; the count that pushes the footer's
 * buttons to the end. The arrangement is the layout recipe.
 */
export const contextPickerStyles = css`
  ${contextPickerRecipeStyles}
  :host {
    display: inline-block;
  }
  .odd-button {
    font-weight: ${token('type.ui.weight')};
  }
  .surface:popover-open {
    display: flex;
    inline-size: 26rem;
    block-size: 30rem;
    overflow: hidden;
  }
  .content {
    flex: 1 1 auto;
    min-block-size: 0;
    padding: ${token('space.xs')};
  }
  .title {
    margin: 0;
    font-size: ${token('font.size.md')};
    font-weight: ${token('font.weight.semibold')};
    letter-spacing: ${token('letter-spacing.normal')};
    line-height: ${token('line-height.normal')};
  }
  .search-field {
    padding: ${token('space.2xs')};
  }
  .status-line,
  .count {
    margin: 0;
    color: ${token('color.text.secondary')};
    font-size: ${token('type.small.size')};
    line-height: ${token('type.small.line-height')};
  }
  .status-line.danger,
  .feedback-title.danger {
    color: ${token('color.danger.foreground')};
  }
  .collection {
    flex: 1 1 auto;
    min-block-size: 0;
    overflow-y: auto;
  }
  .collection .odd-button:focus-visible {
    outline-offset: calc(-1 * ${token('focus.width')});
  }
  .retry {
    align-self: start;
  }
  .results:focus-visible {
    outline: none;
  }
  .option {
    min-block-size: max(3.5rem, ${token('target.min')});
    padding: ${token('space.xs')};
    border-radius: ${token('radius.sm')};
    cursor: pointer;
  }
  .option:not([aria-disabled='true']):active {
    background: ${token('color.surface.sunken')};
  }
  .option-icon {
    display: inline-flex;
    flex: none;
    font-size: ${token('icon.size.md')};
  }
  .radio > .indicator-box,
  .indicator-dot {
    border-radius: ${token('radius.full')};
  }
  .indicator-dot {
    inline-size: 40%;
    block-size: 40%;
    background: currentColor;
  }
  .name,
  .option .option-description {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    overflow: hidden;
  }
  .option .option-description {
    font-weight: ${token('type.small.weight')};
  }
  .match {
    background: none;
    color: ${token('color.link')};
  }
  .feedback {
    padding: ${token('space.md')};
  }
  .feedback p {
    margin: 0;
  }
  .feedback-title {
    font-size: ${token('type.ui.size')};
    font-weight: ${token('type.ui.weight')};
    letter-spacing: ${token('type.ui.letter-spacing')};
    line-height: ${token('type.ui.line-height')};
  }
  .feedback-text {
    color: ${token('color.text.secondary')};
    font-size: ${token('font.size.sm')};
    line-height: ${token('line-height.normal')};
  }
  .placeholder {
    inline-size: 100%;
    block-size: ${token('space.sm')};
    background: ${token('color.surface.sunken')};
  }
  .count {
    flex: 1 1 auto;
  }
`;
