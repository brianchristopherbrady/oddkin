import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';
import { contextPickerRecipeStyles } from './context-picker.recipe.styles.js';

/**
 * The C07 look (Figma page 767:2, `Oddkin/AI/ContextPicker/*`) on the shared sheets: the overlay
 * surface, the field control for the search and the scope, option rows with the control indicator,
 * and native buttons (md: secondary Done and Retry, ghost Close, Selected, Browse, Cancel, and the
 * browse buttons, primary Add N). Here only what they leave: the icon trigger square, its plus at
 * the small icon size; the surface 26rem wide and 30rem tall
 * (the shared surface keeps it within the room the placement leaves), its content `space.xs` in,
 * with only the collection scrolling (its buttons' focus rings inset, as its rows' are, so it clips
 * none); Back, Load more, and Retry at its start, as wide as their labels (Figma draws them at the
 * start, 176 px); the title in the AI title type; the search field `space.2xs` in on every side, so its focus
 * ring fills the search box as Figma's inline search draws it; rows `space.xs` in with the small
 * radius, at least 3.5rem, the sunken fill while pressed, two lines of name and two of metadata at
 * most, a single choice's indicator round with its dot (as the radio group draws it);
 * the query's match in the link colour; feedback `space.md` in, its title in the UI type and its
 * text in the field's small type; the loading placeholders; the count that pushes the footer's
 * buttons to the end. The sheet (Figma MobileSurface) fills the viewport (or the safe area); the
 * expanded browser (ExpandedBrowser) is 65rem wide, within `space.md` of the viewport, with the
 * card radius and the scrim behind it. In both, the content is `space.md` in and `space.sm` apart,
 * the title in the title type, the scope row and the collection's parts and rows `space.xs` apart,
 * and the scope and Selected share the row. The browser's body scrolls as a whole (its focus rings
 * inset, as the collection's): the sources (12rem, `space.xs` in) and the review (17rem,
 * `space.sm` in) on the sunken fill, beside the collection, which takes the rest; the sources'
 * buttons share their lines. Every surface clips; the arrangement is the layout recipe.
 */
export const contextPickerStyles = css`
  ${contextPickerRecipeStyles}
  :host {
    display: inline-block;
  }
  .odd-button {
    font-weight: ${token('type.ui.weight')};
  }
  .odd-button.icon {
    aspect-ratio: 1;
    padding-inline: 0;
    font-size: ${token('icon.size.sm')};
  }
  .surface {
    overflow: hidden;
  }
  .surface:popover-open {
    display: flex;
    inline-size: 26rem;
    block-size: 30rem;
  }
  .fullscreen {
    inline-size: 100%;
    block-size: 100%;
    max-inline-size: none;
    max-block-size: none;
    border: 0;
    border-radius: 0;
    padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom)
      env(safe-area-inset-left);
  }
  .browser {
    inline-size: 65rem;
    max-inline-size: calc(100% - 2 * ${token('space.md')});
    border-radius: ${token('card.radius')};
  }
  .browser::backdrop {
    background: ${token('color.scrim')};
  }
  dialog[open] {
    display: flex;
  }
  dialog .content {
    gap: ${token('space.sm')};
    padding: ${token('space.md')};
  }
  dialog .title {
    font-size: ${token('type.title.size')};
    line-height: ${token('type.title.line-height')};
  }
  dialog :is(.scope-row, .collection, .results) {
    gap: ${token('space.xs')};
  }
  dialog .scope-row > * {
    flex: 1 1 40%;
  }
  .nav,
  .review {
    background: ${token('color.surface.sunken')};
  }
  .nav {
    flex: 1 1 12rem;
    padding: ${token('space.xs')};
  }
  .nav > * {
    flex: 1 1 8rem;
  }
  .main {
    flex: 999 1 20rem;
  }
  .review {
    flex: 1 1 17rem;
    padding: ${token('space.sm')};
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
  .collection,
  .body {
    flex: 1 1 auto;
    min-block-size: 0;
    overflow-y: auto;
  }
  :is(.collection, .body) :focus-visible {
    outline-offset: calc(-1 * ${token('focus.width')});
  }
  .back,
  .more,
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
  :is(.feedback, .review) p {
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
