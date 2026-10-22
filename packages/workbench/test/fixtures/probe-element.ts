// A preview fixture that records every property assignment and attribute change, so tests can
// assert exactly which writes the API table makes (and that none are made twice).
class WbProbe extends HTMLElement {
  static observedAttributes = ['tone', 'open', 'label', 'count'];
  readonly writes: string[] = [];
  #tone = 'calm';
  #open = false;
  #label = '';
  #count = 0;
  #items: unknown = [];
  #value = '';

  #record(name: string, value: unknown) {
    this.writes.push(`prop ${name}=${JSON.stringify(value)}`);
  }
  get tone() {
    return this.#tone;
  }
  set tone(value: string) {
    this.#record('tone', value);
    this.#tone = value;
  }
  get open() {
    return this.#open;
  }
  set open(value: boolean) {
    this.#record('open', value);
    this.#open = value;
  }
  get label() {
    return this.#label;
  }
  set label(value: string) {
    this.#record('label', value);
    this.#label = value;
  }
  get count() {
    return this.#count;
  }
  set count(value: number) {
    this.#record('count', value);
    this.#count = value;
  }
  get items() {
    return this.#items;
  }
  set items(value: unknown) {
    this.#record('items', value);
    this.#items = value;
  }
  get value() {
    return this.#value;
  }
  set value(value: string) {
    this.#record('value', value);
    this.#value = value;
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null) {
    this.writes.push(`attr ${name}=${value === null ? 'null' : JSON.stringify(value)}`);
  }

  connectedCallback() {
    if (this.shadowRoot) return;
    const root = this.attachShadow({ mode: 'open' });
    const button = document.createElement('button');
    button.textContent = 'Ping';
    button.addEventListener('click', () => {
      const detail: Record<string, unknown> = {
        count: this.#count,
        node: this,
        fn: function handler() {},
        map: new Map([['a', 1]]),
        error: new Error('boom'),
      };
      detail['self'] = detail;
      this.dispatchEvent(new CustomEvent('wb-ping', { bubbles: true, composed: true, detail }));
    });
    const input = document.createElement('input');
    input.setAttribute('aria-label', 'Probe value');
    // The component's own handler runs before listeners on the host see the composed event.
    input.addEventListener('input', () => {
      this.#value = input.value;
    });
    const slot = document.createElement('slot');
    root.append(button, input, slot);
  }
}

customElements.define('wb-probe', WbProbe);
