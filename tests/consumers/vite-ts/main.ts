import '@oddkin/tokens/css/default.css';
import '@oddkin/components/css/base.css';
import '@oddkin/components/css/layout.css';
import './styles.scss';
import '@oddkin/components/define/card';
import '@oddkin/components/define/input';
import '@oddkin/components/define/checkbox';
import '@oddkin/components/define/button';
import { token } from '@oddkin/tokens/refs';

const form = document.querySelector<HTMLFormElement>('#signup')!;
const result = document.querySelector<HTMLOutputElement>('#result')!;
const email: HTMLElementTagNameMap['odd-input'] = form.querySelector('odd-input')!;

// Typed token references compile to the custom properties the theme stylesheet declares.
document.querySelector<HTMLElement>('main')!.style.padding = token('space.lg');
form.addEventListener('submit', (event) => {
  event.preventDefault();
  result.value = JSON.stringify({
    ...Object.fromEntries(new FormData(form)),
    valid: email.validity.valid,
  });
});
