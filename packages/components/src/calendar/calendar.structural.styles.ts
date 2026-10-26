import { css } from '@oddkin/core/styles';

/**
 * The calendar under the field label: the month row (buttons at the ends, the month centred), the
 * date table, a divider, and the actions row. Cells keep a transparent border, so today's outline
 * moves nothing. Forced colours paint every border in CanvasText, so dates other than today take
 * Canvas; the chosen date takes the system selection colours, and dates that cannot be chosen
 * GrayText (`.grid` outranks the skin's states). No brand or visual tokens.
 */
export const calendarStructuralStyles = css`
  :host {
    display: block;
  }
  .calendar {
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    inline-size: fit-content;
    max-inline-size: 100%;
  }
  .header,
  .actions {
    display: flex;
    align-items: center;
  }
  .heading {
    flex: 1 1 auto;
    text-align: center;
  }
  .actions {
    justify-content: space-between;
  }
  .odd-button {
    flex: none;
  }
  .grid {
    border-collapse: separate;
  }
  .weekday,
  .day {
    box-sizing: border-box;
    padding: 0;
    text-align: center;
    vertical-align: middle;
  }
  .weekday {
    font-weight: inherit;
  }
  .day {
    border: 1px solid transparent;
    cursor: pointer;
  }
  .day[aria-disabled='true'] {
    cursor: not-allowed;
  }
  @media (forced-colors: active) {
    .grid .day:not([aria-current='date']) {
      border-color: Canvas;
    }
    .grid .day[aria-selected='true'] {
      border-color: SelectedItem;
      background: SelectedItem;
      color: SelectedItemText;
    }
    .grid .day[aria-disabled='true'] {
      color: GrayText;
    }
  }
`;
