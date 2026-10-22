class FrameFixtureButton extends HTMLElement {
  #label = 'Default';
  readonly #button: HTMLButtonElement;

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    this.#button = document.createElement('button');
    this.#button.addEventListener('click', () => {
      this.dispatchEvent(
        new CustomEvent('fixture-action', {
          bubbles: true,
          composed: true,
          detail: { label: this.#label },
        }),
      );
    });
    root.append(this.#button);
  }

  set label(value: string) {
    this.#label = value;
    this.#button.textContent = value;
  }

  get label() {
    return this.#label;
  }
}

customElements.define('fixture-button', FrameFixtureButton);
