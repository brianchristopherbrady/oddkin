import type { CommandRecord, OddkinCommandPalette } from '@oddkin/components/command-palette';
import type { Scope } from '@oddkin/core/scope';
import { currentOf, navigation, primaryCurrent, primaryLinks } from './pages/site.js';

/**
 * The docs shell's behavior: the light and dark switch, the narrow-screen menu, search (an
 * odd-command-palette over every page and component), and the current-page marks. The server
 * renders the shell; without this module it is a plain, working page.
 */

const MODE_KEY = 'oddkin-docs-mode';
const systemDark = matchMedia('(prefers-color-scheme: dark)');
const root = document.documentElement;

const isDark = (): boolean =>
  root.dataset['oddMode'] === 'dark' || (root.dataset['oddMode'] !== 'light' && systemDark.matches);

function modeToggle(scope: Scope): void {
  const button = document.querySelector<HTMLButtonElement>('.mode-toggle');
  if (!button) return;
  const sync = () => button.setAttribute('aria-pressed', String(isDark()));
  sync();
  scope.listen(systemDark, 'change', sync);
  scope.listen(button, 'click', () => {
    const mode = isDark() ? 'light' : 'dark';
    root.dataset['oddMode'] = mode;
    try {
      localStorage.setItem(MODE_KEY, mode);
    } catch {
      // Not stored (a privacy mode): the choice lasts for this page.
    }
    sync();
  });
  button.hidden = false;
}

const menuButton = () => document.querySelector<HTMLButtonElement>('.menu-toggle');
const sidebar = () => document.querySelector<HTMLElement>('#docs-nav');

function setMenu(open: boolean): void {
  menuButton()?.setAttribute('aria-expanded', String(open));
  sidebar()?.toggleAttribute('data-open', open);
}

function menu(scope: Scope): void {
  const button = menuButton();
  const nav = sidebar();
  if (!button || !nav) return;
  scope.listen(button, 'click', () => setMenu(button.getAttribute('aria-expanded') !== 'true'));
  scope.listen<KeyboardEvent>(nav, 'keydown', (event) => {
    if (event.key !== 'Escape' || !nav.hasAttribute('data-open')) return;
    setMenu(false);
    button.focus();
  });
  button.hidden = false;
}

const pageCommands = (): CommandRecord[] =>
  navigation().flatMap(({ group, links }) =>
    links.map((link) => ({ id: link.href, label: link.label, group })),
  );

async function componentCommands(): Promise<CommandRecord[]> {
  const response = await fetch('/public/@oddkin/components/oddkin.metadata.json');
  if (!response.ok) throw new Error(`Could not load the component index: HTTP ${response.status}.`);
  const { components } = (await response.json()) as {
    components: Record<string, { tag: string; useFor?: string[] }>;
  };
  return Object.values(components).map(({ tag, useFor }) => ({
    id: `/components/${tag}`,
    label: `<${tag}>`,
    ...(useFor?.[0] ? { description: useFor[0] } : {}),
    group: 'Components',
  }));
}

function search(scope: Scope, navigate: (path: string) => void): void {
  const trigger = document.querySelector<HTMLAnchorElement>('.search-trigger');
  if (!trigger) return;
  if (/Mac|iPhone|iPad/.test(navigator.userAgent)) {
    const shortcut = document.querySelector('.shortcut');
    if (shortcut) shortcut.textContent = '\u2318 K';
  }
  let palette: OddkinCommandPalette | undefined;
  const open = async () => {
    if (!palette) {
      await import('@oddkin/components/define/command-palette');
      palette = document.createElement('odd-command-palette') as OddkinCommandPalette;
      palette.label = 'Search docs';
      palette.placeholder = 'Pages and components';
      palette.strings = { search: 'Search docs', empty: 'No matching pages or components' };
      palette.items = pageCommands();
      palette.loading = true;
      scope.listen<CustomEvent<{ id: string }>>(palette, 'odd-action', (event) =>
        navigate(event.detail.id),
      );
      document.body.append(palette);
      const commands = palette;
      componentCommands()
        .then((components) => (commands.items = [...pageCommands(), ...components]))
        .catch(reportError)
        .finally(() => (commands.loading = false));
    }
    palette.open = true;
  };
  scope.listen<MouseEvent>(trigger, 'click', (event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    event.preventDefault();
    void open();
  });
  scope.listen<KeyboardEvent>(document, 'keydown', (event) => {
    if (event.key.toLowerCase() !== 'k' || !(event.ctrlKey || event.metaKey) || event.altKey)
      return;
    event.preventDefault();
    void open();
  });
}

/** Marks the links to the page at `path` and above it, and closes the narrow-screen menu. */
export function showRoute(path: string): void {
  for (const link of document.querySelectorAll<HTMLAnchorElement>('.side-nav > a')) {
    const value = currentOf(new URL(link.href).pathname, path);
    if (value) link.setAttribute('aria-current', value);
    else link.removeAttribute('aria-current');
  }
  for (const link of document.querySelectorAll<HTMLAnchorElement>('.primary-nav a')) {
    const destination = primaryLinks.find(
      (candidate) => `/${candidate.path}` === new URL(link.href).pathname,
    );
    const value = destination && primaryCurrent(destination, path);
    if (value) link.setAttribute('aria-current', value);
    else link.removeAttribute('aria-current');
  }
  setMenu(false);
}

/** Starts the shell's behavior; `navigate` moves the docs router. */
export function startShell(scope: Scope, navigate: (path: string) => void): void {
  root.toggleAttribute('data-docs-js', true);
  modeToggle(scope);
  menu(scope);
  search(scope, navigate);
  // Pages carry the elements they show (sidebar, copy buttons, cards, the home page's examples).
  void import('@oddkin/components/autoload');
}
