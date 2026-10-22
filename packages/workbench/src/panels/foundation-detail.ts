/**
 * Foundation detail content (workbench-pages.md §5). The Spacing page is the reference slice
 * (§5.3): an introduction derived from the library's own spacing tokens, the scale with
 * proportional samples, and the semantic vocabulary only where declared. Every value is the
 * generated baseline; nothing is copied from another library.
 */
import { OddkinElement, prop } from '@oddkin/core/element';
import { styleMap } from '@oddkin/core/helpers/style-map';
import { html, nothing, repeat } from '@oddkin/core/template';
import type { FoundationPageData, InspectedTokenLike, WorkbenchIndex } from '../data/types.js';
import type { StyleInput } from '@oddkin/core/styles';
import { contentStyles, panelHostStyles } from './styles.js';

type Token = InspectedTokenLike & { readonly missing?: true };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const ROOT_PX = 16;

/** A dimension's size in CSS pixels at a 16px root, for ordering and min/max only. */
export function dimensionPx(value: unknown): number | undefined {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return undefined;
  const match = /^(-?\d*\.?\d+)(px|rem|em)?$/.exec(value.trim());
  if (!match) return undefined;
  const amount = Number(match[1]);
  return match[2] === 'rem' || match[2] === 'em' ? amount * ROOT_PX : amount;
}

const valueText = (token: Token | undefined) =>
  token && !token.missing && token.value !== undefined ? String(token.value) : undefined;

interface Vocabulary {
  readonly id: string;
  readonly entries: readonly { readonly name: string; readonly token: string }[];
}

function vocabularies(foundation: Record<string, unknown>): Vocabulary[] {
  const list = Array.isArray(foundation['vocabularies']) ? foundation['vocabularies'] : [];
  return list.filter(isRecord).flatMap((v) => {
    if (typeof v['id'] !== 'string' || !Array.isArray(v['entries'])) return [];
    const entries = v['entries'].filter(
      (e): e is { name: string; token: string } =>
        isRecord(e) && typeof e['name'] === 'string' && typeof e['token'] === 'string',
    );
    return [{ id: v['id'], entries }];
  });
}

export class FoundationDetailElement extends OddkinElement.with({
  page: prop.object<FoundationPageData>({ description: 'The foundation page data.' }),
  index: prop.object<WorkbenchIndex>({ description: 'The Workbench index.' }),
  href: prop.custom<(route: string) => string>({
    default: () => (route: string) => route,
    coerce: (value) =>
      typeof value === 'function'
        ? { ok: true, value: value as (route: string) => string }
        : { ok: false, reason: 'expected a function' },
    description: 'Maps a Workbench route to a URL.',
  }),
}) {
  static override styles: StyleInput = [panelHostStyles, contentStyles];

  protected override render() {
    const page = this.page;
    const index = this.index;
    if (!page || !index) return html`<div class="wb-content"></div>`;
    const entry = index.registry.pages.find((p) => p.id === page.id);
    const sections = (entry?.sections ?? []).filter((s) => s.visible);
    const handled = new Set<string>();
    return html`<div class="wb-content">
      ${this.#context(page)}
      ${repeat(
        sections,
        (section) => section.id,
        (section) =>
          html`<section id=${section.id} aria-labelledby=${`${section.id}-title`}>
            <h2 id=${`${section.id}-title`}>${section.title}</h2>
            ${this.#section(section.id, page, handled)}
          </section>`,
      )}
    </div>`;
  }

  /** The context every value-bearing section shows (§5.1): the generated baseline. */
  #context(page: FoundationPageData) {
    const generation = isRecord(page.foundation['generation'])
      ? page.foundation['generation']['value']
      : undefined;
    const theme =
      isRecord(generation) && typeof generation['theme'] === 'string'
        ? generation['theme']
        : undefined;
    return html`<p class="wb-meta wb-context" role="note">
      Showing the saved baseline${theme ? html` (theme <code>${theme}</code>)` : nothing}, as
      generated from source configuration. Values keep their source units.
    </p>`;
  }

  #section(id: string, page: FoundationPageData, handled: Set<string>) {
    const vocab = vocabularies(page.foundation);
    if (id === 'scale') return this.#scale(page);
    if (id === 'semantic-vocabulary' || id === 'vocabulary')
      return this.#vocabulary(
        page,
        vocab.find((v) => v.id === 'semantic'),
        true,
      );
    if (id === 'component-mappings')
      return this.#vocabulary(
        page,
        vocab.find((v) => v.id === 'component-mappings'),
        false,
      );
    if (!handled.has('tokens')) {
      handled.add('tokens');
      return this.#tokenTable(page.tokens, 'Tokens this foundation lists.');
    }
    return html`<p class="wb-muted">
      This section's generated view is not available yet; its tokens are listed above.
    </p>`;
  }

  #scale(page: FoundationPageData) {
    const steps = page.tokens
      .map((token) => ({ token, px: dimensionPx(token.value) }))
      .sort(
        (a, b) =>
          (a.px ?? Infinity) - (b.px ?? Infinity) || a.token.name.localeCompare(b.token.name),
      );
    const sized = steps.filter((s) => s.px !== undefined && s.px > 0);
    const min = sized[0];
    const max = sized.at(-1);
    const generation = isRecord(page.foundation['generation'])
      ? page.foundation['generation']['value']
      : undefined;
    const origins =
      isRecord(generation) && Array.isArray(generation['origins'])
        ? generation['origins'].filter((o): o is string => typeof o === 'string')
        : [];
    const density = page.tokens.some((t) => (t as { density?: unknown }).density === true);
    const maxPx = max?.px ?? 0;
    return html`<p class="wb-intro">
        ${steps.length}
        steps${
          min && max
            ? html` from <code>${valueText(min.token)}</code> to
                <code>${valueText(max.token)}</code>`
            : nothing
        }${
          origins.length
            ? html`, generated from the theme's ${origins.join(' and ')} values`
            : nothing
        }.${density ? html` Steps scale with density (<code>data-odd-density</code>).` : nothing}
      </p>
      <div class="wb-table-wrap">
        <table class="wb-stack" data-table="scale">
          <caption>
            Samples are drawn at this page's root font size; widths are proportional to each value.
          </caption>
          <thead>
            <tr>
              <th scope="col">Token</th>
              <th scope="col">Value</th>
              <th scope="col">Sample</th>
              <th scope="col">Origin</th>
            </tr>
          </thead>
          <tbody>
            ${steps.map(({ token, px }) => {
              const value = valueText(token);
              return html`<tr data-token=${token.name}>
                <th scope="row" data-label="Token">
                  <code>${token.name}</code>
                  ${token.cssVariable ? html`<small><code>${token.cssVariable}</code></small>` : nothing}
                </th>
                <td data-label="Value">${value ? html`<code>${value}</code>` : 'Unknown'}</td>
                <td data-label="Sample">
                  ${
                    value && px !== undefined && px > 0
                      ? html`<span
                          class="wb-bar"
                          role="img"
                          aria-label=${`${value}${maxPx ? `, ${Math.round((px / maxPx) * 100)}% of the largest step` : ''}`}
                          style=${styleMap({ inlineSize: value })}
                        ></span>`
                      : html`<span class="wb-muted">${value ? 'none' : 'Unknown'}</span>`
                  }
                </td>
                <td data-label="Origin">${token.origin ?? 'Unknown'}</td>
              </tr>`;
            })}
          </tbody>
        </table>
      </div>`;
  }

  #vocabulary(page: FoundationPageData, vocabulary: Vocabulary | undefined, semantic: boolean) {
    if (!vocabulary?.entries.length)
      return html`<p class="wb-muted">
        The library declares no ${semantic ? 'semantic vocabulary' : 'component mappings'}.
      </p>`;
    const byName = new Map(page.tokens.map((t) => [t.name, t] as const));
    return html`<div class="wb-table-wrap">
      <table class="wb-stack" data-table=${vocabulary.id}>
        <thead>
          <tr>
            <th scope="col">${semantic ? 'Semantic token' : 'Component token'}</th>
            <th scope="col">Reference step</th>
            <th scope="col">Value</th>
          </tr>
        </thead>
        <tbody>
          ${vocabulary.entries.map((entry) => {
            const value = valueText(byName.get(entry.token));
            return html`<tr>
              <th scope="row" data-label=${semantic ? 'Semantic token' : 'Component token'}>
                <code>${entry.name}</code>
              </th>
              <td data-label="Reference step"><code>${entry.token}</code></td>
              <td data-label="Value">${value ? html`<code>${value}</code>` : 'Unknown'}</td>
            </tr>`;
          })}
        </tbody>
      </table>
    </div>`;
  }

  #tokenTable(tokens: readonly Token[], caption: string) {
    if (!tokens.length) return html`<p class="wb-muted">No tokens are listed.</p>`;
    return html`<div class="wb-table-wrap">
      <table class="wb-stack" data-table="tokens">
        <caption>
          ${caption}
        </caption>
        <thead>
          <tr>
            <th scope="col">Token</th>
            <th scope="col">Value</th>
            <th scope="col">Origin</th>
          </tr>
        </thead>
        <tbody>
          ${tokens.map(
            (token) =>
              html`<tr>
                <th scope="row" data-label="Token">
                  <code>${token.name}</code>
                  ${token.cssVariable ? html`<small><code>${token.cssVariable}</code></small>` : nothing}
                </th>
                <td data-label="Value">
                  ${valueText(token) ? html`<code>${valueText(token)}</code>` : 'Unknown'}
                </td>
                <td data-label="Origin">${token.origin ?? 'Unknown'}</td>
              </tr>`,
          )}
        </tbody>
      </table>
    </div>`;
  }
}
