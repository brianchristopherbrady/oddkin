/// <reference types="vite/client" />
import axeSource from 'axe-core/axe.min.js?raw';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { flush } from '@oddkin/core/reactive';

// axe-core (WCAG 2.0, 2.1, 2.2 A and AA rules) over every state of odd-button and odd-input,
// every odd-badge tone, the display elements, and odd-card's naming cases, with the shipped theme
// in light and dark mode, so colour contrast is measured on real values. axe reads open shadow
// roots but not ElementInternals semantics, so card regions are checked in
// e2e/components-only.spec.ts instead.
interface AxeResult {
  id: string;
  impact?: string | null;
  nodes: { target: unknown; failureSummary?: string }[];
}
interface Axe {
  run(
    context: Element | { include: Element[]; exclude: string[][] },
    options: object,
  ): Promise<{ violations: AxeResult[]; incomplete: AxeResult[]; passes: AxeResult[] }>;
}
const axe = () => (window as unknown as { axe: Axe }).axe;
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

const icon =
  '<svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16"><path d="M3 8h10" stroke="currentColor" /></svg>';
const states = `
  <h2>Buttons</h2>
  ${['primary', 'secondary', 'ghost']
    .flatMap((appearance) =>
      ['sm', 'md', 'lg'].map(
        (size) => `<odd-button appearance="${appearance}" size="${size}">Save changes</odd-button>`,
      ),
    )
    .join('')}
  ${['primary', 'secondary', 'ghost']
    .map((a) => `<odd-button appearance="${a}" disabled>Disabled</odd-button>`)
    .join('')}
  <odd-button appearance="primary" loading>Saving</odd-button>
  <odd-button label="Close">${icon}</odd-button>
  <odd-button><span slot="start">${icon}</span>With icons<span slot="end">${icon}</span></odd-button>
  <odd-button full-width>Full width</odd-button>
  <odd-button toggle>Bold</odd-button>
  <odd-button toggle pressed>Italic</odd-button>
  <form id="form">
    <h2>Fields</h2>
    <odd-input label="Name" name="name"></odd-input>
    <odd-input label="Email" description="We never share it." type="email" name="email" required></odd-input>
    <odd-input label="Password" type="password" name="password" autocomplete="current-password"></odd-input>
    <odd-input label="Search" type="search" placeholder="Search the catalog" name="q"></odd-input>
    <odd-input label="Phone" type="tel" name="tel" value="+1 555 0100"></odd-input>
    <odd-input label="Website" type="url" name="url" value="https://example.com"></odd-input>
    <odd-input label="Company" description="As registered." error="This name is taken." name="company"></odd-input>
    <odd-input label="Reference" value="A-1024" readonly name="ref"></odd-input>
    <odd-input label="Region" value="EU" disabled name="region"></odd-input>
    <odd-input id="blocked" label="Postcode" name="postcode" required></odd-input>
    <fieldset disabled><legend>Disabled group</legend><odd-input label="Notes" name="notes"></odd-input></fieldset>
    <odd-checkbox name="updates" checked>Email me about project updates</odd-checkbox>
    <odd-checkbox name="all" indeterminate description="Some are on.">All notifications</odd-checkbox>
    <odd-checkbox name="terms" required error="Accept the terms to continue.">I accept the terms</odd-checkbox>
    <odd-checkbox name="managed" checked disabled>Managed by your workspace</odd-checkbox>
    <odd-switch name="alerts" checked>Alerts</odd-switch>
    <odd-switch name="digest" description="A summary of the week, every Monday.">Weekly digest</odd-switch>
    <odd-switch name="sync" disabled>Managed by your workspace</odd-switch>
    <odd-checkbox-group label="Notifications" description="Choose how to hear from us." required><odd-checkbox name="channel" value="email" checked>Email</odd-checkbox><odd-checkbox name="channel" value="summary">Weekly summary</odd-checkbox></odd-checkbox-group>
    <odd-checkbox-group label="Topics" orientation="horizontal" required error="Choose at least one topic."><odd-checkbox name="topic" value="a">Design</odd-checkbox><odd-checkbox name="topic" value="b">Code</odd-checkbox></odd-checkbox-group>
    <odd-checkbox-group label="Managed" disabled><odd-checkbox name="managed" checked>Synced</odd-checkbox></odd-checkbox-group>
    <odd-radio-group label="Workspace visibility" description="Who can open it." name="visibility"><option value="private" title="Only invited members" selected>Private</option><option value="team" title="Anyone in your workspace">Team</option><option value="public" disabled>Public</option></odd-radio-group>
    <odd-radio-group label="Plan" orientation="horizontal" required error="Choose a plan."><optgroup label="Monthly"><option value="m">Team</option></optgroup><optgroup label="Yearly"><option value="y">Team</option></optgroup></odd-radio-group>
    <odd-radio-group label="Region" disabled><option value="eu" selected>Europe</option><option value="us">Americas</option></odd-radio-group>
    <odd-segmented-control label="Preview size" name="size"><option value="sm" title="Fits more">Small</option><option value="md" selected>Medium</option><option value="lg">Large</option></odd-segmented-control>
    <odd-segmented-control label="Density" size="sm" required error="Choose a density."><option value="a">Compact</option><option value="b">Roomy</option></odd-segmented-control>
    <odd-segmented-control label="Theme" size="lg" disabled><option value="light" selected>Light</option><option value="dark">Dark</option></odd-segmented-control>
    <odd-slider label="Preview scale" name="scale" min="25" max="100" step="5" value="60" description="Applies to the preview only."></odd-slider>
    <odd-slider label="Print scale" value="90" error="Use 80 or less for print."></odd-slider>
    <odd-slider label="Locked scale" value="40" disabled></odd-slider>
    <odd-rating label="Your rating" description="Choose one to five stars." name="score" value="3"></odd-rating>
    <odd-rating label="Service" required error="Choose a rating before continuing."></odd-rating>
    <odd-rating label="Locked rating" value="2" disabled></odd-rating>
    <odd-rating label="Average rating" description="Rating from 24 responses." value="4" readonly></odd-rating>
    <odd-textarea label="Project description" name="about" placeholder="Describe this project…" maxlength="500"></odd-textarea>
    <odd-textarea label="Feedback" description="Tell us what to improve." name="feedback" required error="Feedback is required." maxlength="200"></odd-textarea>
    <odd-textarea label="Terms" name="terms-text" value="Read only." readonly resize="none"></odd-textarea>
    <odd-textarea label="History" name="history" value="Managed." disabled resize="auto"></odd-textarea>
    <odd-button type="submit" appearance="primary">Submit</odd-button>
    <odd-button type="reset">Reset</odd-button>
  </form>
  <h2>Cards</h2>
  <odd-card label="Billing"><p>Named by its label.</p></odd-card>
  <odd-card><h3 slot="header">Plan</h3><p>Named by its heading.</p><odd-button slot="footer">Upgrade</odd-button></odd-card>
  <odd-card appearance="filled"><p>No name, no landmark.</p></odd-card>
  <odd-card appearance="elevated" padding="sm"><p>Elevated.</p></odd-card>
  <h2>Badges</h2>
  <p>
    <odd-badge>Draft</odd-badge>
    <odd-badge tone="info">Beta</odd-badge>
    <odd-badge tone="success">Published</odd-badge>
    <odd-badge tone="warning">Expires soon</odd-badge>
    <odd-badge tone="danger">Failed</odd-badge>
    <odd-badge no-marker>12</odd-badge>
  </p>
  <h2>Display</h2>
  <odd-alert label="A new version is available">Refresh when you are ready.</odd-alert>
  <odd-alert tone="info" label="Maintenance tonight">Expect a short outage.</odd-alert>
  <odd-alert tone="success" label="Changes saved">Your workspace is up to date.</odd-alert>
  <odd-alert tone="warning" label="You are offline">Changes will sync later.</odd-alert>
  <odd-alert tone="danger" label="Not saved" announce>Retry.<odd-button slot="end" size="sm">Try again</odd-button></odd-alert>
  <p>
    <odd-avatar label="Amelia Morgan"></odd-avatar>
    <odd-avatar label="Sam King" size="sm"></odd-avatar>
    <odd-avatar label="3 more members" size="lg">+3</odd-avatar>
    <odd-avatar>AM</odd-avatar> Amelia Morgan
  </p>
  <p>
    <odd-chip removable>Design systems</odd-chip>
    <odd-chip removable selected>Research</odd-chip>
    <odd-chip id="inactive-chip" removable disabled>Archived</odd-chip>
    <odd-chip>Plain</odd-chip>
  </p>
  <p>
    <odd-icon label="Settings">${icon}</odd-icon>
    <odd-icon>${icon}</odd-icon> Settings
  </p>
  <odd-progress label="Uploading files" value="8" max="12" description="8 of 12 files"></odd-progress>
  <odd-progress label="Preparing upload" description="Please wait…"></odd-progress>
  <odd-progress value="0.5"></odd-progress>
  <div aria-busy="true"><odd-skeleton lines="3"></odd-skeleton><odd-skeleton shape="circle"></odd-skeleton></div>
  <odd-spinner>Loading workspace…</odd-spinner>
  <odd-spinner size="sm"></odd-spinner>
  <odd-empty-state label="No matching projects">Try a different search.<odd-button slot="footer">Clear filters</odd-button></odd-empty-state>
  <h2>Disclosure and navigation</h2>
  <odd-disclosure label="Advanced settings">Additional options.</odd-disclosure>
  <odd-disclosure label="Shipping" open>Ships in two days. <a href="#returns">Returns</a></odd-disclosure>
  <odd-disclosure label="Archived settings" disabled>Not available.</odd-disclosure>
  <div><odd-disclosure name="faq" label="How do themes work?" open>Semantic tokens adapt each control.</odd-disclosure><odd-disclosure name="faq" label="Which browsers are supported?">Current engines.</odd-disclosure></div>
  <odd-tabs label="Project"><odd-tab-panel label="Overview">Overview text.</odd-tab-panel><odd-tab-panel label="Activity">Activity text.</odd-tab-panel><odd-tab-panel label="Settings" disabled>Settings.</odd-tab-panel></odd-tabs>
  <odd-tabs label="Sections" orientation="vertical" activation="manual"><odd-tab-panel label="One">One.</odd-tab-panel><odd-tab-panel label="Two">Two.</odd-tab-panel></odd-tabs>
  <odd-toolbar label="Project actions"><input aria-label="Search projects" type="search" /><hr aria-orientation="vertical" /><odd-button size="sm" appearance="ghost">Filter</odd-button><span>3 selected</span><odd-button size="sm" appearance="primary">New item</odd-button></odd-toolbar>
  <odd-pagination label="Search results" current="3" page-count="12"></odd-pagination>
  <odd-pagination label="Articles" current="1" page-count="4" href="#page-{page}"></odd-pagination>
  <odd-breadcrumbs><ol><li><a href="#home">Home</a></li><li><a href="#workspace">Workspace</a></li><li><a href="#forms">Forms</a></li></ol></odd-breadcrumbs>
  <odd-popover label="Share workspace" open><p>Invite people to collaborate.</p><a href="#docs">Sharing settings</a></odd-popover>
  <odd-button id="a11y-archive">Archive</odd-button><odd-tooltip anchor="a11y-archive">You can restore it from settings.</odd-tooltip>
  <a id="a11y-copy" href="#copy">Copy link</a><odd-tooltip anchor="a11y-copy" open>Copy a link to this workspace</odd-tooltip>
  <odd-toast label="Invitation was not sent" tone="danger" duration="0" open>Your draft has been kept.</odd-toast>
  <odd-toast label="Invitation sent" tone="success" open>Alex can now join the workspace.<odd-button slot="end" appearance="ghost" size="sm">Undo</odd-button></odd-toast>
  <form id="summary-form"><odd-validation-summary></odd-validation-summary><odd-input label="Project name" name="project" required></odd-input><p><label>Owner email <input name="owner" type="email" value="ada@" required /></label></p><odd-button type="submit">Save</odd-button></form>
  <odd-breadcrumbs label="Collapsed location" max-items="2"><svg slot="home" aria-hidden="true" viewBox="0 0 24 24" width="20" height="20"><path d="M3 11l9-8 9 8" /></svg><ol><li><a href="#home">Home</a></li><li><a href="#workspace">Workspace</a></li><li><a href="#forms">Forms</a></li></ol></odd-breadcrumbs>
  <h2>Collections</h2>
  <odd-tree label="Project files" value="text-field" data-items></odd-tree>
  <odd-tree label="Shared files" multiple data-items></odd-tree>
  <odd-tree label="Recent files" loading></odd-tree>
  <odd-tree label="Archived files"></odd-tree>
  <odd-listbox label="Workspace role" name="role" description="Who can change things"><option value="viewer">Viewer</option><option value="editor" selected>Editor</option><option value="owner" disabled>Owner</option></odd-listbox>
  <odd-listbox label="Notify me about" name="topics" multiple required error="Choose at least one topic"><optgroup label="Activity"><option value="mentions" title="When someone mentions you">Mentions</option><option value="comments">Comments</option></optgroup><option value="digest">Weekly digest</option></odd-listbox>
  <odd-listbox label="Region" loading></odd-listbox>
  <odd-listbox label="Archive" disabled><option value="a">2025</option></odd-listbox>
  <odd-combobox label="Project" name="project" description="Search by project name" placeholder="Choose a project…"><option value="atlas">Atlas</option><option value="beacon" selected title="Archived">Beacon</option><option value="delta" disabled>Delta</option></odd-combobox>
  <odd-combobox label="Topics" name="topics" multiple required error="Choose at least one topic"><option value="design" selected>Design</option><option value="research" selected>Research</option><option value="sales">Sales</option></odd-combobox>
  <odd-combobox label="Person" no-filter loading></odd-combobox>
  <odd-combobox label="Archive" disabled><option value="a" selected>2025</option></odd-combobox>
  <odd-select label="Workspace role" name="role" description="Who can change things"><option value="viewer">Viewer</option><option value="editor" selected>Editor</option><option value="owner" disabled>Owner</option></odd-select>
  <odd-select label="Region" placeholder="Choose a region…" required error="Choose a region to continue"><optgroup label="Europe"><option value="fra" title="Germany">Frankfurt</option></optgroup><option value="any">Any region</option></odd-select>
  <odd-select label="Archive" disabled><option value="a">2025</option></odd-select>
  <odd-menu>Project actions<option value="new">New project</option><option value="archive" disabled>Archive</option><hr><optgroup label="Danger zone"><option value="delete">Delete project</option></optgroup></odd-menu>
  <odd-menu label="More actions" appearance="ghost"><option value="rename">Rename</option></odd-menu>
  <odd-split-button value="save" appearance="primary">Save<option value="copy">Save a copy</option></odd-split-button>
  <h2>Layout</h2>
  <odd-split-panel label="Resize project files" position="30"><section slot="start"><h3>Project files</h3><a href="#overview">Overview</a></section><section slot="end"><h3>Design system</h3><p>Ready to review.</p></section></odd-split-panel>
  <odd-scroll-region label="Release notes" style="max-block-size: 6rem"><p>Release note 1</p><p>Release note 2</p><p>Release note 3</p><p>Release note 4</p><p>Release note 5</p><p>Release note 6</p><p>Release note 7</p><p>Release note 8</p></odd-scroll-region>
  <odd-container><h3>Release notes</h3><p>Components and tokens were updated.</p></odd-container>
  <odd-status-marker status="complete"></odd-status-marker><odd-status-marker status="failed"></odd-status-marker><odd-status-marker status="pending"></odd-status-marker><odd-status-marker>2</odd-status-marker>
  <odd-relative-time datetime="2026-10-24T09:30:00-07:00" detail></odd-relative-time><odd-relative-time></odd-relative-time>
`;

let tokens: HTMLLinkElement;
let script: HTMLScriptElement;
beforeAll(async () => {
  await import('./register.js');
  tokens = document.createElement('link');
  tokens.rel = 'stylesheet';
  tokens.href = new URL('../../tokens/dist/css/default.css', import.meta.url).href;
  const loaded = new Promise((resolve, reject) => {
    tokens.onload = resolve;
    tokens.onerror = reject;
  });
  document.head.append(tokens);
  await loaded;
  script = document.createElement('script');
  script.textContent = axeSource;
  document.head.append(script);
  expect(typeof axe().run).toBe('function');
});
afterAll(() => {
  tokens.remove();
  script.remove();
});

async function audit(mode: 'light' | 'dark') {
  const container = document.createElement('div');
  container.dataset['oddMode'] = mode;
  // Transitions are not under test: colours must be final when axe reads them.
  container.style.setProperty('--odd-motion-duration-fast', '0s');
  // The page background and text behind the components, as base.css would set them.
  container.style.backgroundColor = 'var(--odd-color-canvas)';
  container.style.color = 'var(--odd-color-text-primary)';
  container.innerHTML = states;
  // Rich data is a property: trees marked data-items get theirs here.
  for (const tree of container.querySelectorAll<HTMLElement & { items?: unknown }>(
    'odd-tree[data-items]',
  ))
    tree.items = [
      {
        id: 'components',
        label: 'Components',
        children: [
          { id: 'text-field', label: 'Text field' },
          { id: 'combobox', label: 'Combobox', disabled: true },
        ],
      },
      { id: 'foundations', label: 'Foundations', lazy: true },
    ];
  document.body.append(container);
  try {
    for (const el of [
      ...container.querySelectorAll<HTMLElement & { updateComplete: Promise<void> }>('*'),
    ].filter((el) => el.localName.startsWith('odd-')))
      await el.updateComplete;
    flush();
    // A blocked submission: the required, empty field shows aria-invalid.
    const blocked = container.querySelector<HTMLElement & { updateComplete: Promise<void> }>(
      '#blocked',
    )!;
    blocked.addEventListener('invalid', (event) => event.preventDefault());
    container.querySelector<HTMLFormElement>('#form')!.requestSubmit();
    await blocked.updateComplete;
    flush();
    expect(blocked.shadowRoot!.querySelector('input')!.getAttribute('aria-invalid')).toBe('true');
    // A submission the user starts and validation blocks: the summary lists the problems.
    const summaryForm = container.querySelector<HTMLFormElement>('#summary-form')!;
    summaryForm.addEventListener('submit', (event) => event.preventDefault());
    summaryForm.querySelector<HTMLElement>('odd-button')!.click();
    // odd-button submits in a task after the click.
    await new Promise((resolve) => setTimeout(resolve));
    const validationSummary = summaryForm.querySelector<
      HTMLElement & { updateComplete: Promise<void> }
    >('odd-validation-summary')!;
    await validationSummary.updateComplete;
    flush();
    expect(validationSummary.shadowRoot!.querySelectorAll('[part~="link"]')).toHaveLength(2);
    // A disabled chip's text takes the disabled colour, as Figma draws it: WCAG 1.4.3 exempts
    // inactive components, but axe cannot tell that a chip is one. The same chip enabled is audited.
    const context = { include: [container], exclude: [['#inactive-chip']] };
    const result = await axe().run(context, { runOnly: { type: 'tag', values: TAGS } });
    const summary = (results: AxeResult[]) =>
      results.map((r) => `${r.id}: ${r.nodes.map((n) => JSON.stringify(n.target)).join(' ')}`);
    console.log(
      `${mode}: ${result.passes.length} rules passed; incomplete: ${JSON.stringify(summary(result.incomplete))}`,
    );
    return { violations: summary(result.violations), passes: result.passes.map((r) => r.id) };
  } finally {
    container.remove();
  }
}

describe('axe-core, WCAG 2.2 A and AA', () => {
  it.each(['light', 'dark'] as const)('%s mode: no violations in any state', async (mode) => {
    const { violations, passes } = await audit(mode);
    expect(violations).toEqual([]);
    // The rules that matter here ran and found nodes to pass.
    expect(passes).toEqual(
      expect.arrayContaining(['button-name', 'label', 'color-contrast', 'aria-allowed-attr']),
    );
  });

  // A modal dialog, drawer, or command palette makes the rest of the page inert, so each is
  // audited on its own.
  it.each(['light', 'dark'] as const)('%s mode: no violations in an open dialog', async (mode) => {
    for (const markup of [
      `<odd-dialog label="Rename workspace" open><form id="rename" method="dialog"><p>Choose a clear name your team will recognise.</p><odd-input label="Workspace name" value="Design systems"></odd-input></form><odd-button slot="footer" type="submit" form="rename" value="cancel">Cancel</odd-button><odd-button slot="footer" type="submit" form="rename" value="save" appearance="primary">Save</odd-button></odd-dialog>`,
      `<odd-dialog label="Delete workspace?" alert no-close open><p>This permanently deletes Field notes and its shared content.</p><form method="dialog" slot="footer"><odd-button type="submit" value="cancel" autofocus>Cancel</odd-button><odd-button type="submit" value="delete" appearance="primary">Delete</odd-button></form></odd-dialog>`,
      `<odd-drawer label="Member details" open><odd-select label="Role" description="Can create and edit projects."><option value="viewer">Viewer</option><option value="editor" selected>Workspace editor</option></odd-select><odd-button slot="footer">Cancel</odd-button><odd-button slot="footer" appearance="primary">Save</odd-button></odd-drawer>`,
      `<odd-command-palette label="Command palette" placeholder="Search commands…" open><odd-button slot="status" appearance="ghost" size="sm">Search all projects</odd-button></odd-command-palette>`,
    ]) {
      const container = document.createElement('div');
      container.dataset['oddMode'] = mode;
      container.style.setProperty('--odd-motion-duration-fast', '0s');
      container.innerHTML = markup;
      // Commands are data (a property).
      for (const palette of container.querySelectorAll('odd-command-palette'))
        palette.items = [
          { id: 'new', label: 'New project', shortcut: 'Ctrl N', group: 'Commands' },
          { id: 'atlas', label: 'Atlas', description: 'Project', group: 'Projects' },
          { id: 'beacon', label: 'Beacon', group: 'Projects', disabled: true },
        ];
      document.body.append(container);
      try {
        for (const el of [
          ...container.querySelectorAll<HTMLElement & { updateComplete: Promise<void> }>('*'),
        ].filter((el) => el.localName.startsWith('odd-')))
          await el.updateComplete;
        flush();
        const dialog = container
          .querySelector('odd-dialog, odd-drawer, odd-command-palette')!
          .shadowRoot!.querySelector('dialog')!;
        expect(dialog.matches(':modal')).toBe(true);
        const { violations, passes } = await axe().run(container, {
          runOnly: { type: 'tag', values: TAGS },
        });
        expect(
          violations.map((v) => `${v.id}: ${JSON.stringify(v.nodes.map((n) => n.target))}`),
        ).toEqual([]);
        expect(passes.map((r) => r.id)).toEqual(
          expect.arrayContaining(['button-name', 'color-contrast', 'aria-allowed-attr']),
        );
      } finally {
        container.remove();
      }
    }
  });

  it('finds misuse inside shadow roots, so a clean result is not vacuous', async () => {
    const container = document.createElement('div');
    container.style.setProperty('--odd-motion-duration-fast', '0s');
    container.innerHTML = `
      <odd-input></odd-input>
      <odd-button>${icon}</odd-button>
      <odd-button style="--odd-button-color: #f2f2f2">Faint</odd-button>`;
    document.body.append(container);
    try {
      for (const el of container.querySelectorAll<HTMLElement & { updateComplete: Promise<void> }>(
        'odd-button, odd-input',
      ))
        await el.updateComplete;
      flush();
      const { violations } = await axe().run(container, {
        runOnly: { type: 'tag', values: TAGS },
      });
      // axe names a node in a shadow root by its host selector, then its inner selector.
      const found = Object.fromEntries(violations.map((v) => [v.id, v.nodes.map((n) => n.target)]));
      expect(found).toEqual({
        label: [[['odd-input', '#control']]],
        'button-name': [[['odd-button:nth-child(2)', 'button']]],
        'color-contrast': [[['odd-button:nth-child(3)', '.label']]],
      });
    } finally {
      container.remove();
    }
  });
});
