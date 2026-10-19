// Plain JavaScript, no build: register the elements and use ordinary DOM APIs.
import '@oddkin/components/define/button';
import '@oddkin/components/define/card';
import '@oddkin/components/define/input';

const form = document.querySelector('#billing');
const result = document.querySelector('#result');

form.addEventListener('submit', (event) => {
  event.preventDefault();
  // The submitter exists only during dispatch; read the form data here.
  const data = new FormData(form, event.submitter);
  result.textContent = `Submitted ${[...data].map(([k, v]) => `${k}=${v}`).join('&')}`;
});
form.addEventListener('reset', () => {
  result.textContent = 'Reset';
});
document.querySelector('#help').addEventListener('click', () => {
  result.textContent = 'Receipts and invoices go to the email address above.';
});

document.body.dataset.ready = 'true';
