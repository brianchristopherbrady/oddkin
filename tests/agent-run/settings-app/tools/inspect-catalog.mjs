// Prints the composition catalog entries for the elements this app uses.
import { CATALOG, NATIVE } from '@oddkin/components/composition';

const tags = process.argv.slice(2);
const show = (value) =>
  JSON.stringify(value, (key, v) => (typeof v === 'function' ? `[function ${v.name}]` : v), 2);

for (const tag of tags.length ? tags : ['odd-card', 'odd-input', 'odd-switch', 'odd-select', 'odd-button', 'odd-alert']) {
  console.log(`== ${tag}`);
  console.log(show(CATALOG[tag] ?? NATIVE[tag]));
}
console.log('== natives', Object.keys(NATIVE).join(', '));
