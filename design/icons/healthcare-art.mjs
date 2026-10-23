// Original Oddkin clinical artwork. Reference inventories supply concepts, not paths.
import {
  get,
  path,
  line,
  polygon,
  circle,
  rect,
  transform,
  lettering,
  textGlyph,
  badge,
  slash,
  enclosure,
  repeated,
  normalized,
} from './outline-art.mjs';
import { resolveGlyph } from './reference-art.mjs';
const H = new Map();
const art = (key, body, category = 'Clinical anatomy') => ({ key, body, category });
const draw = (key, ...d) => {
  const g = art(key, d.map((x) => path(x)).join(''));
  H.set(key, g);
  return g;
};
const base = (name) =>
  H.get(name) || get(name) || resolveClinicalFamily(name, {}) || resolveGlyph(name);
const combine = (key, a, b) =>
  a && b ? art(key, transform(a.body, 0.7, 0.7, 0.62) + transform(b.body, 11.4, 11.4, 0.38)) : null;
const status = (key, g, mark) => (g ? { ...badge(g, mark), key } : null);

draw(
  'antibody',
  line(10, 18, 10, 10, 3, 3),
  line(10, 10, 17, 3),
  line(3, 1.5, 3, 5, 6, 5),
  line(17, 1.5, 17, 5, 14, 5),
);
draw(
  'bacteria',
  'M 4 6 C 2 0 13 0 13 6 V 13 C 13 19 4 19 4 13 Z',
  circle(8, 7, 0.7),
  circle(10, 12, 0.7),
  line(2, 4, 4, 5),
  line(13, 5, 16, 3),
  line(2, 13, 4, 12),
  'M 13 15 Q 20 12 18 18',
);
draw(
  'cell',
  circle(10, 10, 8),
  circle(10, 10, 3),
  circle(6, 6, 0.5),
  circle(14, 7, 0.5),
  line(5, 13, 7, 14),
  line(13, 14, 15, 12),
);
draw(
  'blood-cells',
  'M 2 7 C 2 0 12 0 12 7 C 12 14 2 14 2 7 Z M 5 7 C 5 3 9 3 9 7 C 9 11 5 11 5 7 Z M 10 14 C 10 7 19 7 19 14 C 19 20 10 20 10 14 Z M 13 14 Q 15 10 17 14 Q 15 18 13 14',
);
draw(
  'blood-vessel',
  'M 7 2 V 8 L 2 15 L 5 18 L 10 11 L 15 18 L 18 15 L 13 8 V 2',
  line(10, 2, 10, 7),
  line(5, 15, 10, 8, 15, 15),
);
draw(
  'bladder',
  'M 5 2 V 6 C -1 9 5 15 8 15 V 18 H 12 V 15 C 15 15 21 9 15 6 V 2 M 5 6 Q 10 9 15 6',
);
draw(
  'breasts',
  'M 3 2 Q 6 8 3 12 C 0 18 8 19 10 14 C 12 19 20 18 17 12 Q 14 8 17 2',
  circle(6, 13, 0.6),
  circle(14, 13, 0.6),
);
draw(
  'colon',
  'M 6 18 V 8 C 6 6 4 6 4 8 V 12 C 4 15 1 15 1 12 V 5 C 1 1 6 1 7 3 C 9 1 12 1 14 3 C 18 1 19 4 19 6 V 12 C 19 16 14 17 13 14 V 8 C 13 6 11 6 11 8 V 18',
);
draw(
  'intestine',
  'M 5 2 H 15 C 19 2 19 6 15 6 H 6 C 2 6 2 10 6 10 H 14 C 18 10 18 14 14 14 H 7 C 3 14 3 18 7 18 H 15',
  line(4, 2, 4, 4),
  line(16, 16, 16, 18),
);
draw(
  'gallbladder',
  'M 8 2 V 8 C 2 9 4 18 9 18 C 14 18 15 11 11 8 V 2',
  line(11, 4, 17, 4),
  line(14, 4, 14, 8),
);
draw(
  'heart-organ',
  'M 9 4 V 1.5 H 12 V 5 L 15 3 L 17 6 L 14 8 C 20 11 15 19 10 18 C 1 17 1 6 6 5 Z',
  line(8, 7, 10, 10, 9, 17),
  line(10, 10, 15, 11),
);
draw(
  'joints',
  'M 4 2 H 8 L 10 6 L 8 9 H 4 L 2 6 Z M 12 11 H 16 L 18 14 L 16 18 H 12 L 10 14 Z',
  line(7, 11, 9, 13),
  line(11, 7, 13, 9),
);
draw(
  'lymph-nodes',
  circle(10, 10, 2.5),
  circle(4, 3, 1.5),
  circle(16, 3, 1.5),
  circle(3, 16, 1.5),
  circle(17, 16, 1.5),
  line(5, 4, 9, 8),
  line(15, 4, 11, 8),
  line(4, 15, 8, 11),
  line(16, 15, 12, 11),
);
draw(
  'nerve',
  line(10, 2, 10, 18),
  line(10, 7, 5, 4, 3, 4),
  line(10, 10, 15, 6, 17, 6),
  line(10, 14, 5, 11, 2, 11),
  line(10, 16, 15, 13, 18, 13),
);
draw(
  'pancreas',
  'M 2 12 C 1 4 5 7 8 5 Q 13 3 18 6 C 20 10 14 9 12 12 Q 9 16 4 14 Z',
  line(5, 10, 8, 9, 11, 10, 15, 7),
);
draw(
  'penis',
  'M 6 3 C 7 0 12 0 13 3 V 12 C 19 11 18 19 13 18 Q 10 16 7 18 C 2 19 1 12 6 12 Z M 6 5 H 13',
  line(10, 2, 10, 4),
);
draw(
  'prostate',
  'M 6 2 V 5 Q 10 7 14 5 V 2 M 6 5 C 0 7 3 14 8 14 V 18 H 12 V 14 C 17 14 20 7 14 5 Z',
  line(10, 7, 10, 13),
);
draw(
  'skeleton',
  circle(10, 4, 2.5),
  line(10, 7, 10, 14),
  line(5, 8, 15, 8),
  line(4, 8, 2, 15),
  line(16, 8, 18, 15),
  line(7, 10, 13, 10),
  line(7, 12, 13, 12),
  line(7, 14, 13, 14),
  line(8, 14, 6, 19),
  line(12, 14, 14, 19),
);
draw(
  'spine',
  'M 10 1.5 C 2 5 17 13 10 18.5',
  ...Array.from({ length: 5 }, (_, i) => rect(7 + (i % 2 ? 2 : 0), 2 + i * 3, 4, 2, 0.5)),
);
draw('spleen', 'M 13 2 C 0 0 -2 17 6 18 C 14 19 18 8 16 5 Q 15 2 13 2 Z M 7 7 Q 12 8 12 12');
draw('stomach', 'M 8 2 V 7 C 15 -2 22 9 15 15 Q 10 20 4 16 V 18 H 1 V 12 Q 6 14 7 10 V 2');
draw(
  'testicles',
  'M 7 2 V 7 Q 1 8 2 14 C 2 20 9 20 10 14 C 11 20 18 20 18 14 Q 19 8 13 7 V 2',
  line(10, 7, 10, 14),
);
draw(
  'thyroid',
  line(9, 2, 9, 9),
  line(11, 2, 11, 9),
  'M 9 9 C 1 -1 -1 18 7 17 L 10 13 L 13 17 C 21 18 19 -1 11 9 Z',
);
draw(
  'tissue',
  rect(2, 2, 16, 16, 2),
  line(2, 7, 7, 5, 12, 7, 18, 5),
  line(2, 13, 7, 11, 12, 13, 18, 11),
  line(7, 5, 7, 11, 5, 18),
  line(12, 7, 12, 13, 15, 18),
);
draw(
  'tumour',
  circle(10, 10, 7),
  circle(8, 8, 3),
  circle(13, 10, 3),
  circle(9, 13, 2.5),
  line(10, 1, 10, 3),
  line(1, 10, 3, 10),
  line(17, 10, 19, 10),
);
draw(
  'uterus',
  'M 7 7 C 4 3 1 4 2 8 C 3 11 5 10 6 7 M 13 7 C 16 3 19 4 18 8 C 17 11 15 10 14 7 M 6 7 Q 10 10 14 7 C 16 12 11 13 11 16 V 18 H 9 V 16 C 9 13 4 12 6 7 Z',
);
draw('vagina', 'M 4 2 Q 10 6 16 2 L 14 7 L 12 10 V 18 H 8 V 10 L 6 7 Z', line(8, 11, 12, 11));
draw(
  'vulva',
  'M 10 2 C -1 2 0 19 10 18 C 20 19 21 2 10 2 Z M 10 4 C 3 7 6 12 10 17 C 14 12 17 7 10 4 Z',
  circle(10, 8, 1),
);
draw(
  'anus',
  circle(10, 10, 8),
  circle(10, 10, 2.5),
  line(5, 5, 8, 8),
  line(12, 12, 15, 15),
  line(5, 15, 8, 12),
  line(12, 8, 15, 5),
);
draw(
  'oesophagus',
  'M 7 2 V 10 C 7 15 15 12 16 17 M 11 2 V 8 C 11 12 19 10 19 17',
  line(7, 4, 11, 4),
  line(7, 7, 11, 7),
);
draw('liver-alt', 'M 2 6 Q 10 0 18 5 Q 17 12 4 17 Q 1 13 2 6 Z M 10 4 L 9 11 L 4 17');
draw(
  'enzyme',
  circle(9, 10, 7),
  polygon(12, 3, 18, 3, 18, 9, 15, 9, 15, 6, 12, 6),
  line(5, 7, 6, 7),
  line(5, 12, 8, 13),
);
draw('cancer-ribbon', 'M 7 9 C 0 -1 20 -1 13 9 L 5 18 L 2 15 L 10 6 L 18 15 L 15 18 Z');
draw(
  'stent',
  rect(2, 6, 16, 8, 1),
  line(3, 7, 6, 13, 9, 7, 12, 13, 15, 7, 18, 13),
  line(2, 10, 18, 10),
);
draw(
  'varicose-vein',
  'M 6 2 C 1 4 10 5 5 8 C 0 11 10 11 6 15 Q 4 17 6 18 M 12 2 C 7 4 17 6 13 9 C 8 12 18 11 14 15 L 13 18',
);
draw('sperm', 'M 3 5 C 3 0 10 0 10 5 C 10 10 3 10 3 5 Z M 8 8 C 15 7 10 18 18 17');
draw(
  'iud',
  line(3, 3, 17, 3),
  line(10, 3, 10, 14),
  line(7, 14, 13, 14),
  'M 10 14 V 17 Q 10 20 7 18',
);
draw(
  'copper-iud',
  line(3, 3, 17, 3),
  line(10, 3, 10, 14),
  line(8, 6, 12, 7),
  line(8, 9, 12, 10),
  line(8, 12, 12, 13),
  'M 10 14 V 18 Q 7 20 7 17',
);
draw('condom', 'M 7 3 C 7 -1 13 -1 13 3 V 15 H 7 Z', rect(4, 15, 12, 3, 1.5), line(9, 2, 11, 2));
draw(
  'female-condom',
  'M 4 4 Q 10 0 16 4 V 14 Q 10 18 4 14 Z M 4 4 Q 10 8 16 4 M 4 14 Q 10 10 16 14',
  line(5, 18, 15, 18),
);
draw('diaphragm', 'M 2 13 A 8 8 0 0 1 18 13 Z M 2 13 Q 10 19 18 13');
draw('hormonal-ring', circle(10, 10, 8), circle(10, 10, 5));
draw('implant', rect(5, 2, 3, 16, 1.5), rect(11, 2, 3, 16, 1.5));
draw(
  'inhaler',
  polygon(5, 2, 13, 2, 13, 12, 17, 12, 17, 18, 4, 18, 4, 12, 5, 12),
  line(5, 6, 13, 6),
  line(7, 15, 13, 15),
);
draw(
  'breast-pump',
  'M 2 3 L 9 7 V 11 L 2 15 Z M 9 8 H 14 V 5 H 18 V 9 H 14 V 12',
  rect(11, 12, 7, 6, 1),
);
draw(
  'cast',
  polygon(6, 2, 13, 2, 12, 11, 17, 14, 15, 18, 4, 17, 3, 13),
  line(5, 7, 12, 9),
  line(4, 11, 11, 13),
);
draw(
  'cochlear-implant',
  'M 3 9 C 1 -1 18 -1 16 9 Q 15 14 11 13 Q 8 14 9 18',
  circle(11, 7, 3),
  line(11, 7, 14, 10),
);
draw('contact-lenses', 'M 2 9 Q 6 2 10 9 Q 6 16 2 9 Z M 11 12 Q 15 5 19 12 Q 15 19 11 12 Z');
draw(
  'defibrillator',
  rect(2, 3, 16, 15, 2),
  line(6, 3, 6, 1.5, 14, 1.5, 14, 3),
  polygon(11, 6, 7, 11, 11, 11, 9, 15),
);
draw(
  'glucometer',
  rect(5, 4, 10, 14, 2),
  rect(8, 1.5, 4, 3, 0.2),
  rect(7, 7, 6, 4, 0.5),
  circle(10, 14, 1),
);
draw(
  'dialysis',
  rect(2, 2, 10, 16, 1),
  rect(4, 4, 6, 5, 0.5),
  circle(7, 13, 2),
  rect(15, 6, 3, 8, 1),
  'M 12 4 Q 19 1 17 6 M 16 14 Q 16 18 11 16',
);
draw(
  'ecmo',
  rect(2, 2, 9, 15, 1),
  rect(4, 4, 5, 4, 0.3),
  circle(6.5, 12, 2),
  'M 11 5 C 20 -1 20 20 11 15',
  circle(16, 10, 2),
  line(4, 18, 10, 18),
);
draw(
  'endotracheal-tube',
  'M 4 2 V 10 Q 4 16 10 16 H 18 M 8 2 V 9 Q 8 12 11 12 H 18',
  rect(1.5, 2, 9, 2, 0.3),
  line(14, 12, 14, 16),
);
draw(
  'laryngoscope',
  polygon(3, 2, 8, 2, 8, 11, 15, 11, 18, 14, 18, 17, 13, 15, 5, 15, 3, 11),
  line(3, 6, 8, 6),
);
draw(
  'hospital-bed',
  line(2, 3, 2, 18),
  line(18, 10, 18, 18),
  rect(2, 10, 16, 5, 0.6),
  circle(6, 7, 2),
  line(10, 8, 17, 8, 18, 10),
);
draw(
  'patient-in-bed',
  line(2, 6, 2, 18),
  line(18, 9, 18, 18),
  line(2, 15, 18, 15),
  circle(5, 10, 2),
  'M 8 11 Q 10 6 14 10 L 18 12',
);
draw(
  'bed-net',
  polygon(2, 3, 18, 3, 18, 17, 2, 17),
  line(10, 3, 10, 16),
  line(2, 8, 18, 8),
  line(2, 13, 18, 13),
  line(6, 3, 6, 17),
  line(14, 3, 14, 17),
);
draw(
  'oxygen-tank',
  rect(5, 5, 10, 13, 3),
  line(8, 5, 8, 2, 12, 2, 12, 5),
  line(7, 2, 13, 2),
  circle(16, 4, 2),
  'M 15 9 Q 20 7 18 15',
  line(8, 10, 12, 10),
);
draw(
  'orthotics',
  polygon(5, 2, 11, 2, 11, 11, 17, 14, 17, 18, 4, 18, 3, 14),
  line(7, 4, 7, 11, 14, 15),
  line(4, 14, 9, 14),
);
draw(
  'patient-band',
  rect(1.5, 6, 17, 8, 3),
  rect(5, 6, 10, 8, 0.5),
  line(7, 9, 13, 9),
  line(7, 12, 9, 12),
  line(17, 10, 17.1, 10),
);
draw(
  'sling',
  circle(11, 3, 1.5),
  line(9, 6, 4, 11, 10, 15, 16, 9),
  polygon(4, 11, 16, 11, 13, 17, 9, 17),
  line(9, 6, 16, 11),
);
draw(
  'staples',
  line(2, 10, 18, 10),
  line(4, 5, 4, 15),
  line(8, 5, 8, 15),
  line(12, 5, 12, 15),
  line(16, 5, 16, 15),
);
draw(
  'stitches',
  line(2, 10, 18, 10),
  line(3, 5, 7, 15),
  line(7, 5, 11, 15),
  line(11, 5, 15, 15),
  line(15, 5, 18, 12),
);
draw(
  'stethoscope',
  'M 3 2 V 7 A 5 5 0 0 0 13 7 V 2 M 8 12 V 14 C 8 20 17 20 17 13',
  circle(17, 10, 2.5),
  line(2, 2, 4, 2),
  line(12, 2, 14, 2),
);
draw(
  'surgical-tools',
  circle(4, 15, 2),
  circle(9, 15, 2),
  line(5, 13, 16, 2),
  line(8, 13, 2, 3),
  line(13, 17, 18, 6),
);
draw(
  'ct-scanner',
  rect(2, 2, 16, 16, 3),
  circle(10, 9, 5),
  rect(7, 10, 6, 8, 0.5),
  line(5, 18, 15, 18),
);
draw(
  'mri-scanner',
  rect(2, 2, 16, 16, 2),
  circle(10, 8, 4),
  rect(7, 10, 6, 8, 0.5),
  line(3, 4, 3, 14),
  line(17, 4, 17, 14),
);
draw(
  'ultrasound-device',
  rect(2, 2, 13, 11, 1),
  line(8, 13, 8, 17),
  line(4, 18, 12, 18),
  'M 15 5 C 20 5 17 13 19 14',
  rect(16, 14, 3, 4, 1),
  line(4, 10, 6, 6, 9, 9, 13, 6),
);
draw(
  'ventilator',
  rect(2, 2, 12, 14, 1),
  rect(4, 4, 8, 5, 0.5),
  line(4, 7, 6, 7, 8, 5, 10, 8, 12, 6),
  circle(6, 12, 1),
  line(14, 6, 17, 6, 17, 13, 19, 13),
  line(8, 16, 8, 18),
  line(4, 18, 12, 18),
);
draw(
  'cpap-machine',
  rect(2, 9, 10, 8, 2),
  rect(4, 11, 5, 3, 0.4),
  'M 12 12 C 20 18 19 4 14 5',
  polygon(11, 2, 17, 2, 18, 6, 14, 8, 10, 6),
);
draw(
  'cpap-mask',
  polygon(6, 4, 14, 4, 16, 13, 10, 17, 4, 13),
  circle(10, 11, 2),
  'M 4 8 C -1 6 0 15 5 14 M 16 8 C 21 6 20 15 15 14',
);
draw(
  'sample-container',
  rect(4, 4, 12, 14, 2),
  rect(3, 2, 14, 3, 0.5),
  line(4, 11, 16, 11),
  line(7, 14, 12, 14),
);
draw(
  'urine-sample',
  rect(4, 4, 12, 14, 1),
  rect(3, 2, 14, 3, 0.3),
  line(4, 12, 16, 12),
  'M 10 7 C 6 11 14 12 10 7 Z',
);
draw('specimen-swab', line(3, 17, 14, 6), rect(11, 1, 4, 8, 2), line(1.5, 18, 4, 18));
draw(
  'sanitizer',
  rect(4, 7, 12, 11, 2),
  line(8, 7, 8, 3, 15, 3, 15, 5),
  line(5, 2, 15, 2),
  line(8, 12, 12, 12),
  line(10, 10, 10, 14),
);
draw(
  'sanitizer-spray',
  rect(4, 8, 11, 10, 2),
  line(7, 8, 7, 3, 16, 3, 16, 6, 11, 6, 11, 8),
  line(16, 6, 18, 9),
  line(2, 4, 3, 4),
);
draw(
  'ppe-gown',
  polygon(6, 2, 14, 2, 19, 6, 16, 10, 14, 8, 15, 18, 5, 18, 6, 8, 4, 10, 1, 6),
  line(10, 3, 10, 18),
  line(6, 11, 14, 11),
);
draw(
  'ppe-suit',
  circle(10, 5, 3),
  polygon(
    6,
    2,
    14,
    2,
    18,
    8,
    16,
    12,
    14,
    10,
    15,
    18,
    11,
    18,
    10,
    13,
    9,
    18,
    5,
    18,
    6,
    10,
    4,
    12,
    2,
    8,
  ),
  line(10, 8, 10, 13),
);
draw(
  'n95-mask',
  polygon(3, 6, 10, 3, 17, 6, 16, 13, 10, 17, 4, 13),
  line(5, 7, 10, 5, 15, 7),
  line(5, 11, 15, 11),
  'M 3 6 C -1 5 0 15 4 13 M 17 6 C 21 5 20 15 16 13',
);
draw(
  'face-shield',
  circle(10, 6, 3),
  rect(3, 2, 14, 15, 3),
  line(3, 5, 17, 5),
  'M 6 15 Q 10 9 14 15',
);
draw(
  'blood-bag',
  rect(4, 3, 12, 13, 2),
  line(7, 1.5, 13, 1.5),
  line(7, 16, 7, 18),
  line(13, 16, 13, 18),
  'M 10 6 C 4 12 16 13 10 6 Z',
);
draw(
  'fetus',
  'M 10 3 C 2 0 0 8 3 14 C 5 20 16 19 18 12 C 21 5 16 0 10 3 Z',
  circle(10, 7, 2),
  'M 11 10 C 16 11 12 17 8 15 L 6 12 L 9 11',
);
draw(
  'cpr',
  line(2, 17, 18, 17),
  circle(4, 14, 2),
  line(7, 14, 17, 14),
  line(7, 3, 12, 8, 9, 11),
  line(14, 2, 17, 7, 12, 12),
  line(9, 11, 14, 11),
);
draw(
  'community-worker',
  circle(10, 5, 3),
  'M 3 18 V 14 Q 3 10 7 10 L 10 14 L 13 10 Q 17 10 17 14 V 18',
  line(12, 16, 16, 16),
  line(14, 14, 14, 18),
);
draw(
  'female-clinician',
  circle(10, 5, 2.5),
  'M 6 5 C 3 12 17 12 14 5 M 3 18 Q 3 9 10 11 Q 17 9 17 18',
  line(7, 12, 7, 16, 13, 16, 13, 12),
  circle(10, 16, 1),
);
draw(
  'male-clinician',
  circle(10, 5, 3),
  'M 3 18 V 14 Q 3 10 7 10 L 10 14 L 13 10 Q 17 10 17 14 V 18',
  line(10, 14, 10, 18),
  line(5, 14, 5, 17, 8, 17),
);
draw(
  'speech-therapy',
  circle(6, 5, 2.5),
  'M 2 18 V 14 Q 2 10 8 11',
  rect(11, 3, 7, 8, 1),
  line(11, 9, 9, 12, 14, 11),
  line(13, 6, 16, 6),
);
draw(
  'coffin',
  polygon(6, 2, 14, 2, 18, 7, 15, 18, 5, 18, 2, 7),
  line(10, 5, 10, 12),
  line(7, 8, 13, 8),
);
draw(
  'asclepius',
  line(10, 2, 10, 18),
  'M 15 3 C 0 2 3 9 13 9 C 20 9 14 16 6 14',
  line(8, 2, 12, 2),
);
draw(
  'mammography',
  rect(2, 2, 6, 16, 0.5),
  line(8, 5, 17, 5),
  line(8, 12, 17, 12),
  'M 12 5 C 21 6 18 12 12 12',
  line(4, 6, 6, 6),
);
draw(
  'anesthesia',
  rect(2, 7, 8, 11, 1),
  circle(6, 11, 2),
  'M 10 9 C 17 12 17 4 14 3',
  polygon(12, 2, 17, 2, 18, 6, 14, 8, 11, 5),
);
draw(
  'skin',
  rect(2, 3, 16, 14, 3),
  'M 2 9 Q 6 5 10 9 Q 14 13 18 9',
  circle(6, 13, 0.5),
  circle(13, 6, 0.5),
  circle(14, 14, 0.5),
);
draw(
  'mouth',
  'M 2 10 Q 10 2 18 10 Q 10 18 2 10 Z M 2 10 H 18',
  line(6, 8, 6, 11),
  line(10, 7, 10, 12),
  line(14, 8, 14, 11),
);
draw(
  'nose',
  'M 8 2 Q 10 4 8 9 L 5 13 Q 7 16 10 14 Q 13 17 16 13 M 12 2 V 9',
  circle(9, 13, 0.5),
  circle(13, 13, 0.5),
);
draw(
  'dizzy-face',
  circle(10, 10, 8),
  line(5, 6, 8, 9),
  line(5, 9, 8, 6),
  line(12, 6, 15, 9),
  line(12, 9, 15, 6),
  'M 6 14 Q 10 10 14 14',
);
draw(
  'sick-face',
  circle(10, 10, 8),
  line(5, 7, 8, 7),
  line(12, 7, 15, 7),
  'M 6 15 Q 10 10 14 15',
  line(13, 13, 18, 17),
);
draw(
  'cough-face',
  'M 9 2 C 0 1 0 15 6 18 H 11 V 12 L 15 11 L 12 7 V 5 Q 12 2 9 2 Z',
  line(14, 13, 18, 13),
  line(14, 16, 17, 18),
  circle(7, 7, 0.6),
);
draw(
  'nausea-face',
  circle(10, 10, 8),
  line(5, 7, 8, 8),
  line(12, 8, 15, 7),
  'M 5 14 Q 8 10 10 14 Q 12 18 15 14',
);
draw(
  'fever-face',
  circle(9, 9, 7),
  line(5, 7, 7, 7),
  line(10, 7, 12, 7),
  'M 6 13 Q 9 10 12 13',
  line(16, 8, 16, 15),
  circle(16, 17, 2),
);
draw(
  'pain-burst',
  line(10, 2, 10, 6),
  line(10, 14, 10, 18),
  line(2, 10, 6, 10),
  line(14, 10, 18, 10),
  line(4, 4, 7, 7),
  line(13, 13, 16, 16),
  line(4, 16, 7, 13),
  line(13, 7, 16, 4),
);
draw(
  'social-distance',
  circle(4, 4, 2),
  circle(16, 4, 2),
  line(2, 13, 2, 9, 6, 9, 6, 13),
  line(14, 13, 14, 9, 18, 9, 18, 13),
  line(3, 17, 17, 17),
  line(6, 15, 3, 17, 6, 19),
  line(14, 15, 17, 17, 14, 19),
);
draw(
  'body-measure',
  circle(10, 4, 2),
  line(6, 8, 14, 8, 16, 13),
  line(4, 13, 6, 8),
  line(7, 8, 7, 18),
  line(13, 8, 13, 18),
  line(4, 13, 16, 13),
  line(4, 11, 4, 15),
  line(16, 11, 16, 15),
);
draw(
  'treatment-patch',
  rect(2, 2, 16, 16, 3),
  rect(5, 5, 10, 10, 2),
  line(7, 10, 13, 10),
  line(10, 7, 10, 13),
);
draw('ribbon-badge', 'M 6 9 C 1 1 19 1 14 9 L 6 18 L 3 15 L 11 6 L 18 15 L 15 18 Z');
draw(
  'dental-implant',
  'M 3 5 C 3 0 9 1 10 3 C 11 1 17 0 17 5 L 15 10 H 5 Z',
  line(7, 10, 8, 18, 12, 18, 13, 10),
  line(8, 12, 12, 13),
  line(8, 15, 12, 16),
);
draw(
  'heart-monitor',
  rect(2, 2, 16, 12, 1),
  line(8, 14, 8, 18),
  line(12, 14, 12, 18),
  line(5, 18, 15, 18),
  line(4, 8, 7, 8, 9, 4, 12, 11, 14, 7, 16, 7),
);
draw(
  'mortar',
  'M 2 8 H 16 Q 16 17 9 17 Q 2 17 2 8 Z M 5 18 H 13',
  polygon(9, 8, 14, 2, 17, 4, 13, 8),
);
draw(
  'medicines',
  rect(2, 4, 8, 13, 1),
  rect(3, 2, 6, 3, 0.3),
  rect(11, 8, 6, 10, 3),
  line(11, 13, 17, 13),
  line(4, 9, 8, 9),
  line(6, 7, 6, 11),
);
draw(
  'outpatient',
  circle(6, 4, 2),
  line(3, 15, 3, 10, 9, 10, 9, 15),
  line(12, 2, 18, 2, 18, 18, 12, 18),
  line(10, 8, 16, 8),
  line(13, 5, 16, 8, 13, 11),
);
draw(
  'admission',
  rect(2, 2, 11, 16, 1),
  line(7, 6, 7, 12),
  line(4, 9, 10, 9),
  line(13, 15, 19, 15),
  line(16, 12, 19, 15, 16, 18),
);
draw(
  'discharge',
  rect(2, 2, 11, 16, 1),
  line(5, 7, 10, 7),
  line(5, 11, 9, 11),
  line(12, 15, 19, 15),
  line(16, 12, 19, 15, 16, 18),
);
draw(
  'field-hospital',
  polygon(2, 17, 2, 10, 10, 2, 18, 10, 18, 17),
  line(8, 17, 8, 12, 12, 12, 12, 17),
  line(8, 8, 12, 8),
  line(10, 6, 10, 10),
);
draw(
  'rural-clinic',
  polygon(3, 17, 3, 9, 10, 3, 17, 9, 17, 17),
  line(6, 17, 14, 17),
  line(7, 10, 13, 10),
  line(10, 7, 10, 13),
  line(2, 5, 4, 5),
  line(16, 4, 18, 4),
);
draw(
  'rural-clinic-alt',
  rect(3, 7, 14, 11, 0.5),
  polygon(1.5, 7, 10, 2, 18.5, 7),
  line(7, 12, 13, 12),
  line(10, 9, 10, 15),
);
draw(
  'health-ministry',
  polygon(2, 6, 10, 2, 18, 6),
  line(3, 8, 3, 17),
  line(17, 8, 17, 17),
  line(2, 18, 18, 18),
  line(7, 11, 13, 11),
  line(10, 8, 10, 14),
);
draw(
  'injury',
  circle(10, 4, 2),
  'M 3 18 V 13 Q 3 9 8 9 L 14 14 L 17 11',
  polygon(5, 12, 14, 12, 11, 17, 8, 17),
);
draw(
  'geriatric-care',
  circle(9, 3, 1.8),
  line(9, 6, 7, 10, 10, 13, 8, 18),
  line(7, 10, 4, 16),
  line(10, 7, 15, 9, 16, 18),
  line(14, 18, 18, 18),
);
draw(
  'family-care',
  circle(5, 5, 2),
  circle(15, 5, 2),
  circle(10, 11, 1.5),
  'M 1.5 17 V 13 Q 1.5 8 7 10 M 18.5 17 V 13 Q 18.5 8 13 10 M 7 18 V 16 Q 7 13 13 16 V 18',
  line(9, 3, 11, 3),
  line(10, 2, 10, 4),
);
draw(
  'delivery',
  'M 3 3 Q 3 8 7 11 Q 5 14 6 18 M 17 3 Q 17 8 13 11 Q 15 14 14 18',
  circle(10, 11, 2),
  line(9, 14, 8, 18),
  line(11, 14, 12, 18),
);
draw(
  'ent',
  'M 2 7 C 1 0 9 0 8 7 Q 8 11 5 12',
  'M 12 2 L 10 8 Q 13 10 15 8',
  'M 7 15 Q 12 11 17 15 Q 12 20 7 15 Z',
);
draw(
  'pregnant-person',
  circle(9, 3, 1.8),
  'M 7 6 Q 3 10 5 18 H 15 Q 20 11 12 8 L 11 6 M 8 9 Q 10 13 16 13',
);
draw(
  'breastfeeding',
  circle(8, 3, 1.8),
  circle(14, 10, 1.5),
  'M 6 6 Q 1 14 5 18 H 17 M 8 8 Q 7 14 15 14 Q 18 14 17 17',
  line(6, 14, 14, 11),
);
draw(
  'arm-measure',
  'M 2 15 L 6 4 H 9 L 8 10 L 14 11 L 16 8 L 18 9 L 17 17 H 8 Z',
  line(9, 10, 8, 15),
  line(11, 11, 10, 16),
  line(12, 13, 15, 13),
);
draw(
  'head-measure',
  circle(10, 10, 7),
  line(2, 9, 18, 9),
  line(4, 7, 4, 11),
  line(16, 7, 16, 11),
  line(7, 12, 8, 12),
  line(12, 12, 13, 12),
);
draw(
  'medical-library',
  rect(2, 2, 16, 16, 1),
  line(6, 2, 6, 18),
  line(9, 9, 15, 9),
  line(12, 6, 12, 12),
);
draw(
  'biopsy',
  rect(2, 10, 16, 8, 1),
  line(2, 13, 18, 13),
  line(13, 2, 8, 10),
  line(11, 1.5, 15, 4),
  line(7, 12, 11, 12),
);
draw(
  'skin-lesion',
  rect(2, 3, 16, 14, 3),
  circle(10, 10, 3),
  circle(8, 8, 0.5),
  circle(12, 9, 0.5),
  circle(10, 12, 0.5),
);
draw(
  'shoulder-profile',
  circle(10, 4, 2.5),
  'M 3 18 V 14 Q 3 9 10 9 Q 17 9 17 14 V 18',
  line(10, 10, 10, 17),
);
draw(
  'vomiting-face',
  'M 10 2 C 1 -1 -1 15 7 18 V 12 L 13 11 L 11 7 Q 14 3 10 2 Z',
  line(13, 12, 16, 15, 14, 18),
  line(16, 11, 19, 14, 18, 18),
  line(6, 7, 8, 7),
);
draw(
  'sweating-face',
  circle(9, 10, 7),
  circle(6, 8, 0.5),
  circle(11, 8, 0.5),
  'M 6 14 Q 9 11 12 14 M 17 2 C 12 7 21 8 17 2 Z',
);
draw(
  'measles-face',
  circle(10, 10, 8),
  circle(7, 8, 0.5),
  circle(13, 8, 0.5),
  line(8, 14, 12, 14),
  circle(5, 12, 0.4),
  circle(15, 12, 0.4),
  circle(10, 5, 0.4),
);
draw(
  'bandaged-face',
  circle(10, 10, 8),
  polygon(3, 7, 15, 3, 17, 7, 5, 11),
  line(8, 14, 12, 14),
  circle(13, 10, 0.5),
);
draw(
  'masked-face',
  circle(10, 10, 8),
  circle(7, 7, 0.5),
  circle(13, 7, 0.5),
  polygon(4, 10, 16, 10, 14, 15, 6, 15),
  line(7, 12, 13, 12),
);
draw(
  'lungs-infection',
  'M 8 4 C 3 -1 0 14 3 17 Q 5 19 8 15 Z M 12 4 C 17 -1 20 14 17 17 Q 15 19 12 15 Z',
  line(10, 2, 10, 8, 6, 11),
  line(10, 8, 14, 11),
  circle(15, 13, 1.5),
);
draw(
  'body-weight',
  circle(10, 3, 1.5),
  'M 7 6 Q 0 11 5 17 H 15 Q 20 11 13 6 M 7 17 V 19 M 13 17 V 19',
  line(8, 9, 12, 9),
);
draw(
  'dental-fracture',
  'M 3 6 C 2 0 8 1 10 3 C 12 1 18 0 17 6 L 14 18 L 10 14 L 6 18 Z',
  line(11, 5, 8, 9, 12, 10, 9, 13),
);
draw(
  'bone-fracture',
  'M 7 6 C 9 2 3 -1 2 3 C -2 4 2 10 5 8 L 8 11 M 12 9 L 15 12 C 18 10 22 16 18 17 C 17 21 11 18 13 15 L 10 12',
  line(9, 5, 8, 8, 12, 8, 11, 11),
);
draw(
  'pet-scanner',
  rect(2, 2, 16, 16, 2),
  circle(10, 9, 5),
  circle(10, 9, 2),
  rect(7, 11, 6, 7, 0.5),
);
draw(
  'study-image',
  rect(2, 2, 16, 16, 1),
  line(5, 5, 8, 5),
  line(6, 8, 6, 14),
  'M 8 14 Q 10 7 14 14',
  circle(13, 6, 1),
);
draw(
  'mpr-planes',
  polygon(2, 5, 11, 2, 18, 6, 9, 9),
  polygon(9, 9, 18, 6, 18, 15, 9, 18),
  polygon(2, 5, 9, 9, 9, 18, 2, 14),
);
draw(
  'cobb-angle',
  line(3, 3, 16, 6),
  line(3, 16, 16, 12),
  line(6, 4, 12, 14),
  'M 6 11 A 6 6 0 0 0 13 8',
);
draw(
  'study-hanging-protocol',
  rect(2, 2, 16, 16, 1),
  line(2, 7, 18, 7),
  line(10, 7, 10, 18),
  line(5, 4, 7, 4),
  line(5, 11, 7, 14),
  line(13, 11, 16, 14),
);
draw(
  'stress-breath',
  line(2, 10, 5, 10, 7, 5, 10, 15, 13, 5, 15, 10, 18, 10),
  line(3, 3, 6, 3),
  line(14, 17, 17, 17),
);
draw(
  'colonic-curve',
  'M 3 18 V 6 Q 3 2 6 3 Q 10 1 14 3 Q 18 2 18 6 V 12 Q 18 17 13 14 V 8 Q 10 6 9 9 V 18',
  circle(6, 6, 0.5),
  circle(15, 6, 0.5),
  circle(15, 12, 0.5),
);
draw(
  'vessel-curve',
  line(9, 2, 9, 9, 3, 17),
  line(13, 2, 13, 10, 18, 17),
  line(11, 2, 11, 10, 6, 18),
  line(11, 10, 16, 18),
);
draw(
  'bat',
  'M 2 4 Q 7 9 8 5 L 9 2 L 10 4 L 11 2 L 12 5 Q 13 9 18 4 L 17 13 Q 14 10 12 14 L 10 18 L 8 14 Q 6 10 3 13 Z',
);
draw(
  'mouse',
  'M 2 14 C 2 6 14 6 15 12 L 18 14 L 15 16 H 6 Q 1 19 1 15',
  circle(9, 7, 3),
  circle(13, 12, 0.5),
);
draw(
  'chair',
  rect(4, 2, 12, 9, 2),
  rect(3, 11, 14, 4, 1),
  line(5, 15, 5, 18),
  line(15, 15, 15, 18),
);
draw(
  'handshake',
  polygon(2, 7, 6, 4, 10, 6, 13, 4, 18, 8, 15, 13, 12, 16, 9, 15, 6, 12),
  line(6, 4, 2, 9),
  line(10, 6, 7, 9, 9, 11, 12, 9, 16, 12),
);
draw(
  'infrared-thermometer',
  polygon(3, 3, 17, 3, 17, 9, 10, 9, 9, 18, 4, 18, 6, 9, 3, 9),
  rect(5, 5, 6, 2, 0.2),
  line(18, 4, 19, 4),
  line(18, 7, 19, 7),
);
draw(
  'snowflake',
  line(10, 2, 10, 18),
  line(3, 6, 17, 14),
  line(3, 14, 17, 6),
  line(7, 3, 10, 5, 13, 3),
  line(7, 17, 10, 15, 13, 17),
);
draw(
  'penis-alt',
  'M 3 14 L 7 10 L 11 3 C 13 -1 19 3 16 7 L 12 13 Q 15 17 11 18 Q 8 20 7 16 L 5 18 Z',
  line(12, 3, 16, 6),
);
draw(
  'patient-band-alt',
  rect(2, 5, 16, 10, 4),
  rect(7, 5, 6, 10, 0.5),
  line(8, 8, 12, 8),
  line(8, 11, 12, 11),
  line(4, 10, 4.1, 10),
  line(16, 10, 16.1, 10),
);
draw(
  'pulse-oximeter-alt',
  rect(3, 3, 12, 10, 3),
  rect(5, 5, 6, 4, 0.5),
  'M 7 13 V 16 Q 13 21 17 15 V 8 Q 17 5 15 6',
  line(7, 7, 9, 7),
);
draw(
  'blood-pressure-2',
  rect(2, 7, 10, 10, 2),
  rect(4, 9, 6, 4, 0.5),
  line(5, 15, 9, 15),
  'M 12 10 C 19 15 19 2 15 3',
  rect(12, 2, 6, 4, 1),
);
draw(
  'social-distance-alt',
  circle(4, 4, 2),
  circle(16, 4, 2),
  'M 1.5 15 V 10 Q 1.5 7 6.5 10 V 15 M 13.5 15 V 10 Q 13.5 7 18.5 10 V 15',
  line(7, 11, 13, 11),
  line(8, 9, 6, 11, 8, 13),
  line(12, 9, 14, 11, 12, 13),
  line(3, 15, 3, 18),
  line(5, 15, 5, 18),
  line(15, 15, 15, 18),
  line(17, 15, 17, 18),
);

export function virus(variant = 1) {
  let d = circle(10, 10, 4.8);
  const n = variant === 2 ? 6 : variant === 3 ? 10 : 8;
  for (let i = 0; i < n; i++) {
    const a = (i * 2 * Math.PI) / n,
      cs = Math.cos(a),
      sn = Math.sin(a);
    d += line(10 + 5 * cs, 10 + 5 * sn, 10 + 8 * cs, 10 + 8 * sn);
    d += line(
      10 + 8 * cs - 1.2 * sn,
      10 + 8 * sn + 1.2 * cs,
      10 + 8 * cs + 1.2 * sn,
      10 + 8 * sn - 1.2 * cs,
    );
  }
  d += circle(8, 8, 0.6) + circle(12, 11, 0.7);
  return art(variant === 1 ? 'virus' : `virus-${variant}`, path(d), 'Infection & public health');
}
const numbered = (n) => Number(n.match(/(?:-|^)([1-6])$/)?.[1] || 1);
function bloodType(s) {
  const m = s.match(/^blood-(a|ab|b|o|rh)-([np])$/);
  if (!m) return null;
  const label = m[1].toUpperCase();
  const bag = path(
    rect(2, 3, 12, 13, 2) + line(5, 1.5, 11, 1.5) + line(5, 16, 5, 18) + line(11, 16, 11, 18),
  );
  return art(
    `blood-type-${m[1]}-${m[2] === 'p' ? 'positive' : 'negative'}`,
    bag +
      lettering(label, 1, 6, 7) +
      path(line(16, 13, 19, 13) + (m[2] === 'p' ? line(17.5, 11.5, 17.5, 14.5) : '')),
    'Blood & transfusion',
  );
}
function blister(s) {
  const oval = s.includes('oval'),
    count = Number(s.match(/x(\d+)/)?.[1] || 4);
  let d = rect(2, 2, 16, 16, 2);
  if (count > 4) {
    d += oval ? rect(7, 4, 6, 3, 1.5) : circle(10, 6, 1.8);
    return art(
      `blister-${oval ? 'oval' : 'round'}-${count}`,
      path(d) + lettering(String(count), 3, 10, 6),
      'Medicines & treatment',
    );
  }
  const cols = count === 1 ? 1 : 2,
    rows = count === 1 ? 1 : 2;
  for (let k = 0; k < count; k++) {
    const x = count === 1 ? 10 : 6 + (k % cols) * 8,
      y = count === 1 ? 10 : 6 + Math.floor(k / cols) * 8;
    d += oval ? rect(x - 2, y - 2.5, 4, 5, 2) : circle(x, y, 2);
  }
  return art(`blister-${oval ? 'oval' : 'round'}-${count}`, path(d), 'Medicines & treatment');
}
function testResult(s) {
  const rectangle = s.includes('rectangular'),
    invalid = s.includes('invalid'),
    kind = s.includes('out-stock')
      ? 'out-of-stock'
      : s.includes('no-test')
        ? 'not-tested'
        : s.includes('mixed')
          ? 'mixed'
          : s.includes('neg')
            ? 'negative'
            : s.includes('positive')
              ? 'positive'
              : s.includes('-pf')
                ? 'pf'
                : s.includes('-pv')
                  ? 'pv'
                  : 'result';
  const shape = rectangle ? rect(2, 5, 16, 10, 1) : rect(3, 2, 14, 16, 3);
  let body = path(shape);
  body += lettering(
    kind === 'pf'
      ? 'PF'
      : kind === 'pv'
        ? 'PV'
        : kind === 'mixed'
          ? 'M'
          : kind === 'negative'
            ? '-'
            : kind === 'positive'
              ? '+'
              : kind === 'not-tested'
                ? '?'
                : 'T',
    3,
    rectangle ? 7 : 6,
    rectangle ? 5 : 6,
  );
  let g = art(`rapid-test-${kind}${rectangle ? '-rectangular' : ''}`, body, 'Diagnostics & tests');
  if (invalid) g = status(g.key + '-invalid', g, 'x');
  if (kind === 'out-of-stock') g = slash(g);
  return g;
}

const synonyms = {
  antibody: 'antibody',
  anus: 'anus',
  bacteria: 'bacteria',
  bladder: 'bladder',
  'blood-cells': 'blood-cells',
  'blood-vessel': 'blood-vessel',
  breasts: 'breasts',
  'cell-nuclei': 'cell',
  colon: 'colon',
  dna: 'dna',
  enzyme: 'enzyme',
  'female-reproductive-system': 'uterus',
  gallbladder: 'gallbladder',
  'heart-organ': 'heart-organ',
  intestine: 'intestine',
  joints: 'joints',
  kidneys: 'kidney',
  kidney: 'kidney',
  liver: 'liver',
  'liver-alt': 'liver-alt',
  lungs: 'lungs',
  'lymph-nodes': 'lymph-nodes',
  nerve: 'nerve',
  neurology: 'brain',
  pancreas: 'pancreas',
  penis: 'penis',
  'penis-alt': 'penis',
  prostate: 'prostate',
  skeleton: 'skeleton',
  spine: 'spine',
  spleen: 'spleen',
  stomach: 'stomach',
  testicles: 'testicles',
  thyroid: 'thyroid',
  tissue: 'tissue',
  tooth: 'tooth',
  tumour: 'tumour',
  vagina: 'vagina',
  'vagina-alt': 'vulva',
  'asthma-inhaler': 'inhaler',
  'blood-pressure': 'blood-pressure',
  'blood-pressure-2': 'blood-pressure',
  'blood-pressure-monitor': 'blood-pressure',
  'breast-pump': 'breast-pump',
  cast: 'cast',
  'cochlear-implant': 'cochlear-implant',
  'contact-lenses': 'contact-lenses',
  'cpap-machine': 'cpap-machine',
  'cpap-masks': 'cpap-mask',
  'cpap-tubes': 'cpap-mask',
  defibrillator: 'defibrillator',
  'diabetes-measure': 'glucometer',
  dialysis: 'dialysis',
  ecmo: 'ecmo',
  'endotracheal-tube': 'endotracheal-tube',
  hospitalized: 'hospital-bed',
  inpatient: 'patient-in-bed',
  'infusion-pump': 'infusion-pump',
  'intravenous-bag': 'iv-bag',
  'intravenous-drip': 'iv-bag',
  laryngoscope: 'laryngoscope',
  llin: 'bed-net',
  'medical-sample': 'sample-container',
  'medicine-bottle': 'medication-bottle',
  'medicine-mortar': 'mortar',
  odontology: 'tooth',
  'odontology-implant': 'dental-implant',
  orthotics: 'orthotics',
  'oxygen-tank': 'oxygen-tank',
  'patient-band': 'patient-band',
  'patient-band-alt': 'patient-band',
  'ppe-santizer-alt': 'sanitizer',
  'pulse-oximeter': 'pulse-oximeter',
  'pulse-oximeter-alt': 'pulse-oximeter',
  sling: 'sling',
  sonogram: 'ultrasound',
  staples: 'staples',
  stent: 'stent',
  stethoscope: 'stethoscope',
  stitches: 'stitches',
  'surgical-sterilization': 'surgical-tools',
  syringe: 'syringe',
  'syringe-vaccine': 'vaccine',
  tac: 'ct-scanner',
  'ultrasound-scanner': 'ultrasound-device',
  'urine-sample': 'urine-sample',
  ventilator: 'ventilator',
  'ventilator-alt': 'ventilator',
  'virus-sanitizer-spray': 'sanitizer-spray',
  xray: 'x-ray',
  'face-bandaged': 'bandaged-face',
  'face-coughing': 'cough-face',
  'face-dizzy': 'dizzy-face',
  'face-expectorate': 'cough-face',
  'face-fever': 'fever-face',
  'face-masked': 'masked-face',
  'face-measles': 'measles-face',
  'face-nauseous': 'nausea-face',
  'face-sweating': 'sweating-face',
  'face-vomitting': 'vomiting-face',
  'face-woozy': 'dizzy-face',
  'bandage-adhesive': 'bandage',
  'prescription-document': 'prescription',
  'blood-bag': 'blood-bag',
  medicines: 'medicines',
  'pill-1': 'pill',
  'pills-2': 'pills-two',
  'pills-3': 'pills-three',
  'pills-4': 'pills-four',
  ancv: 'antenatal-visit',
  asthma: 'asthma',
  'child-cognition': 'child-cognition',
  'community-healthworker': 'community-worker',
  cpr: 'cpr',
  diabetes: 'glucometer',
  doctor: 'clinician',
  'doctor-female': 'female-clinician',
  'doctor-male': 'male-clinician',
  fetus: 'fetus',
  'health-worker': 'community-worker',
  'mental-disorders': 'mental-health',
  'neuro-surgery': 'neurosurgery',
  nurse: 'nurse',
  outpatient: 'outpatient',
  'pediatric-surgery': 'pediatric-surgery',
  pwid: 'injection-use',
  rmnh: 'maternal-newborn-care',
  'speech-language-therapy': 'speech-therapy',
  'surveilance-officer': 'surveillance-worker',
  symptom: 'fever-face',
  traumatism: 'injury',
  'ambulatory-clinic': 'clinic',
  'emergency-post': 'field-hospital',
  hospital: 'hospital',
  'ministry-of-health': 'health-ministry',
  'rural-post': 'rural-clinic',
  'rural-post-alt': 'rural-clinic-alt',
  'ppe-face-mask': 'masked-face',
  'ppe-gown': 'ppe-gown',
  'ppe-mask': 'mask',
  'ppe-mask-n95': 'n95-mask',
  'ppe-sanitizer': 'sanitizer',
  'ppe-suit': 'ppe-suit',
  'alternative-complementary': 'complementary-care',
  anesthesia: 'anesthesia',
  'care-staff-area': 'care-team',
  'cath-lab': 'stent',
  dental: 'tooth',
  dermatology: 'skin',
  'diabetes-education': 'diabetes-education',
  emergency: 'emergency',
  'family-practice': 'family-care',
  'first-aid': 'first-aid',
  genetics: 'dna',
  'health-education': 'health-literacy',
  'health-services': 'clinic',
  'imaging-alternative-ct': 'ct-scanner',
  'imaging-alternative-mri': 'mri-scanner',
  'imaging-alternative-mri-two': 'mri-scanner-alt',
  'imaging-alternative-pet': 'pet-scanner',
  'imaging-root-category': 'scan',
  immunizations: 'vaccine',
  'infectious-diseases': 'virus',
  'intensive-care': 'intensive-care',
  'internal-medicine': 'internal-medicine',
  'labor-delivery': 'delivery',
  laboratory: 'lab-flask',
  mammography: 'mammography',
  'medical-library': 'medical-library',
  'medical-records': 'medical-record',
  'mri-pet': 'pet-scanner',
  nursery: 'pediatrics',
  oncology: 'oncology',
  ophthalmology: 'eye',
  pathology: 'biopsy',
  pediatrics: 'pediatrics',
  pharmacy: 'medication-bottle',
  'physical-therapy': 'rehabilitation',
  radiology: 'x-ray',
  respiratory: 'lungs',
  surgery: 'surgical-tools',
  ultrasound: 'ultrasound',
  'womens-health': 'uterus',
  'icon-asclepius': 'asclepius',
  'icon-cross': 'emergency',
  'organ-heart': 'heart-organ',
  'organ-kidney': 'kidney',
  'organ-liver': 'liver',
  'organ-lung': 'lungs',
  'health-cross': 'emergency',
  coronavirus: 'virus',
  medication: 'medication-bottle',
  pills: 'pills-two',
  mammogram: 'mammography',
  'heart-pulse': 'heartbeat',
  'heart-rate-monitor': 'heart-monitor',
  'activity-heartbeat': 'heartbeat',
  'heart-flash': 'defibrillator',
  'briefcase-medical': 'medical-bag',
  'pill-bottle': 'medication-bottle',
  tablets: 'pills-two',
  germ: 'bacteria',
  'emergency-bed': 'hospital-bed',
  'first-aid-kit': 'first-aid',
  'face-mask': 'mask',
  'medicine-syrup': 'medication-bottle',
  physiotherapist: 'rehabilitation',
  'vaccine-bottle': 'vaccine',
  'checkup-list': 'medical-record',
  'account-injury': 'injury',
  allergy: 'allergy',
  'clipboard-pulse': 'record-heartbeat',
  'emoticon-sick': 'sick-face',
  'hospital-building': 'hospital',
  'hospital-box': 'hospital',
  'hospital-marker': 'hospital-location',
  'lotion-plus': 'sanitizer',
  'medical-cotton-swab': 'specimen-swab',
  'mortar-pestle-plus': 'mortar',
  needle: 'syringe',
  pulse: 'heartbeat',
  'radiology-box': 'x-ray',
  reproduction: 'uterus',
  'skull-scan': 'skull-scan',
  'truck-plus': 'ambulance',
  'scan-heart': 'scan-heart',
  'bone-fracture': 'bone-fracture',
};

const specialties = {
  'accident-and-emergency': 'emergency',
  admissions: 'admission',
  'biochemistry-laboratory': 'lab-flask',
  'burn-unit': 'burn',
  cardiology: 'heart-organ',
  'coronary-care-unit': 'heart-monitor',
  'critical-care': 'heart-monitor',
  'discharge-lounge': 'discharge',
  'ears-nose-and-throat': 'ent',
  endocrinology: 'thyroid',
  gastroenterology: 'stomach',
  'general-surgery': 'surgical-tools',
  geriatrics: 'geriatric-care',
  gynecology: 'uterus',
  hematology: 'blood-cells',
  'hematology-laboratory': 'blood-sample',
  hepatology: 'liver',
  'intensive-care-unit': 'heart-monitor',
  'medical-records': 'medical-record',
  nephrology: 'kidney',
  obstetricsmonia: 'fetus',
  'occupational-therapy': 'rehabilitation',
  oncology: 'cancer-ribbon',
  opthalmology: 'eye',
  orthopaedics: 'joints',
  'outpatient-department': 'outpatient',
  'pain-managment': 'pain-burst',
  pediatrics: 'pediatrics',
  'pharmacy-dept': 'medication-bottle',
  'physical-therapy': 'rehabilitation',
  psychology: 'mental-health',
  radiology: 'x-ray',
  respirology: 'lungs',
  rheumatology: 'joints',
  sonography: 'ultrasound',
  'speech-language-therapist': 'speech-therapy',
  urology: 'bladder',
  'vascular-surgery': 'blood-vessel',
};
function specialty(s) {
  const key = specialties[s];
  if (!key) return null;
  const g = base(key);
  if (!g) return null;
  return combine('department-' + s, base('clinic'), g);
}

export function resolveHealthcare(entry) {
  const s = normalized(entry.name.split('/').at(-1));
  const label = entry.display_name || s;
  const bt = bloodType(s);
  if (bt) return bt;
  if (s.startsWith('blister-pills-')) return blister(s);
  if (s.startsWith('rdt-result')) return testResult(s);
  if (entry.source_category === 'specialties') {
    const g = specialty(s);
    if (g) return g;
  }
  if (/^virus$|^virus-alt$|^covid19?-virus-[1234]$/.test(s))
    return virus(s.endsWith('alt') ? 2 : Math.min(3, numbered(s)));
  if (/^(?:organ-|icon-)/.test(s) && synonyms[s]) return base(synonyms[s]);
  if (s.endsWith('-off')) {
    const raw = s.slice(0, -4),
      g = resolveHealthcare({ ...entry, name: raw });
    return g ? slash(g) : null;
  }
  if (s === 'dna-2')
    return art(
      'dna-helix-alt',
      path(
        'M 4 2 C 18 2 2 18 16 18 M 16 2 C 2 2 18 18 4 18' +
          line(7, 4, 13, 4) +
          line(8, 8, 12, 8) +
          line(8, 12, 12, 12) +
          line(7, 16, 13, 16),
      ),
      'Clinical anatomy',
    );
  if (H.has(s)) return H.get(s);
  if (get(s)) return get(s);
  if (synonyms[s]) {
    const g = base(synonyms[s]);
    if (g) return g;
  }
  return resolveClinicalFamily(s, entry);
}

function resolveClinicalFamily(s, entry) {
  if (s === 'virus') return virus();
  if (/-cancer$/.test(s) || s === 'lymphoma' || s === 'cancerous-cell-nuclei') {
    const subject =
      s === 'lymphoma'
        ? 'lymph-nodes'
        : s === 'cancerous-cell-nuclei'
          ? 'cell'
          : {
              'cervical-cancer': 'uterus',
              'colorectal-cancer': 'colon',
              'pancreatic-cancer': 'pancreas',
              'skin-cancer': 'skin',
              'disease-cancer': 'person',
            }[s] || s.replace(/-cancer$/, '');
    const g = base(subject);
    return combine(s, g, base('cancer-ribbon'));
  }
  const condition = {
    allergies: ['measles-face', 'pain-burst'],
    'autoimmune-disease': ['cell', 'antibody'],
    'back-pain': ['spine', 'pain-burst'],
    burn: ['skin', 'flame'],
    'chemical-burn': ['skin', 'beaker'],
    chills: ['sick-face', 'snowflake'],
    'chills-fever': ['fever-face', 'thermometer'],
    'coughing-alt': ['cough-face', 'lungs'],
    diarrhea: ['intestine', 'blood-drop'],
    'dry-eyes': ['eye', 'sun'],
    'dry-mouth': ['mouth', 'sun'],
    headache: ['brain', 'pain-burst'],
    'intestinal-pain': ['intestine', 'pain-burst'],
    'loss-smell': ['nose', 'close'],
    malnutrition: ['body-weight', 'nutrition'],
    nausea: ['nausea-face', 'stomach'],
    overweight: ['body-weight', 'plus'],
    pain: ['shoulder-profile', 'pain-burst'],
    pneumonia: ['lungs-infection', 'bacteria'],
    sweating: ['sweating-face', 'blood-drop'],
    tb: ['lungs', 'bacteria'],
    underweight: ['body-weight', 'minus'],
    'viral-lung-infection': ['lungs', 'virus'],
    vomiting: ['vomiting-face', 'stomach'],
    asthma: ['lungs', 'inhaler'],
    'bone-fracture': ['bone-fracture', 'pain-burst'],
  };
  if (condition[s]) return combine(s, base(condition[s][0]), base(condition[s][1]));
  if (
    [
      'chlamydia',
      'chlamydia-alt',
      'gonorrhea',
      'gonorrhea-alt',
      'hpv',
      'sti',
      'syphilis-alt',
      'vih',
      'vih-1',
      'hiv-ind',
      'hiv-neg',
      'hiv-pos',
      'cholera',
    ].includes(s)
  ) {
    const symbol =
      s.includes('hiv') || s.startsWith('vih')
        ? base('cancer-ribbon')
        : s === 'cholera'
          ? base('intestine')
          : base('uterus');
    const tag = s.includes('chlamydia')
      ? 'C'
      : s.includes('gonorrhea')
        ? 'G'
        : s.includes('syphilis')
          ? 'S'
          : s === 'hpv'
            ? 'HPV'
            : s === 'cholera'
              ? 'C'
              : 'HIV';
    let g = combine('condition-' + s, symbol, textGlyph(tag));
    if (/-ind$|-neg$|-pos$/.test(s))
      g = status(g.key, g, s.endsWith('ind') ? 'warning' : s.endsWith('pos') ? 'plus' : 'minus');
    return g;
  }
  if (s.startsWith('contraceptive-')) {
    const name = s.slice(14),
      g = base(
        {
          diaphragm: 'diaphragm',
          injection: 'syringe',
          patch: 'treatment-patch',
          voucher: 'medical-record',
        }[name],
      );
    return g ? art(s, g.body, 'Reproductive care') : null;
  }
  if (s === 'male-condom') return base('condom');
  if (s === 'family-planning') return combine(s, base('family-care'), base('iud'));
  if (/^oral-contraception-pillsx(21|28)$/.test(s)) {
    const n = Number(s.match(/\d+/)[0]);
    return art(
      'contraceptive-pill-pack-' + n,
      path(rect(2, 2, 16, 16, 2) + circle(6, 5, 1.3) + circle(14, 5, 1.3)) +
        lettering(String(n), 3, 9, 7),
      'Reproductive care',
    );
  }
  if (s === 'sayana-press')
    return art(
      'contraceptive-injection-device',
      path(
        rect(6, 7, 8, 8, 3) +
          line(10, 7, 10, 2) +
          line(8, 2, 12, 2) +
          line(10, 15, 10, 18) +
          line(6, 11, 14, 11),
      ),
      'Reproductive care',
    );
  if (s === 'observation') return status('bed-observation', base('hospital-bed'), 'clock');
  if (/^pregnant-(0812w|2426w|32w|3638w)$/.test(s)) {
    const stage = s.slice(9),
      scale = stage === '0812w' ? 0.48 : stage === '2426w' ? 0.62 : stage === '32w' ? 0.76 : 0.88;
    return art(
      'gestation-' + stage,
      path(circle(10, 10, 8)) +
        transform(
          path(circle(10, 6, 2.5) + 'M 11 9 C 18 11 12 20 6 14 L 5 11 L 9 12'),
          10 - 10 * scale,
          10 - 10 * scale,
          scale,
        ),
      'Reproductive care',
    );
  }
  if (/^(?:chart|graph)-(cured|death-rate|infected)-(decreasing|increasing|stable)$/.test(s)) {
    const m = s.match(
        /^(?:chart|graph)-(cured|death-rate|infected)-(decreasing|increasing|stable)$/,
      ),
      subject = m[1],
      trend = m[2];
    const body = path(
      line(2, 2, 2, 18, 18, 18) +
        (trend === 'stable'
          ? line(4, 11, 8, 11, 12, 11, 17, 11)
          : trend === 'decreasing'
            ? line(4, 5, 8, 9, 12, 8, 17, 14)
            : line(4, 14, 8, 10, 12, 11, 17, 5)),
    );
    return combine(
      'clinical-chart-' + subject + '-' + trend,
      art('trend', body),
      base(subject === 'cured' ? 'check' : subject === 'infected' ? 'virus' : 'skull'),
    );
  }
  if (/^malaria-(?:mixed-|pf-|pv-)?microscope$/.test(s)) {
    const type = s.includes('mixed')
      ? 'mixed'
      : s.includes('-pf')
        ? 'pf'
        : s.includes('-pv')
          ? 'pv'
          : 'negative';
    return combine(
      'malaria-microscopy-' + type,
      base('microscope'),
      type === 'negative' ? base('minus') : textGlyph(type === 'mixed' ? 'M' : type.toUpperCase()),
    );
  }
  if (s === 'malaria-testing') return combine(s, base('test-tube'), base('mosquito'));
  if (s === 'hiv-self-test')
    return combine(s, base('rapid-test') || testResult('rdt-result'), base('cancer-ribbon'));
  if (s === 'mosquito-collection') return combine(s, base('sample-container'), base('mosquito'));
  if (/^cone-test-on-(nets|walls)$/.test(s)) {
    const wall = s.endsWith('walls');
    const body = path(
      (wall
        ? rect(2, 2, 16, 16, 0.4)
        : rect(2, 2, 16, 16, 0.4) +
          line(2, 7, 18, 7) +
          line(2, 12, 18, 12) +
          line(7, 2, 7, 18) +
          line(12, 2, 12, 18)) + polygon(5, 15, 10, 5, 15, 15),
    );
    return art(s, body, 'Diagnostics & tests');
  }
  if (/bioassays$/.test(s)) {
    const intensity = s.startsWith('intensity'),
      synergy = s.startsWith('synergist');
    const g = base('test-tube');
    return combine(
      'bioassay-' + (intensity ? 'intensity' : synergy ? 'synergist' : 'discriminating'),
      g,
      synergy ? base('plus') : intensity ? repeated(base('blood-drop')) : base('blood-drop'),
    );
  }
  const concepts = {
    'antenatal-visit': ['pregnant-person', 'calendar'],
    'child-cognition': ['pediatrics', 'brain'],
    neurosurgery: ['brain', 'surgical-tools'],
    'pediatric-surgery': ['pediatrics', 'surgical-tools'],
    'injection-use': ['person', 'syringe'],
    'maternal-newborn-care': ['maternity', 'pediatrics'],
    'surveillance-worker': ['community-worker', 'search'],
    'blood-sample': ['test-tube', 'blood-drop'],
    'blood-transfusion': ['blood-bag', 'person'],
    'body-mass-index': ['body-measure', 'weight-scale'],
    'arm-circumference': ['arm-measure', 'dimension'],
    'head-circumference': ['head-measure', 'dimension'],
    'waist-circumference': ['body-measure', 'dimension'],
    'bio-pharma': ['dna', 'pill'],
    biomarker: ['blood-drop', 'search'],
    'breeding-sites': ['mosquito', 'blood-drop'],
    'calendar-quarantine': ['calendar', 'virus'],
    cardiogram: ['heart-monitor', 'heart'],
    'cardiogram-e': ['heart-monitor', 'pencil'],
    'clinical-f': ['file', 'emergency'],
    'clinical-fe': ['medical-record', 'pencil'],
    'diabetes-blood-sample': ['blood-sample', 'glucometer'],
    diagnostics: ['clipboard', 'search'],
    'ear-nose-throat': ['ent', 'clinic'],
    'global-pandemic': ['globe', 'virus'],
    health: ['shield-health', 'check'],
    'health-alt': ['heart', 'emergency'],
    'health-data-security': ['medical-record', 'lock'],
    'health-data-sync': ['medical-record', 'recurrence'],
    'health-literacy': ['book', 'emergency'],
    'health-vulnerability-through-social-determinants': ['family-care', 'heart'],
    'healthcare-it': ['monitor', 'emergency'],
    'heart-cardiogram': ['heart-monitor', 'heart'],
    'home-quarantine': ['home', 'virus'],
    hospice: ['home-care', 'heart'],
    'hospital-symbol': ['hospital', 'emergency'],
    'insecticide-resistance': ['mosquito', 'shield'],
    lactation: ['breastfeeding', 'blood-drop'],
    'medical-advice': ['phone', 'emergency'],
    'medical-search': ['search', 'emergency'],
    'palliative-care': ['heart', 'hand'],
    referral: ['medical-record', 'direction-arrow-right'],
    'resilient-and-migration-sensitive-health-system': ['shield-health', 'people'],
    telemedicine: ['telehealth', 'heartbeat'],
    'virus-patient': ['person', 'virus'],
    'virus-research': ['microscope', 'virus'],
    'virus-research-alt': ['test-tube', 'virus'],
    'virus-shield': ['shield', 'virus'],
    'social-distancing': ['social-distance', 'check'],
    'social-distancing-alt': ['social-distance', 'shield'],
    'complementary-care': ['leaf', 'heart'],
    'diabetes-education': ['book', 'glucometer'],
    'intensive-care': ['hospital-bed', 'heart-monitor'],
    'internal-medicine': ['shoulder-profile', 'heart-organ'],
    'medical-library': ['book', 'emergency'],
    oncology: ['clinic', 'cancer-ribbon'],
    'hospital-location': ['map-pin', 'emergency'],
    'record-heartbeat': ['medical-record', 'heartbeat'],
    'skull-scan': ['scan', 'skull'],
    'scan-heart': ['scan', 'heart-organ'],
    'mri-scanner-alt': ['mri-scanner', 'mpr-planes'],
  };
  if (concepts[s]) return combine(s, base(concepts[s][0]), base(concepts[s][1]));
  if (s === 'pills-two' || s === 'pills-three' || s === 'pills-four') {
    const n = s === 'pills-two' ? 2 : s === 'pills-three' ? 3 : 4;
    let body = '';
    for (let k = 0; k < n; k++)
      body += transform(base('pill').body, (k % 2) * 9, Math.floor(k / 2) * 9, 0.48);
    return art(s, body, 'Medicines & treatment');
  }
  if (s === 'healthcare-generic' || s === 'healthcare-generic-2')
    return s.endsWith('2') ? base('clinic') : base('emergency');
  if (s === 'rx') return base('prescription');
  if (s === 'pharmacy' || s === 'pharmacy-alt')
    return s.endsWith('alt') ? base('medicines') : base('medication-bottle');
  if (/^(?:icd(?:-9|-10|-11)?|imm|loinc)$/.test(s))
    return art(
      'clinical-code-' + s,
      path(rect(2, 2, 16, 16, 2)) +
        lettering(
          s === 'icd-9'
            ? '9'
            : s === 'icd-10'
              ? '10'
              : s === 'icd-11'
                ? '11'
                : s === 'icd'
                  ? 'I'
                  : s === 'imm'
                    ? 'IM'
                    : 'LN',
          3,
          6,
          8,
        ),
      'Records & health informatics',
    );
  if (entry.is_brand_or_standard_identity || /^(dhis2|fhir|hl7v2|open-mrs|simple)-logo$/.test(s)) {
    const title = s.replace(/-logo$/, '').replace('open-mrs', 'MRS');
    return art(
      'health-standard-' + title,
      path(rect(2, 2, 16, 16, 2)) +
        lettering(
          { dhis2: 'D2', fhir: 'FH', hl7v2: 'H7', MRS: 'MR', simple: 'S' }[title] ||
            title.slice(0, 2).toUpperCase(),
          3,
          6,
          8,
        ),
      'Health informatics',
    );
  }
  if (s === 'hospital-circle') return enclosure(base('hospital'));
  if (s === 'blood-pressure-monitor-alt') return status(s, base('blood-pressure'), 'check');
  if (s === 'pill-multiple') return repeated(base('pill'));
  const suffix = s.match(
    /^(medication|pills|vaccine-bottle|vaccine|stethoscope|hospital|bandage|first-aid-kit|needle|virus)-(alert|reminder|add|subtract|search)$/,
  );
  if (suffix) {
    const g = resolveHealthcare({ ...entry, name: suffix[1] });
    return g
      ? status(
          s,
          g,
          { alert: 'warning', reminder: 'clock', add: 'plus', subtract: 'minus', search: 'search' }[
            suffix[2]
          ],
        )
      : null;
  }
  return resolveWorkflow(s, entry);
}

function resolveWorkflow(s, entry) {
  if (specialties[s]) return specialty(s);
  const work = {
    outbreak: ['globe', 'virus'],
    'virus-mutation': ['virus-2', 'dna'],
    'mobile-clinic': ['ambulance', 'clinic'],
    'anc-danger-sign': ['pregnant-person', 'warning'],
    'pnc-danger-sign': ['maternal-newborn-care', 'warning'],
    'iccm-danger-sign': ['pediatrics', 'warning'],
    'child-growth': ['pediatrics', 'chart-line'],
    'child-nutrition': ['pediatrics', 'nutrition'],
    'condition-cough': ['cough-face', 'medical-record'],
    'condition-diarrhea': ['intestine', 'medical-record'],
    'condition-fever': ['fever-face', 'medical-record'],
    'death-coffin-maternal': ['coffin', 'maternity'],
    'death-coffin-neonatal': ['coffin', 'pediatrics'],
    'disease-cancer': ['person', 'cancer-ribbon'],
    'disease-cardiovascular': ['heart-organ', 'warning'],
    'disease-diabetes': ['glucometer', 'blood-drop'],
    'disease-hiv-aids': ['cancer-ribbon', 'virus'],
    'disease-malaria': ['mosquito', 'blood-drop'],
    'disease-malaria-net': ['bed-net', 'mosquito'],
    'disease-outbreak': ['people', 'virus'],
    'disease-pneumonia': ['lungs-infection', 'medical-record'],
    'disease-respiratory': ['lungs', 'medical-record'],
    'followup-general': ['medical-record', 'clock'],
    'healthcare-assessment': ['medical-record', 'check'],
    'healthcare-diagnosis': ['medical-record', 'search'],
    'healthcare-immunization': ['vaccine', 'medical-record'],
    'healthcare-medicine': ['medicines', 'medical-record'],
    'healthcare-shield': ['shield', 'emergency'],
    'household-bednet': ['home', 'bed-net'],
    'people-chw-crop': ['community-worker', 'emergency'],
    'people-chw-female': ['female-clinician', 'home'],
    'people-chw-male': ['male-clinician', 'home'],
    'people-chw-phone': ['community-worker', 'phone'],
    'people-nurse': ['nurse', 'medical-record'],
    'people-nurse-crop': ['nurse', 'emergency'],
    'people-woman-pregnant': ['pregnant-person', 'emergency'],
    'places-chw-area': ['map-pin', 'community-worker'],
    'places-clinic': ['clinic', 'map-pin'],
    'places-hospital': ['hospital', 'map-pin'],
    'places-moh': ['health-ministry', 'map-pin'],
    'chw-manager': ['community-worker', 'gear'],
    'chw-manager-meet': ['community-worker', 'people'],
    'chw-rated': ['community-worker', 'star'],
    'complete-chw-supervision': ['community-worker', 'check'],
    'healthcare-immunization-alert': ['vaccine', 'warning'],
    'healthcare-immunization-verified': ['vaccine', 'check'],
    'healthcare-mrdt-correct': ['rapid-test', 'check'],
    'home-visits': ['home', 'community-worker'],
    'iccm-immunization': ['pediatrics', 'vaccine'],
    'iccm-immunization-1': ['vaccine', 'pediatrics'],
    'manager-chw-patient-observation': ['community-worker', 'patient'],
    'pregnant-woman-referral': ['pregnant-person', 'direction-arrow-right'],
  };
  if (s === 'rapid-test') return testResult('rdt-result');
  if (s === 'virus-2') return virus(2);
  if (work[s]) return combine(s, base(work[s][0]), base(work[s][1]));
  if (/virus-lab-research/.test(s)) {
    const subject = /syringe/.test(s)
      ? 'syringe'
      : /test-tube/.test(s)
        ? 'test-tube'
        : /microscope/.test(s)
          ? 'microscope'
          : /pill/.test(s)
            ? 'pill'
            : 'search';
    const n = numbered(s);
    return combine(
      'virus-research-' + subject + (n === 2 ? '-alt' : ''),
      base(subject),
      n === 2 ? virus(2) : virus(),
    );
  }
  if (/^(3-d-curve-auto-(colon|vessels)|3-d-i-ca|3-d-mpr-toggle|i-ca-2-d|i-ca-2d)$/.test(s)) {
    const subject = s.includes('colon')
      ? 'colonic-curve'
      : s.includes('vessel')
        ? 'vessel-curve'
        : 'mpr-planes';
    return s.includes('3-d')
      ? combine('imaging-' + s, base(subject), base('cube'))
      : base('vessel-curve');
  }
  if (s === 'cobb-angle') return base(s);
  if (/^(dicom-6000|dicom-overlay|hl7-attributes)$/.test(s))
    return combine(
      'clinical-imaging-' + s,
      base('study-image'),
      s.includes('overlay') ? base('layers') : textGlyph(s.startsWith('hl7') ? 'HL7' : 'DCM'),
    );
  if (s === 'download-study') return status('study-download', base('study-image'), 'down');
  if (s === 'exam-mode') return combine(s, base('study-image'), base('clinician'));
  if (s === 'hanging-protocol') return base('study-hanging-protocol');
  if (s === 'image-medical') return combine('medical-image', base('image'), base('emergency'));
  if (/^launch-study-[123]$/.test(s)) {
    const n = numbered(s);
    return combine(
      s,
      n === 2
        ? repeated(base('study-image'))
        : n === 3
          ? base('study-hanging-protocol')
          : base('study-image'),
      base('external'),
    );
  }
  if (/^pet-image-[bo]$/.test(s))
    return combine(s, base('study-image'), base(s.endsWith('b') ? 'brain' : 'body-weight'));
  if (s === 'save-series')
    return combine('study-save-series', repeated(base('study-image')), base('save'));
  if (s === 'spine-label') return combine(s, base('spine'), base('tag'));
  if (s === 'stress-breath-editor') return combine(s, base('stress-breath'), base('pencil'));
  if (/^study-(next|previous|read|skip|transfer|unread|view)$/.test(s)) {
    const mark = s.slice(6),
      g = base('study-image'),
      b = {
        next: 'direction-arrow-right',
        previous: 'direction-arrow-left',
        read: 'check',
        skip: 'external',
        transfer: 'arrows-move',
        unread: 'minus',
        view: 'eye',
      }[mark];
    return combine(s, g, base(b));
  }
  if (/^covid-?19-virus/.test(s)) {
    const n = numbered(s);
    if (/-[1-4]$/.test(s) && !/(pandemic|heal|lifelong|patient|warning)/.test(s))
      return virus(Math.min(3, n));
    const g = virus(n === 2 ? 2 : 1);
    if (s.includes('pandemic'))
      return combine('pandemic-' + n, base(n === 2 ? 'people' : n === 3 ? 'map' : 'globe'), g);
    if (s.includes('heal'))
      return status('virus-recovery-' + n, n === 2 ? base('patient') : g, 'check');
    if (s.includes('lifelong'))
      return combine(
        'post-viral-care-' + n,
        n === 2 ? base('heart') : base('patient'),
        base('clock'),
      );
    if (s.includes('patient'))
      return combine('viral-patient-' + n, base(n === 2 ? 'patient' : 'person'), g);
    if (s.includes('reinfected')) return combine('virus-reinfection', g, base('recurrence'));
    if (s.includes('warning'))
      return n === 3
        ? combine('virus-warning-3', base('warning'), g)
        : status('virus-warning-' + n, g, 'warning');
    if (s.includes('bat')) return combine('virus-animal-reservoir', base('bat'), g);
  }
  if (s.startsWith('covid-carrier-')) {
    const suffix = s.slice(14),
      subject = suffix.includes('blood')
        ? suffix.endsWith('2')
          ? 'blood-bag'
          : 'blood-drop'
        : suffix === 'human'
          ? 'person'
          : 'box';
    return combine('virus-carrier-' + suffix, base(subject), virus());
  }
  if (s === 'graph-document-infected-report') return combine(s, base('medical-record'), virus());
  if (/^mutation-/.test(s)) {
    if (s === 'mutation-stronger') return status('virus-mutation-increased', virus(3), 'up');
    if (s === 'mutation-temperature-change') return combine(s, virus(2), base('thermometer'));
    return combine(s, virus(numbered(s) === 2 ? 2 : 1), base('dna'));
  }
  if (s.startsWith('personal-hygiene-')) {
    const shield = s.endsWith('shield'),
      block = s.includes('block'),
      subject = s.includes('spray')
        ? 'sanitizer-spray'
        : s.includes('hand')
          ? 'hygiene'
          : 'sanitizer';
    const g = combine(
      'infection-control-' + subject + (shield ? '-shield' : '-virus'),
      base(subject),
      base(shield ? 'shield' : 'virus'),
    );
    return block ? { ...slash(g), key: g.key + '-blocked' } : g;
  }
  if (s.startsWith('quarantine-place-')) {
    const suffix = s.slice(17),
      n = numbered(s);
    let subject = suffix.includes('bed')
      ? 'hospital-bed'
      : suffix.includes('hospital')
        ? 'hospital'
        : suffix.includes('time')
          ? 'calendar'
          : suffix.includes('self')
            ? 'person'
            : 'home';
    let g = combine(
      'quarantine-' + suffix,
      base(subject),
      base(
        suffix.includes('shield')
          ? 'shield'
          : suffix.includes('lockdown')
            ? 'lock'
            : suffix.includes('day')
              ? 'clock'
              : 'virus',
      ),
    );
    if (n === 2) g = { ...enclosure(g), key: 'quarantine-' + suffix };
    return g;
  }
  if (s.startsWith('social-distancing-')) {
    const suffix = s.slice(18),
      n = numbered(s);
    let g = base('social-distance');
    if (/man|woman/.test(suffix))
      g = combine(
        'social-distance-' + suffix,
        base(suffix.includes('woman') ? 'female-clinician' : 'person'),
        base('dimension'),
      );
    else if (n === 2) g = base('social-distance-alt');
    else if (n === 3) g = combine('social-distance-seated', g, base('chair'));
    else if (n === 4) g = combine('social-distance-group', g, base('people'));
    else if (n === 5) g = combine('social-distance-entry', g, base('door'));
    else if (n === 6) g = combine('social-distance-radius', g, base('circle'));
    if (/correct/.test(suffix)) g = status('social-distance-correct-' + n, g, 'check');
    else if (/attention/.test(suffix)) g = status('social-distance-attention', g, 'warning');
    else if (/not-allowed|do-not-close/.test(suffix))
      g = { ...slash(g), key: 'social-distance-' + suffix };
    else if (/do-not-touch/.test(suffix))
      g = slash(combine('contact-avoidance', base('hand'), base('close')));
    else if (/protect-shield/.test(suffix))
      g = combine('social-distance-shield-' + n, g, base('shield'));
    else if (suffix === 'virus') g = combine('social-distance-virus', g, virus());
    return g;
  }
  if (s.startsWith('symptoms-')) {
    const raw = s.slice(9);
    const subject = raw.includes('diarrhea')
      ? 'intestine'
      : raw.includes('headache')
        ? 'brain'
        : raw.includes('loss-smell')
          ? 'nose'
          : raw.includes('lung')
            ? 'lungs'
            : raw.includes('stomach')
              ? 'stomach'
              : raw.includes('nausea')
                ? 'nausea-face'
                : 'fever-face';
    const n = numbered(s);
    return combine(
      'symptom-' + raw,
      base(subject),
      raw.includes('virus')
        ? virus(n === 2 ? 2 : 1)
        : base(raw.includes('cold') ? 'snowflake' : 'thermometer'),
    );
  }
  if (s.startsWith('transmission-virus-')) {
    const raw = s.slice(19),
      subjects = {
        'airplane-flight': 'airplane',
        briefcase: 'medical-bag',
        cough: 'cough-face',
        crowd: 'people',
        expand: 'expand',
        'float-wind': 'wind',
        handshake: 'handshake',
        'human-infected': 'patient',
        'human-transmit-1': 'person',
        'human-transmit-2': 'people',
        'increase-rate': 'chart-line',
        inhale: 'lungs',
        'mobile-application': 'mobile',
        'rat-mouse': 'mouse',
        'touch-finger': 'touch',
        'touch-hand-1': 'hand',
        'touch-hand-2': 'handshake',
        transmit: 'arrows-move',
        transportation: 'bus',
        'trash-bin': 'trash',
        visible: 'eye',
        'wind-breath': 'wind',
      };
    if (subjects[raw]) return combine('virus-transmission-' + raw, base(subjects[raw]), virus());
  }
  if (s.startsWith('vaccine-protection-')) {
    const raw = s.slice(19),
      n = numbered(s);
    const subject = raw.includes('face-mask')
      ? n === 3
        ? 'n95-mask'
        : n === 2
          ? 'mask'
          : 'masked-face'
      : raw.includes('face-shield')
        ? 'face-shield'
        : raw.includes('thermometer')
          ? 'infrared-thermometer'
          : raw.includes('pill')
            ? 'pill'
            : raw.includes('people')
              ? 'people'
              : raw.includes('spray')
                ? 'sanitizer-spray'
                : raw === 'shield'
                  ? 'shield'
                  : raw === 'syringe'
                    ? 'syringe'
                    : raw === 'virus'
                      ? 'virus'
                      : raw === 'wash-hands'
                        ? 'hygiene'
                        : null;
    if (subject)
      return combine(
        'infection-protection-' + raw,
        base(subject),
        n === 2 ? base('check') : base('shield'),
      );
  }
  if (/^social-distance-(2-meters|6-feet)$/.test(s))
    return combine(s, base('social-distance'), textGlyph(s.includes('meters') ? '2M' : '6FT'));
  return null;
}
