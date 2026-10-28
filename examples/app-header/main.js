// Plain JavaScript, no build: register odd-button and wire the narrow menu button (a disclosure).
import '@oddkin/components/define/button';

const header = document.querySelector('.app-header');
const toggle = header.querySelector('.menu-toggle');
toggle.addEventListener('click', () => {
  const open = toggle.getAttribute('aria-expanded') !== 'true';
  toggle.setAttribute('aria-expanded', String(open));
  header.toggleAttribute('data-menu-open', open);
});

document.body.dataset.ready = 'true';
