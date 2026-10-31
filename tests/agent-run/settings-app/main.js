import '@oddkin/components/define/card';
import '@oddkin/components/define/input';
import '@oddkin/components/define/switch';
import '@oddkin/components/define/select';
import '@oddkin/components/define/button';
import '@oddkin/components/define/alert';

const form = document.getElementById('settings-form');
const email = document.getElementById('email');
const status = document.getElementById('status');

// `error` is a custom validity message: drop it once the user edits the address.
email.addEventListener('input', () => {
  if (email.error) email.error = '';
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  status.replaceChildren();
  // Judge the field by its own constraints (required, type="email"), not by an earlier message.
  email.error = '';
  await email.updateComplete;
  if (!form.reportValidity()) {
    if (!email.validity.valid) email.error = email.validationMessage;
    return;
  }
  const saved = document.createElement('odd-alert');
  saved.tone = 'success';
  saved.textContent = 'Settings saved.';
  status.append(saved);
});
