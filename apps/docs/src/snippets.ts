export const tokenCssSnippet = `.notice {
  color: var(--odd-color-text-primary);
  padding: var(--odd-space-md);
}`;

export function componentSnippet(registration: string, tag: string): string {
  return `import '${registration}';

const element = document.createElement('${tag}');
element.textContent = 'Example content';
document.body.append(element);`;
}
