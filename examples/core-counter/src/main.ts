import { countChange } from './index.js';

// Ordinary DOM code: the page talks to the elements through properties, attributes, and events.
const greeting = document.querySelector('demo-greeting');
const nameInput = document.querySelector<HTMLInputElement>('#name');
const excited = document.querySelector<HTMLInputElement>('#excited');
const log = document.querySelector('#log');

nameInput?.addEventListener('change', () => {
  if (!greeting) return;
  greeting.history = [...greeting.history, greeting.name];
  greeting.name = nameInput.value || 'world';
});
excited?.addEventListener('change', () => {
  if (greeting) greeting.excited = excited.checked;
});
document.addEventListener(countChange.type, (event) => {
  const item = document.createElement('li');
  item.textContent = `count-change: ${(event as CustomEvent<{ count: number }>).detail.count}`;
  log?.prepend(item);
});

document.body.dataset['ready'] = 'true';
