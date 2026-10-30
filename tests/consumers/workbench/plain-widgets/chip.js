// <plain-chip>: a custom element written without any framework. Workbench documents it from its
// custom-elements.json alone, the standard-CEM baseline (workbench.md §1).
const TONES = ['neutral', 'info', 'warning'];

const styles = new CSSStyleSheet();
styles.replaceSync(`
  :host {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0.625rem;
    border-radius: 999px;
    background: var(--plain-chip-background, #e8e8ef);
    color: var(--plain-chip-color, #1d1d2b);
    font: 500 0.875rem/1.25 system-ui, sans-serif;
  }
  :host([tone='info']) {
    background: var(--plain-chip-background, #dbeafe);
  }
  :host([tone='warning']) {
    background: var(--plain-chip-background, #fef3c7);
  }
  [part='count'] {
    font-variant-numeric: tabular-nums;
    opacity: 0.75;
  }
  [part='remove'] {
    border: 0;
    border-radius: 999px;
    padding: 0 0.25rem;
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }
  [hidden] {
    display: none;
  }
`);

export class PlainChip extends HTMLElement {
  static observedAttributes = ['label', 'tone', 'removable'];

  #count;
  #labelPart = document.createElement('span');
  #countPart = document.createElement('span');
  #removePart = document.createElement('button');

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    root.adoptedStyleSheets = [styles];
    const icon = document.createElement('slot');
    icon.name = 'icon';
    this.#labelPart.setAttribute('part', 'label');
    this.#countPart.setAttribute('part', 'count');
    this.#removePart.setAttribute('part', 'remove');
    this.#removePart.type = 'button';
    this.#removePart.setAttribute('aria-label', 'Remove');
    this.#removePart.textContent = '\u00d7';
    this.#removePart.addEventListener('click', () =>
      this.dispatchEvent(
        new CustomEvent('plain-remove', {
          bubbles: true,
          composed: true,
          detail: { label: this.label },
        }),
      ),
    );
    root.append(icon, this.#labelPart, document.createElement('slot'), this.#countPart);
    root.append(this.#removePart);
    this.#render();
  }

  get label() {
    return this.getAttribute('label') ?? '';
  }
  set label(value) {
    this.setAttribute('label', String(value));
  }

  get tone() {
    const tone = this.getAttribute('tone');
    return TONES.includes(tone) ? tone : 'neutral';
  }
  set tone(value) {
    this.setAttribute('tone', String(value));
  }

  get removable() {
    return this.hasAttribute('removable');
  }
  set removable(value) {
    this.toggleAttribute('removable', Boolean(value));
  }

  /** A property only: no attribute sets it. */
  get count() {
    return this.#count;
  }
  set count(value) {
    this.#count = value === undefined || value === null ? undefined : Number(value);
    this.#render();
  }

  attributeChangedCallback() {
    this.#render();
  }

  #render() {
    this.#labelPart.textContent = this.label;
    this.#countPart.textContent = this.#count === undefined ? '' : String(this.#count);
    this.#countPart.hidden = this.#count === undefined;
    this.#removePart.hidden = !this.removable;
  }
}

if (!customElements.get('plain-chip')) customElements.define('plain-chip', PlainChip);
