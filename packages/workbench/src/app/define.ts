/// <reference path="./shell.ts" preserve="true" />
// Registers <oddkin-workbench> and the components the shell renders (overview cards).
import '@oddkin/components/define/card';
import { define } from '@oddkin/core/element';
import { OddkinWorkbench } from './shell.js';

define('oddkin-workbench', OddkinWorkbench);
