import './plain/components.js';
import './dist/components.js';
import { runWalkthrough } from './scenario.js';

function table(caption, rows) {
  const t = document.createElement('table');
  t.createCaption().textContent = caption;
  const head = t.createTHead().insertRow();
  for (const label of ['Step', 'render() runs', 'DOM writes', 'Result']) {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = label;
    head.append(th);
  }
  const body = t.createTBody();
  for (const row of rows) {
    const tr = body.insertRow();
    const th = document.createElement('th');
    th.scope = 'row';
    th.textContent = row.rule;
    tr.append(th);
    for (const value of [row.renders, row.writes, row.result]) tr.insertCell().textContent = value;
  }
  return t;
}

const results = {};
for (const [lang, caption] of [
  ['js', 'Plain JavaScript elements'],
  ['ts', 'TypeScript elements'],
]) {
  const stage = document.getElementById(`stage-${lang}`);
  results[lang] = await runWalkthrough(lang, stage);
  document.getElementById(`results-${lang}`).append(table(caption, results[lang]));
}
globalThis.walkthrough = results;
document.body.dataset.ready = 'true';
