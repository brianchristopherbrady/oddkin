import { html } from '@oddkin/core/template';
import type { OddkinTabPanel } from './tab-panel.js';

/** Anatomy: the default slot only; `odd-tabs` draws the tab and the panel around it. */
export const tabPanelTemplate = (_panel: OddkinTabPanel) => html`<slot></slot>`;
