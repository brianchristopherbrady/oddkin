/// <reference path="./shell.ts" preserve="true" />
// Registers <oddkin-workbench> and the components the shell renders (overview cards).
import '@oddkin/components/define/card';
import { define } from '@oddkin/core/element';
import { WorkbenchComponentPreview } from './component-preview.js';
import { OddkinWorkbench } from './shell.js';

define('oddkin-workbench', OddkinWorkbench);
if (!customElements.get('oddkin-component-preview'))
  customElements.define('oddkin-component-preview', WorkbenchComponentPreview);
