// The walkthrough scenario: ordinary consumer code that drives the elements of one authoring
// language ("js" or "ts") and records, per step, how many times render() ran and how many DOM
// mutations were made in the element's shadow root.

/** Run `action`, wait for the update boundary, and count render() runs and DOM writes. */
async function measure(el, action) {
  const records = [];
  const observer = new MutationObserver((list) => records.push(...list));
  observer.observe(el.shadowRoot, {
    subtree: true,
    characterData: true,
    childList: true,
    attributes: true,
  });
  const before = el.renders;
  const result = await action();
  await el.updateComplete;
  records.push(...observer.takeRecords());
  observer.disconnect();
  // A function result is read after the update boundary.
  const shown = typeof result === 'function' ? result() : result;
  return { renders: el.renders - before, writes: records.length, result: String(shown) };
}

const text = (el) => el.shadowRoot.textContent.replace(/\s+/g, ' ').trim();

export async function runWalkthrough(lang, host) {
  const make = (name) => {
    const el = document.createElement(`walk-${name}-${lang}`);
    host.append(el);
    return el;
  };
  const direct = make('direct');
  const tracked = make('tracked');
  const dual = make('dual');
  const snapshot = make('snapshot');
  const prop = make('prop');
  await Promise.all([direct, tracked, dual, snapshot, prop].map((el) => el.updateComplete));

  const rows = [];
  const step = async (rule, el, action) => rows.push({ rule, ...(await measure(el, action)) });

  await step('Direct binding: three writes in one task', direct, () => {
    direct.count.value = 1;
    direct.count.value = 2;
    direct.count.value = 3;
    return () => text(direct);
  });
  await step('Render-tracked .value: three writes in one task', tracked, () => {
    tracked.count.value = 1;
    tracked.count.value = 2;
    tracked.count.value = 3;
    return () => text(tracked);
  });
  await step('Both paths reach one value (coalesced)', dual, async () => {
    dual.count.value = 1;
    await dual.updateComplete;
    return text(dual);
  });
  await step('Event handler reads .value (snapshot)', snapshot, () => {
    snapshot.shadowRoot.querySelector('button').click();
    return `read ${snapshot.seen.join(',')}`;
  });
  await step('Later write after a handler read', snapshot, async () => {
    snapshot.count.value = 5;
    return `async callback read ${await snapshot.later}`;
  });
  await step('No-op write (same value)', tracked, () => {
    tracked.count.value = 3;
    return () => text(tracked);
  });
  await step('Public property set by DOM code', prop, async () => {
    prop.label = 'Ada';
    await prop.updateComplete;
    return `${text(prop)}; updated(${prop.changes.at(-1).join(',')})`;
  });
  await step('Same public value again', prop, () => {
    const calls = prop.changes.length;
    prop.label = 'Ada';
    return `${text(prop)}; updated calls +${prop.changes.length - calls}`;
  });
  await step('Attribute set by markup or DOM code', prop, async () => {
    prop.setAttribute('label', 'Grace');
    await prop.updateComplete;
    return text(prop);
  });
  await step('Update boundary (updateComplete)', tracked, async () => {
    tracked.count.value = 4;
    const sync = text(tracked);
    await tracked.updateComplete;
    return `before await ${sync}, after ${text(tracked)}`;
  });
  return rows;
}
