/// <reference path="./shell.ts" preserve="true" />
// Registers <oddkin-workbench>, its detail-content elements, and the components the shell renders.
import '@oddkin/components/define/card';
import { define } from '@oddkin/core/element';
import { WorkbenchComponentDetail, WorkbenchFoundationDetail } from './details.js';
import { OddkinWorkbench } from './shell.js';

define('oddkin-workbench', OddkinWorkbench);
define('oddkin-workbench-component', WorkbenchComponentDetail);
define('oddkin-workbench-foundation', WorkbenchFoundationDetail);
