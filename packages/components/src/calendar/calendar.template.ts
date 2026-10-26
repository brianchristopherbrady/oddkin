import { html } from '@oddkin/core/template';
import { externalDescriptionTemplate } from '../form-control/description.js';
import { chevronEndGlyph, chevronStartGlyph } from '../styles/glyphs.js';
import type { CalendarDay, OddkinCalendar } from './calendar.js';

/**
 * Anatomy: the `label` and `description`, then the `calendar` surface: a `header` with the
 * `previous` and `next` month buttons around the `heading` (month and year, a polite live region),
 * the `grid` table of `weekday` column headers over six weeks of `day` cells (with `day-outside`,
 * `day-today`, `day-selected`, `day-disabled`), a divider, and the `actions` row with the `today`
 * and `clear` buttons; then the `error`. The cell on the active date is the grid's one Tab stop.
 */
export const calendarTemplate = (calendar: OddkinCalendar) => {
  const text = calendar._strings.value;
  const inactive = calendar._inactive;
  const active = calendar._active.value;
  const value = calendar.value;
  const today = calendar._today;
  // `aria-disabled` on the field marks its texts as part of a disabled control, as odd-slider does.
  return html`<div part="field" class="field" aria-disabled=${inactive ? 'true' : null}>
    <div part="label" id="label" class="label" ?hidden=${!calendar.label}>${calendar.label}</div>
    <div part="description" id="description" class="description" ?hidden=${!calendar.description}>
      ${calendar.description}
    </div>
    <div
      part="calendar"
      class="calendar"
      role="group"
      aria-labelledby=${calendar.label ? 'label' : 'heading'}
      aria-describedby=${calendar._describedBy}
      aria-invalid=${calendar._userInvalid.value ? 'true' : null}
      @focusout=${calendar._onFocusOut}
    >
      <div part="header" class="header">
        <button
          part="previous"
          class="odd-button nav"
          data-appearance="ghost"
          data-size="sm"
          type="button"
          aria-label=${text.previousMonth}
          ?disabled=${inactive || !calendar._canMove(-1)}
          @click=${() => calendar._onMonth(-1)}
        >
          ${chevronStartGlyph}
        </button>
        <div part="heading" id="heading" class="heading" aria-live="polite">
          ${calendar._format(active, 'month')}
        </div>
        <button
          part="next"
          class="odd-button nav"
          data-appearance="ghost"
          data-size="sm"
          type="button"
          aria-label=${text.nextMonth}
          ?disabled=${inactive || !calendar._canMove(1)}
          @click=${() => calendar._onMonth(1)}
        >
          ${chevronEndGlyph}
        </button>
      </div>
      <table
        part="grid"
        class="grid"
        role="grid"
        aria-labelledby="heading"
        aria-disabled=${inactive ? 'true' : null}
        aria-readonly=${calendar.readonly ? 'true' : null}
        @keydown=${calendar._onKeydown}
      >
        <thead>
          <tr>
            ${calendar._weekdays.map(
              (weekday) =>
                html`<th part="weekday" class="weekday" scope="col" abbr=${weekday.long}>
                  ${weekday.short}
                </th>`,
            )}
          </tr>
        </thead>
        <tbody>
          ${calendar._weeks.map(
            (week) =>
              html`<tr>
                ${week.map((day) => dayCell(calendar, day, { active, today, value, inactive }))}
              </tr>`,
          )}
        </tbody>
      </table>
      <div class="divider"></div>
      <div part="actions" class="actions">
        <button
          part="today"
          class="odd-button"
          data-appearance="ghost"
          data-size="sm"
          type="button"
          ?disabled=${inactive || calendar.readonly || !calendar._selectable(today)}
          @click=${calendar._onToday}
        >
          ${text.today}
        </button>
        <button
          part="clear"
          class="odd-button"
          data-appearance="ghost"
          data-size="sm"
          type="button"
          ?disabled=${inactive || calendar.readonly || !value}
          @click=${calendar._onClear}
        >
          ${text.clear}
        </button>
      </div>
    </div>
    <div part="error" id="error" class="error" ?hidden=${!calendar.error}>${calendar.error}</div>
    ${externalDescriptionTemplate(calendar._externalDescription)}
  </div>`;
};

interface CellContext {
  readonly active: number;
  readonly today: number;
  readonly value: string;
  readonly inactive: boolean;
}

/** A date cell; its state parts (`day-outside`, `day-today`, …) follow the date. */
const dayCell = (calendar: OddkinCalendar, day: CalendarDay, at: CellContext) => {
  const { active, today, value, inactive } = at;
  const selected = day.iso === value;
  const parts = [
    'day',
    day.outside && 'day-outside',
    day.day === today && 'day-today',
    selected && 'day-selected',
    day.disabled && 'day-disabled',
  ];
  const part = parts.filter(Boolean).join(' ');
  return html`<td
    part=${part}
    class="day"
    role="gridcell"
    data-date=${day.iso}
    tabindex=${inactive ? null : day.day === active ? '0' : '-1'}
    aria-label=${calendar._format(day.day, 'full')}
    aria-selected=${selected ? 'true' : 'false'}
    aria-current=${day.day === today ? 'date' : null}
    aria-disabled=${day.disabled || inactive ? 'true' : null}
    @click=${() => calendar._onDay(day.day)}
  >
    ${calendar._format(day.day, 'numeric')}
  </td>`;
};
