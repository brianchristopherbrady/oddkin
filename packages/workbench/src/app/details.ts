/**
 * The shell's detail content: the public panels' renderers in the light DOM, so the shell's
 * "On this page" links and URL fragments reach the section headings.
 */
import { ComponentDetailElement } from '../panels/component-detail.js';
import { FoundationDetailElement } from '../panels/foundation-detail.js';
import type { StyleInput } from '@oddkin/core/styles';
import { contentStyles } from '../panels/styles.js';
import { exampleStyles } from '../panels/example-styles.js';

export class WorkbenchComponentDetail extends ComponentDetailElement {
  static override shadowRootOptions = null;
  static override styles: StyleInput = [contentStyles, exampleStyles];
}

export class WorkbenchFoundationDetail extends FoundationDetailElement {
  static override shadowRootOptions = null;
  static override styles: StyleInput = contentStyles;
}

declare global {
  interface HTMLElementTagNameMap {
    'oddkin-workbench-component': WorkbenchComponentDetail;
    'oddkin-workbench-foundation': WorkbenchFoundationDetail;
  }
}
