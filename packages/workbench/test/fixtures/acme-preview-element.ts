class AcmePreviewButton extends HTMLElement {
  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const button = document.createElement('button');
    button.textContent = 'Preview ready';
    root.append(button);
  }
}

customElements.define('acme-button', AcmePreviewButton);
