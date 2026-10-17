import { html } from '@mote/core';
import type { AcmePanel } from './panel.js';

export const panelTemplate = (panel: AcmePanel) =>
  html`<section part="frame">
    <header><slot name="heading"></slot></header>
    <div part="body"><slot></slot></div>
    ${
      panel.dismissible
        ? html`<button part="dismiss" @click=${panel.onDismissClick}>×</button>`
        : null
    }
  </section>`;
