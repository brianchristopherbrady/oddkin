// Plain JavaScript, no build: the form is ordinary HTML, and the Oddkin controls take part in
// it like native ones (validation, reset, FormData, a disabled fieldset).
import '@oddkin/components/define/alert';
import '@oddkin/components/define/button';
import '@oddkin/components/define/card';
import '@oddkin/components/define/checkbox-group';
import '@oddkin/components/define/input';
import '@oddkin/components/define/validation-summary';

const form = document.querySelector('#settings');
const fields = document.querySelector('#fields');
const save = document.querySelector('#save');
const cancel = document.querySelector('#cancel');
const feedback = document.querySelector('#feedback');
const unsaved = document.querySelector('#unsaved');
const controls = () => [...form.querySelectorAll('odd-input, odd-checkbox')];

let dirty = false;
const setDirty = (value) => {
  dirty = value;
  unsaved.hidden = !value;
};

/** Stands in for the request a real application sends; `data-save-fails` on <body> fails it. */
const send = (data) =>
  new Promise((resolve, reject) =>
    setTimeout(
      () =>
        document.body.dataset.saveFails === 'true' ? reject(new Error('offline')) : resolve(data),
      600,
    ),
  );

/** Shows one alert in the status region, replacing the last. */
const show = (tone, title, message) => {
  const alert = document.createElement('odd-alert');
  alert.tone = tone;
  alert.label = title;
  alert.textContent = message;
  if (tone === 'danger') alert.announce = 'important';
  feedback.replaceChildren(alert);
};

form.addEventListener('input', () => {
  setDirty(true);
  feedback.replaceChildren();
});
form.addEventListener('reset', () => {
  setDirty(false);
  feedback.replaceChildren();
});
// Validation runs before this event: the summary handles a blocked submission.
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = new FormData(form);
  feedback.replaceChildren();
  fields.disabled = true;
  cancel.disabled = true;
  save.loading = true;
  save.textContent = 'Saving…';
  try {
    await send(data);
    // The saved values are the new starting point for Cancel.
    for (const control of controls())
      if ('defaultChecked' in control) control.defaultChecked = control.checked;
      else control.defaultValue = control.value;
    setDirty(false);
    show(
      'success',
      'Changes saved successfully.',
      'Your team can see the updated project details.',
    );
    save.textContent = 'Save changes';
  } catch {
    show(
      'danger',
      'Your changes could not be saved.',
      'Your entries are preserved. Try saving again.',
    );
    save.textContent = 'Retry save';
  } finally {
    fields.disabled = false;
    cancel.disabled = false;
    save.loading = false;
  }
});
addEventListener('beforeunload', (event) => {
  if (dirty) event.preventDefault();
});

document.body.dataset.ready = 'true';
