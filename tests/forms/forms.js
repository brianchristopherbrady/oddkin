// Records each submit event's submitter, so the spec can tell the temporary native button that
// odd-button uses from a native submit button that is its own submitter.
import '@oddkin/components/define/button';
import '@oddkin/components/define/input';

const submits = [];
const invalid = [];
window.__submits = submits;
window.__invalid = invalid;
// Validation still blocks submission; only the bubble, which can swallow later clicks, is hidden.
document.addEventListener(
  'invalid',
  (event) => {
    invalid.push(event.target.localName);
    event.preventDefault();
  },
  true,
);
for (const form of document.forms)
  form.addEventListener('submit', (event) => {
    const submitter = event.submitter;
    const record = {
      form: form.id,
      submitter: submitter?.localName ?? null,
      className: submitter?.className ?? '',
      connectedAfterDispatch: null,
    };
    submits.push(record);
    queueMicrotask(() => (record.connectedAfterDispatch = submitter?.isConnected ?? null));
  });

document.body.dataset.ready = 'true';
