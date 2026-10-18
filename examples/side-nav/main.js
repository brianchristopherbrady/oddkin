// Plain JavaScript, no build: register odd-side-nav and give the instances their entries.
import '@oddkin/components/define/side-nav';

const navigation = [
  { id: 'overview', kind: 'link', label: 'Overview', href: '#overview' },
  { id: 'components', kind: 'link', label: 'Components', href: '#components', badge: '4' },
  {
    id: 'guides',
    kind: 'group',
    label: 'Guides',
    items: [
      { id: 'theming', kind: 'link', label: 'Theming', href: '#theming' },
      { id: 'layout', kind: 'link', label: 'Layout recipes', href: '#layout' },
    ],
  },
  { id: 'tokens', kind: 'link', label: 'Tokens', href: '#tokens' },
  { id: 'new-project', kind: 'action', label: 'New project', action: 'project.create' },
];
// The handwritten twin shows the first-level links only.
const twin = [
  { id: 'overview', kind: 'link', label: 'Overview', href: '#overview' },
  { id: 'components', kind: 'link', label: 'Components', href: '#components' },
  { id: 'tokens', kind: 'link', label: 'Tokens', href: '#tokens' },
  { id: 'layout', kind: 'link', label: 'Layout', href: '#layout' },
];

for (const id of ['nav-narrow', 'nav-wide', 'nav-hybrid', 'nav-default', 'nav-compact', 'nav-dark'])
  document.getElementById(id).items = navigation;
document.getElementById('nav-recipe').items = twin;

const log = document.getElementById('log');
document.addEventListener('odd-action', (event) => {
  log.textContent = `Action ${event.detail.action} from ${event.detail.id}`;
});
document.addEventListener('odd-toggle', (event) => {
  log.textContent = `${event.detail.id} ${event.detail.expanded ? 'expanded' : 'collapsed'}`;
});

// Width of the comparison frames, through the CSSOM (allowed under the strict style-src).
const width = document.getElementById('width');
const output = document.getElementById('width-value');
const applyWidth = () => {
  for (const id of ['frame-recipe', 'frame-hand'])
    document.getElementById(id).style.inlineSize = `${width.value}rem`;
  output.textContent = `${width.value}rem`;
};
width.addEventListener('input', applyWidth);
applyWidth();

document.body.dataset.ready = 'true';
