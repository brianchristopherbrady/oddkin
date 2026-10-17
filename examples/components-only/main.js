// Plain JavaScript, no build: register the two elements and use ordinary DOM APIs.
import '@mote/components/define/button';
import '@mote/components/define/card';

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

document.body.dataset.ready = 'true';
