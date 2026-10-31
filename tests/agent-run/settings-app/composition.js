import '@oddkin/components/define/card';
import '@oddkin/components/define/input';
import '@oddkin/components/define/switch';
import '@oddkin/components/define/select';
import '@oddkin/components/define/button';
import { renderComposition } from '@oddkin/components/composition';

// Exactly the tags settings.composition.json uses; the renderer refuses any other.
const ALLOW = ['odd-card', 'h1', 'odd-input', 'odd-switch', 'odd-select', 'odd-button'];

// odd-select's `options` cannot be written in a composition, so the host supplies them.
const FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

const app = document.getElementById('app');
const actions = document.getElementById('actions');

function logAction({ action }) {
  const item = document.createElement('li');
  item.textContent = action;
  actions.append(item);
}

function showProblem(message, diagnostics = []) {
  const text = document.createElement('p');
  text.setAttribute('role', 'alert');
  text.textContent = [message, ...diagnostics.map((d) => `${d.code} at ${d.path}: ${d.message}`)].join(' ');
  app.replaceChildren(text);
  console.error(message, diagnostics);
}

try {
  const response = await fetch(new URL('./settings.composition.json', import.meta.url));
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const composition = await response.json();
  const rendered = renderComposition(composition, app, { allow: ALLOW, onAction: logAction });
  if (rendered.ok) app.querySelector('#frequency').options = FREQUENCY_OPTIONS;
  else showProblem('The settings composition was refused.', rendered.diagnostics);
} catch (error) {
  showProblem(`The settings composition could not be loaded: ${error.message}`);
}
