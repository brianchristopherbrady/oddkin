class AlternateFrameFixtureButton extends HTMLElement {
  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const button = document.createElement('button');
    button.textContent = 'Alternate';
    root.append(button);
  }
}

customElements.define('fixture-button', AlternateFrameFixtureButton);
