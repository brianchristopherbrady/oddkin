// The renderer contract (`renderComposition`, `NATIVE`) in miniature, for the frame's tests: it
// refuses a document whose elements are not allowed or not registered, else appends them, and
// focuses a `data-focus` element.
type Child = string | { element: string; attributes?: Record<string, string>; children?: Child[] };

export const NATIVE = { p: {} };

export function renderComposition(
  document: { root?: Child[] } | null,
  target: Element,
  options: { allow: readonly string[] },
) {
  const root = document?.root ?? [];
  const diagnostics: { code: string; severity: string; path: string; message: string }[] = [];
  const check = (nodes: Child[], path: string) =>
    nodes.forEach((node, i) => {
      if (typeof node === 'string') return;
      if (
        !options.allow.includes(node.element) ||
        (node.element.includes('-') && !customElements.get(node.element))
      )
        diagnostics.push({
          code: 'fixture.refused',
          severity: 'error',
          path: `${path}/${i}/element`,
          message: `"${node.element}" is refused.`,
        });
      check(node.children ?? [], `${path}/${i}/children`);
    });
  check(root, '/root');
  if (diagnostics.length) return { ok: false, diagnostics, dispose() {} };
  const create = (node: Child): ChildNode => {
    if (typeof node === 'string') return target.ownerDocument.createTextNode(node);
    const element = target.ownerDocument.createElement(node.element);
    for (const [name, value] of Object.entries(node.attributes ?? {}))
      element.setAttribute(name, value);
    element.append(...(node.children ?? []).map(create));
    return element;
  };
  const nodes = root.map(create);
  target.append(...nodes);
  // As a modal dialog does when it opens.
  target.querySelector<HTMLElement>('[data-focus]')?.focus();
  const dispose = () => {
    nodes.forEach((node) => node.remove());
    const count = Number(target.getAttribute('data-disposed') ?? 0);
    target.setAttribute('data-disposed', String(count + 1));
  };
  return { ok: true, diagnostics, dispose };
}
