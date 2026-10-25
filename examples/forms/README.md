# Form

A project settings form (Figma `Form`, component-contracts.md §1) built from Oddkin form controls
and plain HTML: `odd-input`, `odd-checkbox-group` with `odd-checkbox` choices,
`odd-validation-summary`, `odd-button`, `odd-alert`, and `odd-card`, laid out with the layout
classes (`odd-stack`, `odd-auto-grid`, `odd-cluster`). No build step: the page loads the packages
through an import map, under a strict Content Security Policy.

What it shows, one Figma state each:

- **Editing**: a native `<form>` and `<fieldset>`; each control submits under its own name.
- **Invalid**: a submission that validation blocks shows the validation summary, which takes focus
  and links to each invalid control; entries are kept.
- **Submitting**: the fieldset is disabled (every control inside follows, as native ones do) and
  the save button shows its busy state.
- **Success** and **Error**: an `odd-alert` in a status region; after a failure the entries stay
  and the button offers to retry.
- **Unsaved changes**: a note after the first edit, and the browser's leave-page prompt until the
  form is saved or reset; Cancel (`type="reset"`) restores the last saved values.

The save is simulated in `main.js`. Set `data-save-fails="true"` on `<body>` to see the failure.

The error messages are the browser's own validation messages, in the browser's language. Figma's
wording ("Enter a project name.") is the application's to supply, with `setCustomValidity()` on
each control, as on native inputs.

Run `npm run build`, serve the repository root (`node scripts/serve-static.mjs`), and open
`/examples/forms/`. `e2e/forms-example.spec.ts` covers the states in Chromium, Firefox, and
WebKit.