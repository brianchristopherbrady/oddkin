// Original Oddkin outline artwork and composition primitives. MIT.
// Reference inventories supply concepts, names and search metadata, never path artwork.
import { catalog } from './catalog.mjs';
export const line = (...v) =>
  `M ${v[0]} ${v[1]} ${v
    .slice(2)
    .map((x, i) => (i % 2 ? ' ' : ' L ') + x)
    .join('')}`;
export const polygon = (...v) => line(...v) + ' Z';
export const circle = (x, y, r) =>
  `M ${x - r} ${y} a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0`;
export const rect = (x, y, w, h, r = 1) =>
  `M ${x + r} ${y} H ${x + w - r} Q ${x + w} ${y} ${x + w} ${y + r} V ${y + h - r} Q ${x + w} ${y + h} ${x + w - r} ${y + h} H ${x + r} Q ${x} ${y + h} ${x} ${y + h - r} V ${y + r} Q ${x} ${y} ${x + r} ${y} Z`;
export const path = (d, attrs = '') => `<path d="${d}" ${attrs}/>`;
export const normalized = (s) =>
  s
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/_/g, '-')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
export const glyphs = new Map();
export function register(name, body, category = 'Interface') {
  const g = { key: name, body, category };
  glyphs.set(name, g);
  return g;
}
export function aliases(base, ...names) {
  const g = glyphs.get(base);
  if (!g) throw Error('Unknown base ' + base);
  for (const name of names) glyphs.set(name, g);
}
for (const icon of catalog) register(normalized(icon.name), path(icon.path), icon.category);
const add = (name, ...ds) => register(name, ds.map((d) => path(d)).join(''));
export const alphabet = {
  A: 'M 0 8 L 2.5 0 L 5 8 M 1 5 H 4',
  B: 'M 0 0 V 8 H 3 Q 6 8 5 5 Q 4 4 1 4 M 0 0 H 3 Q 6 0 5 3 Q 4 4 1 4',
  C: 'M 5 1 C -1 -3 -1 11 5 7',
  D: 'M 0 0 V 8 H 2 C 7 8 7 0 2 0 Z',
  E: 'M 5 0 H 0 V 8 H 5 M 0 4 H 4',
  F: 'M 5 0 H 0 V 8 M 0 4 H 4',
  G: 'M 5 1 C -1 -3 -1 11 5 7 V 4 H 3',
  H: 'M 0 0 V 8 M 5 0 V 8 M 0 4 H 5',
  I: 'M 0 0 H 5 M 2.5 0 V 8 M 0 8 H 5',
  J: 'M 0 0 H 5 V 6 Q 5 10 0 7',
  K: 'M 0 0 V 8 M 5 0 L 0 4 L 5 8',
  L: 'M 0 0 V 8 H 5',
  M: 'M 0 8 V 0 L 2.5 4 L 5 0 V 8',
  N: 'M 0 8 V 0 L 5 8 V 0',
  O: 'M 2.5 0 C -1 0 -1 8 2.5 8 C 6 8 6 0 2.5 0 Z',
  P: 'M 0 8 V 0 H 3 C 7 0 7 4 3 4 H 0',
  Q: 'M 2.5 0 C -1 0 -1 8 2.5 8 C 6 8 6 0 2.5 0 Z M 3 5 L 6 8',
  R: 'M 0 8 V 0 H 3 C 7 0 7 4 3 4 H 0 M 3 4 L 5 8',
  S: 'M 5 1 C -1 -2 -1 4 2.5 4 C 7 4 7 10 0 7',
  T: 'M 0 0 H 5 M 2.5 0 V 8',
  U: 'M 0 0 V 6 C 0 9 5 9 5 6 V 0',
  V: 'M 0 0 L 2.5 8 L 5 0',
  W: 'M 0 0 L 1 8 L 2.5 4 L 4 8 L 5 0',
  X: 'M 0 0 L 5 8 M 5 0 L 0 8',
  Y: 'M 0 0 L 2.5 4 L 5 0 M 2.5 4 V 8',
  Z: 'M 0 0 H 5 L 0 8 H 5',
  0: 'M 2.5 0 C -1 0 -1 8 2.5 8 C 6 8 6 0 2.5 0 Z M 1 6 L 4 2',
  1: 'M 1 2 L 3 0 V 8 M 1 8 H 5',
  2: 'M 0 1 C 2 -2 7 1 4 4 L 0 8 H 5',
  3: 'M 0 0 H 5 L 2 4 C 7 2 7 10 0 7',
  4: 'M 4 8 V 0 L 0 5 H 5',
  5: 'M 5 0 H 0 V 4 C 7 1 7 10 0 7',
  6: 'M 5 0 C -1 -1 -2 10 3 8 C 8 6 3 1 0 5',
  7: 'M 0 0 H 5 L 1 8',
  8: 'M 2.5 4 C -2 4 0 -2 4 0 C 8 3 3 5 2.5 4 C -2 3 -1 10 4 8 C 8 6 5 3 2.5 4',
  9: 'M 0 8 C 6 9 7 -2 2 0 C -3 2 2 7 5 3',
  '?': 'M 0 1 C 2 -2 7 1 4 3 L 2.5 4 V 5 M 2.5 7.5 V 8',
  '!': 'M 2.5 0 V 5 M 2.5 7.5 V 8',
  '+': 'M 0 4 H 5 M 2.5 1.5 V 6.5',
  '-': 'M 0 4 H 5',
  '/': 'M 0 8 L 5 0',
  '.': 'M 2.5 7.5 V 8',
  '%': 'M 0 8 L 5 0 M 1 0 A 1 1 0 1 0 1 2 A 1 1 0 1 0 1 0 M 4 6 A 1 1 0 1 0 4 8 A 1 1 0 1 0 4 6',
};
export function lettering(s, x = 3, y = 5, size = 10) {
  s = s.toUpperCase();
  const scale = Math.min(size / 8, 14 / (s.length * 7 - 2));
  const w = (s.length * 7 - 2) * scale;
  return `<g transform="translate(${x + (14 - w) / 2} ${y}) scale(${scale})" stroke-width="${1.15 / scale}">${[...s].map((c, i) => `<path transform="translate(${i * 7} 0)" d="${alphabet[c] || alphabet['?']}"/>`).join('')}</g>`;
}
export function textGlyph(s) {
  return { key: 'text-' + normalized(s), body: lettering(s, 3, 5, 10), category: 'Typography' };
}
export function transform(body, x = 0, y = 0, scale = 1, rotation = 0) {
  return `<g transform="translate(${x} ${y}) scale(${scale}) rotate(${rotation} 10 10)" stroke-width="${1.5 / scale}">${body}</g>`;
}
export function grid(cols = 3, rows = 3) {
  let d = rect(2, 2, 16, 16);
  for (let i = 1; i < cols; i++) d += line(2 + (16 * i) / cols, 2, 2 + (16 * i) / cols, 18);
  for (let i = 1; i < rows; i++) d += line(2, 2 + (16 * i) / rows, 18, 2 + (16 * i) / rows);
  return path(d);
}
export function arrow(direction = 'right', kind = 'arrow') {
  let body =
    kind === 'chevron'
      ? path(line(7, 4, 13, 10, 7, 16))
      : kind === 'caret'
        ? path(polygon(7, 4, 14, 10, 7, 16))
        : path(line(2, 10, 18, 10) + line(12, 4, 18, 10, 12, 16));
  const angles = {
    right: 0,
    down: 90,
    left: 180,
    up: 270,
    'up-right': 315,
    'up-left': 225,
    'down-left': 135,
    'down-right': 45,
  };
  return `<g transform="rotate(${angles[direction] ?? 0} 10 10)">${body}</g>`;
}
export const signs = {
  plus: path(line(13, 16, 19, 16) + line(16, 13, 16, 19)),
  minus: path(line(13, 16, 19, 16)),
  x: path(line(13.5, 13.5, 18.5, 18.5) + line(18.5, 13.5, 13.5, 18.5)),
  check: path(line(13, 16, 15.2, 18, 19, 13.5)),
  lock: path(rect(13, 15, 6, 4, 0.6) + 'M 14 15 V 13 A 2 2 0 0 1 18 13 V 15'),
  search: path(circle(15, 15, 2.5) + line(17, 17, 19, 19)),
  gear: path(
    circle(16, 16, 2.5) +
      line(16, 12, 16, 13) +
      line(16, 19, 16, 20) +
      line(12, 16, 13, 16) +
      line(19, 16, 20, 16),
  ),
  clock: path(circle(16, 16, 3) + line(16, 14, 16, 16, 18, 16)),
  warning: path(polygon(16, 12, 20, 19, 12, 19) + line(16, 15, 16, 16.5) + line(16, 18, 16, 18.1)),
  down: transform(arrow('down'), 12, 12, 0.35),
  up: transform(arrow('up'), 12, 12, 0.35),
  edit: path(polygon(12, 17, 17, 12, 19, 14, 14, 19, 12, 19)),
  person: path(circle(16, 14, 1.8) + 'M 12.5 19 C 12.5 15 19.5 15 19.5 19'),
  play: path(polygon(13, 12, 19, 16, 13, 20)),
  filter: path(polygon(12, 13, 20, 13, 17, 16, 17, 19, 15, 19, 15, 16)),
  star: path(
    polygon(
      16,
      12,
      17,
      14.5,
      20,
      15,
      18,
      17,
      18.5,
      20,
      16,
      18.5,
      13.5,
      20,
      14,
      17,
      12,
      15,
      15,
      14.5,
    ),
  ),
};
export function badge(g, sign) {
  return {
    key: g.key + '-' + sign,
    body: transform(g.body, 1, 1, 0.6) + (signs[sign] || lettering(sign.slice(0, 1), 12, 12, 6)),
    category: g.category,
  };
}
export function slash(g) {
  return { key: g.key + '-off', body: g.body + path(line(2, 18, 18, 2)), category: g.category };
}
export function enclosure(g, shape = 'circle') {
  return {
    key: g.key + '-' + shape,
    body:
      (shape === 'circle'
        ? path(circle(10, 10, 8.5))
        : path(rect(1.5, 1.5, 17, 17, shape === 'rounded' ? 3 : 1))) + transform(g.body, 4, 4, 0.6),
    category: g.category,
  };
}
export function repeated(g) {
  return {
    key: g.key + '-multiple',
    body: transform(g.body, 7, 1, 0.55) + transform(g.body, 1, 7, 0.55),
    category: g.category,
  };
}

add('check', line(3, 10, 8, 15, 17, 5));
add('close', line(4, 4, 16, 16), line(16, 4, 4, 16));
add('plus', line(3, 10, 17, 10), line(10, 3, 10, 17));
add('minus', line(3, 10, 17, 10));
add('folder', polygon(2, 5, 7, 5, 9, 7, 18, 7, 18, 17, 2, 17));
add('file', polygon(4, 2, 12, 2, 17, 7, 17, 18, 4, 18), line(12, 2, 12, 7, 17, 7));
add(
  'home',
  line(2, 9, 10, 2, 18, 9),
  line(4, 8, 4, 18, 8, 18, 8, 12, 12, 12, 12, 18, 16, 18, 16, 8),
);
add('search', circle(8, 8, 5), line(12, 12, 18, 18));
add('more', circle(4, 10, 0.6), circle(10, 10, 0.6), circle(16, 10, 0.6));
add('copy', rect(6, 6, 12, 12), line(3, 14, 2, 14, 2, 2, 14, 2, 14, 3));
add('download', line(10, 2, 10, 13), line(5, 8, 10, 13, 15, 8), line(2, 14, 2, 18, 18, 18, 18, 14));
add('upload', line(10, 13, 10, 2), line(5, 7, 10, 2, 15, 7), line(2, 14, 2, 18, 18, 18, 18, 14));
add(
  'trash',
  line(2, 5, 18, 5),
  line(7, 5, 7, 2, 13, 2, 13, 5),
  line(4, 5, 5, 18, 15, 18, 16, 5),
  line(8, 8, 8, 15),
  line(12, 8, 12, 15),
);
add('mail', rect(2, 4, 16, 12), line(2, 5, 10, 11, 18, 5));
add('clock', circle(10, 10, 8), line(10, 5, 10, 10, 14, 12));
add(
  'calendar',
  rect(2, 4, 16, 14),
  line(2, 8, 18, 8),
  line(6, 2, 6, 6),
  line(14, 2, 14, 6),
  line(6, 12, 8, 12),
  line(12, 12, 14, 12),
);
add('person', circle(10, 5, 3), 'M 3 18 V 15 C 3 8 17 8 17 15 V 18');
add(
  'people',
  circle(7, 5, 2.5),
  circle(15, 6, 2),
  'M 2 18 V 14 C 2 9 12 9 12 14 V 18 M 14 11 C 18 11 19 13 18 18',
);
add('lock', rect(3, 8, 14, 10, 2), 'M 6 8 V 5 A 4 4 0 0 1 14 5 V 8', line(10, 12, 10, 14));
add('unlock', rect(3, 8, 14, 10, 2), 'M 6 8 V 5 C 6 0 14 0 14 5', line(10, 12, 10, 14));
add('information', circle(10, 10, 8), line(10, 9, 10, 15), line(10, 5, 10, 5.1));
add('warning', polygon(10, 2, 19, 18, 1, 18), line(10, 7, 10, 12), line(10, 15, 10, 15.1));
add(
  'gear',
  circle(10, 10, 5),
  circle(10, 10, 1.8),
  line(10, 1.5, 10, 5),
  line(10, 15, 10, 18.5),
  line(1.5, 10, 5, 10),
  line(15, 10, 18.5, 10),
  line(4, 4, 6, 6),
  line(14, 14, 16, 16),
  line(4, 16, 6, 14),
  line(14, 6, 16, 4),
);
add('filter', polygon(2, 3, 18, 3, 12, 10, 12, 17, 8, 15, 8, 10));
add(
  'link',
  'M 8 6 L 11 3 C 17 -2 22 7 16 10 L 13 12 M 7 8 L 4 10 C -2 15 5 22 10 17 L 12 14',
  line(7, 13, 13, 7),
);
add(
  'share',
  circle(15, 4, 2.5),
  circle(4, 10, 2.5),
  circle(15, 16, 2.5),
  line(6, 9, 13, 5),
  line(6, 11, 13, 15),
);
add(
  'external',
  line(11, 2, 18, 2, 18, 9),
  line(18, 2, 8, 12),
  line(8, 4, 3, 4, 3, 17, 16, 17, 16, 12),
);
add(
  'save',
  polygon(2, 2, 15, 2, 18, 5, 18, 18, 2, 18),
  rect(5, 2, 9, 6, 0.3),
  rect(5, 12, 10, 6, 0.3),
);
add(
  'refresh',
  'M 3 7 A 7 7 0 0 1 16 5 M 17 13 A 7 7 0 0 1 4 15',
  line(12, 5, 16, 5, 16, 1),
  line(8, 15, 4, 15, 4, 19),
);
add('undo', 'M 3 8 H 12 C 20 8 20 17 12 17', line(7, 3, 2, 8, 7, 13));
add('redo', 'M 17 8 H 8 C 0 8 0 17 8 17', line(13, 3, 18, 8, 13, 13));
add('bell', 'M 4 14 V 8 C 4 0 16 0 16 8 V 14 L 18 16 H 2 Z M 8 18 Q 10 20 12 18');
add('bookmark', polygon(4, 2, 16, 2, 16, 18, 10, 14, 4, 18));
add('image', rect(2, 2, 16, 16), circle(6, 6, 1.5), line(2, 15, 7, 10, 10, 13, 14, 7, 18, 12));
add('video', rect(2, 4, 11, 12), polygon(13, 8, 18, 5, 18, 15, 13, 12));
add('camera', rect(2, 6, 16, 11, 2), line(5, 6, 7, 3, 13, 3, 15, 6), circle(10, 11, 3));
add(
  'microphone',
  rect(7, 2, 6, 10, 3),
  'M 4 8 V 10 A 6 6 0 0 0 16 10 V 8',
  line(10, 16, 10, 19),
  line(6, 19, 14, 19),
);
add(
  'volume',
  polygon(2, 8, 6, 8, 11, 3, 11, 17, 6, 12, 2, 12),
  'M 14 6 Q 18 10 14 14 M 16 3 Q 22 10 16 17',
);
add('cloud', 'M 5 16 C -2 15 1 8 5 9 C 5 1 17 1 16 9 C 22 9 21 17 15 16 Z');
add(
  'sun',
  circle(10, 10, 4),
  line(10, 1.5, 10, 3),
  line(10, 17, 10, 18.5),
  line(1.5, 10, 3, 10),
  line(17, 10, 18.5, 10),
  line(4, 4, 5, 5),
  line(15, 15, 16, 16),
  line(4, 16, 5, 15),
  line(15, 5, 16, 4),
);
add('moon', 'M 14 2 A 8 8 0 1 0 18 14 A 8 8 0 0 1 14 2 Z');
add('lightning', polygon(11, 1.5, 3, 11, 9, 11, 8, 18.5, 17, 8, 11, 8));
add('leaf', 'M 3 16 C -1 4 8 1 18 2 C 19 12 13 20 3 16 Z', line(3, 17, 13, 7));
add(
  'flower',
  circle(10, 10, 2),
  'M 8 8 C 3 2 9 -1 10 5 C 12 -1 18 3 12 8 C 21 7 20 14 13 12 C 18 20 10 21 10 14 C 8 21 2 18 7 12 C -1 15 0 7 8 8 Z',
);
add('tree', polygon(10, 2, 4, 9, 7, 9, 2, 15, 18, 15, 13, 9, 16, 9), line(10, 15, 10, 19));
add(
  'plant',
  line(10, 5, 10, 18),
  'M 10 12 C 1 12 2 6 3 5 C 9 5 10 8 10 12 M 10 9 C 11 2 16 2 18 3 C 18 8 14 10 10 9',
);
add(
  'building',
  rect(4, 2, 12, 16, 0.5),
  rect(8, 13, 4, 5, 0.2),
  line(7, 5, 8, 5),
  line(12, 5, 13, 5),
  line(7, 9, 8, 9),
  line(12, 9, 13, 9),
  line(2, 18, 18, 18),
);
add(
  'factory',
  polygon(2, 18, 2, 9, 7, 6, 7, 9, 12, 6, 12, 10, 17, 10, 17, 18),
  line(14, 10, 14, 2, 17, 2, 17, 10),
  line(5, 14, 6, 14),
  line(10, 14, 11, 14),
);
add(
  'bank',
  polygon(2, 6, 10, 2, 18, 6),
  line(3, 9, 3, 16),
  line(7, 9, 7, 16),
  line(13, 9, 13, 16),
  line(17, 9, 17, 16),
  line(2, 18, 18, 18),
);
add(
  'shop',
  rect(3, 8, 14, 10, 0.5),
  polygon(2, 3, 18, 3, 19, 8, 1, 8),
  line(5, 3, 5, 8),
  line(10, 3, 10, 8),
  line(15, 3, 15, 8),
  rect(11, 12, 4, 6, 0.2),
);
add(
  'school',
  polygon(2, 18, 2, 8, 10, 3, 18, 8, 18, 18),
  rect(8, 13, 4, 5, 0.2),
  circle(10, 8, 1.5),
  line(10, 3, 10, 1.5, 15, 1.5, 15, 3),
);
add(
  'car',
  rect(2, 8, 16, 7, 2),
  polygon(4, 8, 6, 3, 14, 3, 16, 8),
  line(4, 15, 4, 18),
  line(16, 15, 16, 18),
  line(5, 11, 6, 11),
  line(14, 11, 15, 11),
);
add(
  'truck',
  rect(2, 4, 10, 11, 0.6),
  polygon(12, 8, 16, 8, 19, 12, 19, 15, 12, 15),
  circle(5, 16, 2),
  circle(15, 16, 2),
);
add(
  'bus',
  rect(3, 2, 14, 15, 2),
  line(3, 10, 17, 10),
  line(10, 3, 10, 10),
  circle(6, 14, 0.6),
  circle(14, 14, 0.6),
  line(5, 17, 5, 19),
  line(15, 17, 15, 19),
);
add(
  'train',
  rect(4, 2, 12, 14, 2),
  line(4, 9, 16, 9),
  line(10, 2, 10, 9),
  circle(7, 13, 0.5),
  circle(13, 13, 0.5),
  line(7, 16, 4, 19),
  line(13, 16, 16, 19),
);
add(
  'bicycle',
  circle(5, 13, 4),
  circle(15, 13, 4),
  polygon(5, 13, 9, 6, 13, 13),
  line(9, 6, 14, 6, 15, 13),
  line(7, 4, 11, 4),
  line(14, 6, 14, 3, 17, 3),
);
add(
  'motorcycle',
  circle(4, 14, 3),
  circle(16, 14, 3),
  line(4, 14, 8, 8, 12, 8, 16, 14),
  line(7, 10, 12, 14, 4, 14),
  line(12, 8, 12, 4, 15, 4),
);
add(
  'airplane',
  polygon(
    10,
    2,
    12,
    8,
    18,
    11,
    18,
    13,
    12,
    11,
    12,
    16,
    15,
    18,
    5,
    18,
    8,
    16,
    8,
    11,
    2,
    13,
    2,
    11,
    8,
    8,
  ),
);
add(
  'boat',
  polygon(2, 12, 18, 12, 15, 18, 5, 18),
  line(5, 12, 6, 7, 14, 7, 15, 12),
  line(10, 7, 10, 2, 14, 4, 10, 5),
);
add(
  'ship',
  polygon(2, 12, 10, 9, 18, 12, 15, 17, 5, 17),
  line(5, 11, 5, 5, 15, 5, 15, 11),
  line(8, 5, 8, 2, 12, 2, 12, 5),
  'M 2 19 Q 5 17 8 19 Q 11 17 14 19 Q 17 17 19 19',
);
add(
  'road',
  line(5, 2, 2, 18),
  line(15, 2, 18, 18),
  line(10, 2, 10, 5),
  line(10, 9, 10, 12),
  line(10, 16, 10, 18),
);
add(
  'bridge',
  line(2, 14, 18, 14),
  line(4, 3, 4, 18),
  line(16, 3, 16, 18),
  'M 4 5 Q 10 15 16 5',
  line(8, 9, 8, 14),
  line(12, 9, 12, 14),
);
add('parking', rect(2, 2, 16, 16, 2), 'M 7 15 V 5 H 11 C 16 5 16 10 11 10 H 7');
add('traffic-light', rect(6, 2, 8, 16, 2), circle(10, 5, 1), circle(10, 10, 1), circle(10, 15, 1));
add(
  'fence',
  line(2, 7, 18, 7),
  line(2, 13, 18, 13),
  polygon(4, 3, 6, 5, 6, 18, 2, 18, 2, 5),
  polygon(10, 3, 12, 5, 12, 18, 8, 18, 8, 5),
  polygon(16, 3, 18, 5, 18, 18, 14, 18, 14, 5),
);
add(
  'water',
  'M 2 5 Q 5 2 8 5 Q 11 8 14 5 Q 17 2 19 5 M 2 11 Q 5 8 8 11 Q 11 14 14 11 Q 17 8 19 11 M 2 17 Q 5 14 8 17 Q 11 20 14 17 Q 17 14 19 17',
);
add(
  'flame',
  'M 10 2 C 13 9 18 7 17 13 C 17 20 3 20 3 13 C 3 9 7 9 6 5 L 9 8 Z M 10 11 C 13 15 13 17 10 18 C 6 17 7 14 10 11 Z',
);
add('shield', 'M 10 2 L 18 5 V 10 C 18 14 14 17 10 19 C 6 17 2 14 2 10 V 5 Z');
add('money', rect(2, 4, 16, 12, 1), circle(10, 10, 3), line(4, 7, 5, 7), line(15, 13, 16, 13));
add('credit-card', rect(2, 4, 16, 12, 2), line(2, 8, 18, 8), line(5, 12, 8, 12));
add('key', circle(6, 7, 4), line(9, 10, 17, 18, 19, 16, 17, 14, 15, 16), line(4, 5, 4, 5.1));
add(
  'gun',
  polygon(2, 5, 18, 5, 18, 9, 9, 9, 9, 17, 4, 17, 5, 9, 2, 9),
  line(9, 9, 13, 9, 13, 12, 9, 12),
);
add('knife', polygon(17, 2, 13, 13, 10, 14, 6, 18, 2, 15, 7, 11, 8, 7));
add(
  'handcuffs',
  circle(5, 12, 4),
  circle(15, 7, 4),
  line(8, 9, 11, 8),
  line(5, 8, 5, 5),
  line(15, 11, 15, 14),
);
add(
  'skull',
  'M 5 13 C -3 2 22 -4 17 11 L 15 14 V 18 H 5 Z',
  circle(7, 9, 1.5),
  circle(13, 9, 1.5),
  line(8, 15, 8, 18),
  line(12, 15, 12, 18),
);
add(
  'ball',
  circle(10, 10, 8),
  polygon(10, 6, 14, 9, 12, 14, 7, 14, 6, 9),
  line(10, 2, 10, 6),
  line(18, 8, 14, 9),
  line(15, 17, 12, 14),
  line(5, 17, 7, 14),
  line(2, 8, 6, 9),
);
add(
  'racket',
  'M 10 2 C 2 0 0 10 7 13 C 15 15 19 5 10 2 Z',
  line(11, 13, 17, 19),
  line(5, 5, 11, 10),
  line(4, 9, 11, 3),
);
add('flag', line(4, 2, 4, 19), polygon(4, 3, 17, 3, 14, 7, 17, 11, 4, 11));
add('tent', polygon(10, 2, 19, 18, 1, 18), line(6, 18, 10, 9, 14, 18));
add('cup', rect(3, 5, 11, 12, 1), 'M 14 6 C 22 6 19 13 14 13', line(2, 19, 16, 19));
add(
  'utensils',
  line(3, 2, 3, 8, 7, 8, 7, 2),
  line(5, 2, 5, 18),
  'M 16 2 C 11 4 11 11 16 11 V 18',
  line(16, 2, 16, 11),
);
add('wine', 'M 5 2 H 15 L 14 8 C 14 13 6 13 6 8 Z', line(10, 12, 10, 18), line(6, 18, 14, 18));
add(
  'pizza',
  polygon(3, 3, 18, 10, 3, 18),
  'M 3 3 Q 8 10 3 18',
  circle(9, 8, 0.7),
  circle(10, 12, 0.7),
);
add('book', rect(3, 2, 14, 16, 1), line(6, 2, 6, 18), line(9, 6, 14, 6), line(9, 9, 14, 9));
add(
  'open-book',
  'M 10 5 Q 6 2 2 4 V 17 Q 6 15 10 18 Q 14 15 18 17 V 4 Q 14 2 10 5 Z',
  line(10, 5, 10, 18),
);
add(
  'graduation-cap',
  polygon(1, 7, 10, 3, 19, 7, 10, 11),
  'M 5 9 V 14 Q 10 18 15 14 V 9',
  line(19, 7, 19, 15),
);
add('monitor', rect(2, 3, 16, 12, 1), line(10, 15, 10, 18), line(6, 18, 14, 18));
add('mobile', rect(5, 1.5, 10, 17, 2), line(8, 4, 12, 4), line(9, 16, 11, 16));
add('tablet', rect(3, 2, 14, 16, 2), line(9, 15, 11, 15));
add(
  'keyboard',
  rect(1.5, 4, 17, 12, 1),
  line(4, 7, 5, 7),
  line(8, 7, 9, 7),
  line(12, 7, 13, 7),
  line(16, 7, 16.5, 7),
  line(4, 10, 5, 10),
  line(8, 10, 9, 10),
  line(12, 10, 13, 10),
  line(5, 13, 15, 13),
);
add(
  'server',
  rect(3, 2, 14, 16, 1),
  line(3, 7, 17, 7),
  line(3, 12, 17, 12),
  circle(6, 5, 0.5),
  circle(6, 10, 0.5),
  circle(6, 15, 0.5),
);
add(
  'database',
  'M 17 5 C 17 9 3 9 3 5 C 3 1 17 1 17 5 Z M 3 5 V 15 C 3 19 17 19 17 15 V 5 M 3 10 C 3 14 17 14 17 10',
);
add('code', line(6, 4, 1, 10, 6, 16), line(14, 4, 19, 10, 14, 16), line(12, 2, 8, 18));
add('terminal', rect(2, 3, 16, 14, 1), line(5, 7, 8, 10, 5, 13), line(10, 13, 15, 13));
add(
  'network',
  circle(10, 3, 2),
  circle(3, 15, 2),
  circle(17, 15, 2),
  circle(10, 11, 2),
  line(10, 5, 10, 9),
  line(8, 12, 4.5, 14),
  line(12, 12, 15.5, 14),
);
add(
  'table',
  rect(2, 2, 16, 16),
  line(2, 7, 18, 7),
  line(2, 12, 18, 12),
  line(7, 2, 7, 18),
  line(12, 7, 12, 18),
);
add(
  'chart-bar',
  line(2, 2, 2, 18, 18, 18),
  rect(5, 10, 3, 5, 0.2),
  rect(10, 6, 3, 9, 0.2),
  rect(15, 3, 3, 12, 0.2),
);
add(
  'chart-line',
  line(2, 2, 2, 18, 18, 18),
  line(4, 13, 8, 7, 12, 10, 17, 3),
  circle(8, 7, 0.6),
  circle(12, 10, 0.6),
);
add('chart-pie', 'M 9 2 A 8 8 0 1 0 18 11 H 9 Z M 12 2 V 8 H 18 A 6 6 0 0 0 12 2 Z');
add(
  'chart-scatter',
  line(2, 2, 2, 18, 18, 18),
  circle(6, 12, 0.7),
  circle(9, 8, 0.7),
  circle(12, 11, 0.7),
  circle(15, 4, 0.7),
  circle(17, 8, 0.7),
);
add(
  'list',
  line(6, 4, 18, 4),
  line(6, 10, 18, 10),
  line(6, 16, 18, 16),
  circle(2, 4, 0.5),
  circle(2, 10, 0.5),
  circle(2, 16, 0.5),
);
add('menu', line(2, 4, 18, 4), line(2, 10, 18, 10), line(2, 16, 18, 16));
add(
  'form',
  rect(2, 2, 16, 16),
  line(5, 6, 8, 6),
  rect(10, 4, 5, 4, 0.4),
  line(5, 13, 8, 13),
  rect(10, 11, 5, 4, 0.4),
);
add('toggle', rect(2, 6, 16, 8, 4), circle(6, 10, 2));
add('slider', line(2, 5, 18, 5), line(2, 15, 18, 15), circle(7, 5, 2.5), circle(13, 15, 2.5));
add('button', rect(2, 6, 16, 8, 3), line(7, 10, 13, 10));
add('dialog', rect(2, 3, 16, 14, 2), line(2, 7, 18, 7), line(12, 12, 15, 12));
add('panel', rect(2, 2, 16, 16), line(7, 2, 7, 18));
register('grid', grid(2, 2));
register('grid-3', grid(3, 3));
add('cursor', polygon(3, 2, 17, 11, 11, 12, 9, 18));
add(
  'hand',
  'M 6 9 V 4 C 6 1 9 1 9 4 V 9 V 2 C 9 -1 12 0 12 3 V 9 V 4 C 12 1 15 2 15 5 V 10 V 7 C 15 4 18 5 18 8 V 14 Q 18 19 11 18 L 6 17 L 2 12 Q 1 9 4 10 L 6 12 Z',
);
add('pencil', polygon(3, 13, 13, 3, 17, 7, 7, 17, 2, 18), line(11, 5, 15, 9));
add('brush', polygon(9, 11, 15, 2, 18, 5, 11, 14), 'M 9 11 C 3 10 6 17 2 18 C 8 20 12 16 11 14');
add('scissors', circle(5, 15, 3), circle(15, 15, 3), line(7, 13, 17, 2), line(13, 13, 3, 2));
add(
  'ruler',
  polygon(2, 13, 13, 2, 18, 7, 7, 18),
  line(6, 9, 9, 12),
  line(9, 6, 11, 8),
  line(12, 3, 15, 6),
);
add(
  'palette',
  'M 10 2 C 0 1 -2 16 7 18 C 12 21 11 14 13 14 C 21 16 22 2 10 2 Z',
  circle(6, 6, 0.7),
  circle(12, 5, 0.7),
  circle(16, 8, 0.7),
  circle(5, 12, 0.7),
);
add(
  'lightbulb',
  'M 6 13 C -1 3 13 -3 16 5 C 18 9 14 11 14 13 Z',
  line(7, 16, 13, 16),
  line(8, 19, 12, 19),
);
add(
  'battery',
  rect(2, 5, 14, 10, 1),
  rect(16, 8, 2, 4, 0.2),
  line(5, 8, 5, 12),
  line(8, 8, 8, 12),
  line(11, 8, 11, 12),
);
add(
  'plug',
  line(6, 2, 6, 7),
  line(14, 2, 14, 7),
  'M 3 7 H 17 V 10 Q 17 15 10 15 Q 3 15 3 10 Z',
  line(10, 15, 10, 19),
);
add('wifi', 'M 2 6 Q 10 -1 18 6 M 5 10 Q 10 5 15 10 M 8 14 Q 10 12 12 14', circle(10, 18, 0.5));
add('phone', 'M 4 2 L 8 6 L 6 9 Q 8 12 11 14 L 14 12 L 18 16 Q 15 23 6 14 Q -3 5 4 2 Z');
add(
  'clipboard',
  rect(4, 3, 12, 15, 1),
  rect(7, 2, 6, 3, 0.5),
  line(7, 9, 13, 9),
  line(7, 13, 13, 13),
);
add(
  'ticket',
  'M 2 4 H 18 V 8 C 13 8 13 12 18 12 V 16 H 2 V 12 C 7 12 7 8 2 8 Z',
  line(11, 6, 11, 7),
  line(11, 10, 11, 11),
  line(11, 14, 11, 15),
);
add(
  'box',
  polygon(2, 6, 10, 2, 18, 6, 18, 15, 10, 19, 2, 15),
  line(2, 6, 10, 10, 18, 6),
  line(10, 10, 10, 19),
);
add(
  'hammer',
  polygon(3, 4, 8, 1.5, 14, 6, 12, 9, 9, 7, 4, 12, 2, 10, 7, 5),
  polygon(10, 9, 12, 7, 18, 15, 16, 18),
);
add(
  'wrench',
  'M 15 2 L 11 6 L 14 9 L 18 5 C 21 12 14 15 10 12 L 5 18 A 2 2 0 0 1 2 15 L 8 10 C 5 4 9 0 15 2 Z',
);
add(
  'binoculars',
  rect(2, 7, 6, 10, 2),
  rect(12, 7, 6, 10, 2),
  line(4, 7, 4, 3, 7, 3, 8, 8),
  line(12, 8, 13, 3, 16, 3, 16, 7),
  line(8, 11, 12, 11),
);
add(
  'eyedropper',
  polygon(3, 14, 11, 6, 14, 9, 6, 17, 2, 18),
  line(10, 3, 17, 10),
  polygon(12, 5, 16, 1, 19, 4, 15, 8),
);
add(
  'magic-wand',
  line(3, 17, 14, 6),
  line(11, 3, 17, 9),
  line(3, 2, 3, 6),
  line(1, 4, 5, 4),
  line(16, 13, 16, 17),
  line(14, 15, 18, 15),
);
add(
  'fingerprint',
  'M 2 12 C 1 -1 19 -1 18 12 M 5 14 C 3 2 17 2 15 13 Q 15 17 13 19 M 8 18 C 10 14 5 8 10 7 C 14 8 11 14 11 17 M 2 16 L 4 19',
);
add(
  'rain',
  'M 5 11 C -1 11 0 5 5 6 C 7 0 14 0 15 6 C 21 6 21 12 15 11 Z',
  line(6, 14, 4, 18),
  line(11, 14, 9, 18),
  line(16, 14, 14, 18),
);
add(
  'snowflake',
  line(10, 1.5, 10, 18.5),
  line(2.5, 5.5, 17.5, 14.5),
  line(2.5, 14.5, 17.5, 5.5),
  line(7, 3, 10, 5, 13, 3),
  line(7, 17, 10, 15, 13, 17),
);
add(
  'wind',
  'M 2 6 H 13 C 19 6 17 0 14 2 M 2 10 H 17 C 23 10 20 17 17 14 M 2 14 H 8 C 14 14 12 20 9 18',
);
add('mountain', polygon(2, 18, 8, 5, 12, 12, 15, 7, 19, 18), line(6, 9, 8, 11, 10, 9));
add('earthquake', polygon(2, 8, 10, 2, 18, 8, 17, 18, 12, 18, 13, 12, 8, 9, 10, 18, 3, 18));
add(
  'tornado',
  'M 2 3 Q 10 0 18 3 Q 10 6 2 3 M 4 7 Q 10 5 16 7 Q 10 9 4 7 M 6 11 Q 10 9 14 11 Q 10 13 6 11 M 8 15 Q 10 13 12 15 L 10 19',
);
add(
  'anchor',
  circle(10, 4, 2),
  line(10, 6, 10, 18),
  line(6, 9, 14, 9),
  'M 2 12 C 2 20 18 20 18 12',
  line(2, 12, 2, 16, 5, 14),
  line(18, 12, 18, 16, 15, 14),
);
add(
  'valve',
  line(2, 10, 18, 10),
  polygon(5, 5, 15, 15, 15, 5, 5, 15),
  line(10, 5, 10, 2),
  line(7, 2, 13, 2),
);
add(
  'pipe',
  line(2, 5, 9, 5, 9, 2),
  line(2, 9, 5, 9, 5, 18),
  line(9, 18, 9, 9, 18, 9),
  line(18, 5, 9, 5),
  line(2, 3, 2, 11),
  line(3, 18, 11, 18),
);
add(
  'pump',
  circle(9, 10, 6),
  polygon(6, 6, 13, 10, 6, 14),
  line(2, 10, 3, 10),
  line(15, 10, 18, 10),
  line(5, 18, 13, 18),
  line(7, 16, 7, 18),
  line(11, 16, 11, 18),
);
add('tank', rect(4, 4, 12, 12, 3), 'M 4 5 Q 10 9 16 5', line(6, 16, 6, 18), line(14, 16, 14, 18));
add(
  'electric-pole',
  line(10, 2, 10, 18),
  line(3, 5, 17, 5),
  line(5, 3, 5, 7),
  line(15, 3, 15, 7),
  line(5, 7, 10, 10, 15, 7),
);
add(
  'transformer',
  line(2, 10, 5, 10),
  line(15, 10, 18, 10),
  'M 7 3 C 2 4 10 7 5 9 C 2 11 10 13 5 15 C 4 16 5 17 7 17 M 13 3 C 18 4 10 7 15 9 C 18 11 10 13 15 15 C 16 16 15 17 13 17',
  line(9, 2, 9, 18),
  line(11, 2, 11, 18),
);
add(
  'meter',
  circle(10, 10, 8),
  'M 4 10 A 6 6 0 0 1 16 10',
  line(10, 10, 14, 6),
  line(6, 15, 14, 15),
);
add(
  'sensor',
  circle(10, 10, 2),
  'M 5 5 Q 0 10 5 15 M 15 5 Q 20 10 15 15 M 2 2 Q -5 10 2 18 M 18 2 Q 25 10 18 18',
);
add('ground', line(10, 2, 10, 10), line(3, 10, 17, 10), line(5, 14, 15, 14), line(8, 18, 12, 18));
add('switch', circle(3, 12, 1.5), circle(17, 12, 1.5), line(5, 11, 14, 4));
add(
  'recycle',
  'M 7 3 L 10 1.5 L 14 8 H 9 L 11 6 M 18 10 L 19 14 L 12 18 V 13 L 14 15 M 8 18 L 3 17 L 1.5 9 L 6 11 L 4 12',
  line(7, 3, 5, 6),
  line(18, 10, 16, 7),
  line(8, 18, 11, 18),
);

aliases('close', 'x', 'wrong', 'discard');
aliases('search', 'magnifying-glass', 'smart-search', 'smart-camera-search');
aliases('more', 'ellipsis', 'more-horizontal', 'hamburger-more');
aliases('menu', 'hamburger');
aliases('person', 'user', 'person-2');
aliases('people', 'users', 'group');
aliases('gear', 'settings', 'setting', 'configure', 'configuration', 'cog');
aliases('mail', 'envelope', 'email', 'email-address');
aliases('information', 'info', 'information-letter');
aliases(
  'warning',
  'exclamation-mark-triangle',
  'exclamation-point',
  'exclamation-point-two',
  'exclamation-mark',
);
aliases('refresh', 'sync', 'reset', 'reload');
aliases('pencil', 'edit', 'draw', 'pen', 'pencil-mark');
aliases('copy', 'duplicate');
aliases('trash', 'recycle-bin', 'delete', 'remove');
aliases('globe', 'web', 'world', 'language');
aliases('table', 'attribute-table');
aliases('layers', 'layer');
aliases('layer-add', 'add-layer');
aliases('layer-visibility', 'layer-hide', 'hide-layers');
aliases('map-pin', 'pin', 'pin-tear', 'locator', 'location', 'pushpin');
aliases('clipboard', 'inspection', 'survey', 'work-order');
aliases('clock', 'time', 'timer', 'recent');
aliases('monitor', 'desktop', 'screen');
aliases('mobile', 'phone-device');
aliases('database', 'data', 'storage', 'data-source');
aliases('chart-bar', 'graph-bar', 'chart-column', 'chart');
aliases('chart-line', 'graph-line-series');
aliases('chart-pie', 'pie-chart');
aliases('chart-scatter', 'graph-scatter-plot', 'chart-scatter-plot');
aliases('cloud', 'cloudy', 'partly-cloudy', 'party-cloudy');
aliases('flame', 'fire', 'wildfire');
aliases('leaf', 'agriculture', 'vegetation', 'vegetation-index');
aliases('building', 'default-building', 'house', 'buildings', 'facility');
aliases('bank', 'government-building', 'courthouse', 'city-hall');
aliases('shop', 'shopping', 'market', 'marketplace', 'store');
aliases('school', 'education', 'college-or-university');
aliases('book', 'library', 'dictionary');
aliases('parking', 'bike-parking', 'trailer-parking');
aliases('airplane', 'plane', 'airport');
aliases('boat', 'sail-boat', 'small-boat', 'raft');
aliases('ship', 'container-ship', 'ferry-terminal');
aliases('bus', 'bus-station', 'bus-travel-mode', 'shuttle-travel-mode');
aliases('car', 'car-two', 'rental-cars', 'car-rental', 'car-travel-mode');
aliases(
  'truck',
  'box-van',
  'van',
  'pickup-truck',
  'semi-truck',
  'utility-truck',
  'dump-truck',
  'truck-travel-mode',
);
aliases(
  'train',
  'railroad',
  'rail-station',
  'metro-station',
  'train-travel-mode',
  'rail-depot',
  'tram-travel-mode',
);
aliases('bicycle', 'bike', 'bike-sharing', 'bicycle-travel-mode');
aliases('motorcycle', 'motorcycle-travel-mode', 'scooter-travel-mode', 'moped-travel-mode');
aliases('utensils', 'restaurant', 'food', 'default-food-and-drink');
aliases('cup', 'coffee', 'coffee-or-tea', 'beer', 'beer-can');
aliases('wine', 'winery', 'cocktail', 'bottle');
aliases(
  'ball',
  'soccer',
  'football',
  'basketball',
  'baseball',
  'softball',
  'rugby',
  'futsal',
  'handball-racquetball',
  'default-sport',
);
aliases('racket', 'tennis', 'racquet', 'pickleball');
aliases('tent', 'camp', 'campground', 'camping');
aliases('water', 'ocean', 'river', 'liquid', 'hydro', 'tidal');
aliases('mountain', 'land-feature-hill', 'default-land-feature', 'avalanche', 'landslide');
aliases('snowflake', 'snow', 'snow-index', 'ice-cube');
aliases(
  'valve',
  'access-valve',
  'flow-valve',
  'pressure-valve',
  'shutoff-valve',
  'valve-open',
  'valve-closed',
  'relief-valve',
  'pressure-regulating-valve',
  'riser-valve',
);
aliases('pump', 'pump-left', 'pump-right', 'compressor', 'generator', 'generation');
aliases('electric-pole', 'pole', 'street-lamp', 'streetlight', 'streetlight-electrical', 'tower');
aliases(
  'meter',
  'utility-meter',
  'customer-meter',
  'flow-meter',
  'pressure-sensor',
  'pressure-monitoring-device',
  'regulator',
);
aliases('pipe', 'joint', 'elbow', 'riser', 'splice', 'service-tee', 'service-connection');
aliases(
  'tank',
  'storage-water-and-sewer',
  'underground-storage-tank',
  'large-propane-tank',
  'propane-tank',
);
aliases('ground', 'electrical-shut-off', 'electric-shunt-switch');
aliases('switch', 'circuit-breaker', 'breaker', 'recloser', 'sectionalizer', 'fuse');
export function get(name) {
  return glyphs.get(name);
}
