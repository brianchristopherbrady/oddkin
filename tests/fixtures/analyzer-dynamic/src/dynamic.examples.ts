import { defineExamples as examplesFor } from '@oddkin/workbench/examples';

const tag = 'dynamic-element';
const roles = ['surface'];

// Analyzable only in part: a computed tag, computed preview roles, and an unknown component.
export const dynamicTag = examplesFor(tag, { default: {} });
export const dynamicRoles = examplesFor('dynamic-element', { roles: { previewRoles: roles } });
export const unknown = examplesFor('acme-missing', { default: {} });
