/// <reference path="./catalog.ts" preserve="true" />
// Registers <oddkin-catalog-panel> and the card element its cards use.
import '@oddkin/components/define/card';
import { define } from '@oddkin/core/element';
import { OddkinCatalogPanel } from './catalog.js';

define('oddkin-catalog-panel', OddkinCatalogPanel);
