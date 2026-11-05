/**
 * Theme Studio's ramp and contrast views (workbench.md §8), loaded with the first result that
 * carries them: each generated ramp step by step, and the library's own contrast report of the
 * role pairs its theme contracts, for the theme or product the frames show. The values are the
 * generator's, as its Worker sends them; nothing here measures colour. Colours are SVG fills, so
 * the module needs no style helper of its own (a shared chunk more in the shell's initial load).
 */
import { html } from '@oddkin/core/template';
import type { ContrastView, ThemeViews } from '../preview/theme-generation.js';

const swatch = (color: string) =>
  html`<svg class="wb-swatch" aria-hidden="true" viewBox="0 0 1 1">
    <rect width="1" height="1" fill=${color}></rect>
  </svg>`;

/** The ramps as one table: a row per step, a column per ramp (`ref.<ramp>.<step>`). */
export function rampsView(views: ThemeViews, label: string) {
  const ramps = new Map<string, Map<string, string>>();
  for (const [name, value] of views.ramps) {
    const parts = name.split('.');
    const step = parts.pop() ?? '';
    const ramp = parts.slice(1).join('.');
    ramps.set(ramp, (ramps.get(ramp) ?? new Map<string, string>()).set(step, value));
  }
  // Numeric steps in order (a ramp may start lower or end higher than another), others as given.
  const steps = [...new Set([...ramps.values()].flatMap((ramp) => [...ramp.keys()]))].sort(
    (a, b) => Number(a) - Number(b) || 0,
  );
  return html`<section id="ramps" aria-labelledby="ramps-title">
    <h2 id="ramps-title">Ramps</h2>
    <p class="wb-muted">
      Generated ${label} from the theme inputs; roles alias these steps. Values in sRGB.
    </p>
    <div class="wb-table-wrap">
      <table>
        <caption class="wb-visually-hidden">
          Ramps, one column per ramp
        </caption>
        <thead>
          <tr>
            <th scope="col">Step</th>
            ${[...ramps.keys()].map((ramp) => html`<th scope="col">${ramp}</th>`)}
          </tr>
        </thead>
        <tbody>
          ${steps.map(
            (step) =>
              html`<tr>
                <th scope="row">${step}</th>
                ${[...ramps.values()].map((ramp) => {
                  const value = ramp.get(step);
                  return html`<td>
                    ${value ? html`${swatch(value)} <code>${value}</code>` : ''}
                  </td>`;
                })}
              </tr>`,
          )}
        </tbody>
      </table>
    </div>
  </section>`;
}

const ORDER: readonly ContrastView['status'][] = ['fail', 'exempt', 'pass'];

/** The contrast report's pairs, failures first, with a sample in each pair's colours. */
export function contrastView(views: ThemeViews, label: string) {
  const pairs = [...views.contrast].sort(
    (a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status),
  );
  const count = (status: ContrastView['status']) =>
    pairs.filter((pair) => pair.status === status).length;
  return html`<section id="contrast" aria-labelledby="contrast-title">
    <h2 id="contrast-title">Contrast</h2>
    <p id="ts-contrast-summary">
      ${pairs.length} role pairs ${label}: ${count('pass')} pass, ${count('fail')} fail,
      ${count('exempt')} exempt.
    </p>
    <p class="wb-muted">
      WCAG 2.x contrast ratios of the role pairs the theme contracts, as its generator measures
      them: text against 1.4.3, controls and focus against 1.4.11. Not an accessibility
      certification: content, states, and contexts the theme does not define still need checking.
    </p>
    <div class="wb-table-wrap">
      <table>
        <caption class="wb-visually-hidden">
          Contrast of the role pairs, failures first
        </caption>
        <thead>
          <tr>
            <th scope="col">Foreground on background</th>
            <th scope="col">Mode</th>
            <th scope="col">Sample</th>
            <th scope="col">Ratio</th>
            <th scope="col">Needs</th>
            <th scope="col">Result</th>
          </tr>
        </thead>
        <tbody>
          ${pairs.map(
            (pair) =>
              html`<tr data-status=${pair.status}>
                <th scope="row">
                  <code>${pair.foreground}</code> on <code>${pair.background}</code>
                </th>
                <td>${pair.mode}</td>
                <td>
                  <svg aria-hidden="true" viewBox="0 0 30 18" width="30" height="18">
                    <rect width="30" height="18" fill=${pair.backgroundHex}></rect>
                    <text
                      x="15"
                      y="13"
                      text-anchor="middle"
                      font-size="12"
                      fill=${pair.foregroundHex}
                    >
                      Aa
                    </text>
                  </svg>
                </td>
                <td>${pair.ratio.toFixed(2)}:1</td>
                <td>${pair.minimum ? `${pair.minimum}:1, ` : ''}${pair.criterion}</td>
                <td>${pair.status}</td>
              </tr>`,
          )}
        </tbody>
      </table>
    </div>
  </section>`;
}
