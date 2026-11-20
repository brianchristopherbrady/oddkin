/** Attributes whose behavior depends on a surrounding app, form, asset server, or fixture. */
const HOST_ATTRIBUTES = [
  'anchor',
  'context',
  'form',
  'from',
  'source-id',
  'name',
  'autocomplete',
  'formaction',
  'formenctype',
  'formmethod',
  'formnovalidate',
  'formtarget',
  'href',
  'src',
  'no-filter',
  'no-sort',
] as const;

const STATIC_BY_COMPONENT: Readonly<Record<string, readonly string[]>> = {
  // These configure field defaults or submission values. The live examples expose user state directly.
  'odd-calendar': ['value'],
  'odd-checkbox': ['checked', 'value'],
  'odd-color-picker': ['value'],
  'odd-date-picker': ['value'],
  'odd-input': ['value'],
  'odd-one-time-code': ['value'],
  'odd-rating': ['value'],
  'odd-slider': ['value'],
  'odd-switch': ['checked', 'value'],
  'odd-textarea': ['value'],
  // These values identify existing records. The supplied example demonstrates choosing them.
  'odd-combobox': ['value'],
  'odd-listbox': ['value'],
  'odd-picker': ['value'],
  'odd-radio-group': ['value'],
  'odd-segmented-control': ['value'],
  'odd-select': ['value'],
  'odd-side-nav': ['current'],
  'odd-tab-panel': ['value'],
  'odd-table': ['sort'],
  'odd-tabs': ['value'],
  'odd-tree': ['value'],
  // These configure form submission or a host action.
  'odd-button': ['type', 'value'],
  'odd-split-button': ['value'],
};

/** Public docs keep these declared attributes as reference rows. */
export function staticExampleAttributes(tag: string): readonly string[] {
  return [...HOST_ATTRIBUTES, ...(STATIC_BY_COMPONENT[tag] ?? [])];
}
