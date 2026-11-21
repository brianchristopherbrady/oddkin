# Checkbox browser verification

An independent run exercised Checkbox, Checkbox Group, Switch, and the form controls Figma parity suite in Chromium, Firefox, and WebKit. All 12 files passed with 410 passing cases and four expected skips.

```powershell
node node_modules/vitest/vitest.mjs run --project browser --reporter=dot --browser.screenshotFailures=false --testTimeout=45000 packages/components/test/checkbox.browser.test.ts packages/components/test/checkbox-group.browser.test.ts packages/components/test/switch.browser.test.ts packages/components/test/figma-parity.forms.browser.test.ts
```

The Checkbox tests exercised native label and Space activation, default and dirty checkedness, form submit, reset and restore, required validity, disabled fieldsets, and focus and input identity during responsive reflow. The controlled cases exercised replacement snapshots, ignored requests, same-turn stale request suppression, synchronous and deferred app acceptance, pre-upgrade state, and returning to uncontrolled mode. The existing parity suite compares all 15 canonical Checkbox variants.

The parity assertions inspect browser behavior and styles. Manual assistive technology testing was outside this run. Vitest reported a browser shutdown timeout after test results and exited successfully.
