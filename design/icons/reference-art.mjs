// Original concept-driven interpretations of the reference inventory.
import {
  get,
  register,
  aliases,
  path,
  line,
  polygon,
  circle,
  rect,
  grid,
  arrow,
  lettering,
  textGlyph,
  transform,
  badge,
  slash,
  enclosure,
  repeated,
  normalized,
} from './outline-art.mjs';
import { resolveExtension } from './extended-art.mjs';
const art = (key, body, category) => ({ key, body, category });
const drawn = (key, ...d) => register(key, d.map((x) => path(x)).join(''));
const compose = (base, mark) => {
  if (!base || !mark) return null;
  return art(
    base.key + '-' + mark.key,
    transform(base.body, 0.7, 0.7, 0.61) + transform(mark.body, 12, 12, 0.35),
    base.category,
  );
};
drawn('circle', circle(10, 10, 8));
drawn('square', rect(2, 2, 16, 16, 0));
drawn('rounded-rectangle', rect(2, 5, 16, 10, 3));
drawn('rectangle', rect(2, 5, 16, 10, 0));
drawn('ellipse', 'M 2 10 A 8 5 0 1 0 18 10 A 8 5 0 1 0 2 10');
for (const [name, sides, rotation] of [
  ['triangle', 3, -90],
  ['diamond', 4, 0],
  ['pentagon', 5, -90],
  ['hexagon', 6, 0],
  ['octagon', 8, 22.5],
]) {
  const points = Array.from({ length: sides }, (_, i) => [
    10 + 8 * Math.cos(((rotation + (i * 360) / sides) * Math.PI) / 180),
    10 + 8 * Math.sin(((rotation + (i * 360) / sides) * Math.PI) / 180),
  ]).flat();
  drawn(name, polygon(...points));
}
drawn('star', polygon(10, 2, 12.5, 7, 18, 8, 14, 12, 15, 18, 10, 15, 5, 18, 6, 12, 2, 8, 7.5, 7));
drawn('play', polygon(5, 2, 18, 10, 5, 18));
drawn('pause', rect(4, 3, 4, 14, 0.3), rect(12, 3, 4, 14, 0.3));
drawn('stop', rect(3, 3, 14, 14, 1));
drawn('bold', 'M 5 2 V 18 H 11 C 20 18 18 9 11 10 H 5 M 5 2 H 11 C 18 2 18 10 11 10');
drawn('italic', line(9, 2, 17, 2), line(3, 18, 11, 18), line(13, 2, 7, 18));
drawn('underline', 'M 4 2 V 9 C 4 16 16 16 16 9 V 2', line(2, 18, 18, 18));
drawn('strike-through', 'M 16 4 C 2 -2 0 8 9 9 C 20 10 18 21 3 16', line(2, 10, 18, 10));
drawn('speech-bubble', 'M 2 3 H 18 V 14 H 10 L 5 18 V 14 H 2 Z');
drawn(
  'quote',
  'M 3 3 H 8 V 10 L 5 16 H 2 L 5 10 H 3 Z M 12 3 H 17 V 10 L 14 16 H 11 L 14 10 H 12 Z',
);
drawn('smile', circle(10, 10, 8), circle(7, 7, 0.5), circle(13, 7, 0.5), 'M 5 12 Q 10 18 15 12');
drawn('frown', circle(10, 10, 8), circle(7, 7, 0.5), circle(13, 7, 0.5), 'M 5 15 Q 10 9 15 15');
drawn('thumbs-up', 'M 7 9 L 10 2 Q 14 0 13 7 H 18 V 11 L 15 18 H 7 Z', rect(2, 9, 5, 9, 0.4));
drawn('thumbs-down', 'M 7 11 L 10 18 Q 14 20 13 13 H 18 V 9 L 15 2 H 7 Z', rect(2, 2, 5, 9, 0.4));
drawn(
  'hourglass',
  line(4, 2, 16, 2),
  line(4, 18, 16, 18),
  'M 5 2 V 5 L 15 15 V 18 M 15 2 V 5 L 5 15 V 18',
  line(7, 5, 13, 5),
  line(7, 15, 13, 15),
);
drawn(
  'flag-slash',
  line(4, 2, 4, 18),
  polygon(4, 3, 17, 3, 14, 7, 17, 11, 4, 11),
  line(2, 18, 18, 2),
);
drawn(
  'shower',
  line(3, 18, 3, 7),
  'M 3 7 C 3 0 12 0 12 5',
  polygon(8, 7, 16, 7, 13, 4, 11, 4),
  line(9, 10, 8, 12),
  line(13, 10, 12, 12),
  line(16, 11, 15, 13),
  line(11, 15, 10, 18),
);
drawn(
  'bed',
  line(2, 4, 2, 18),
  line(18, 10, 18, 18),
  line(2, 14, 18, 14),
  rect(4, 8, 5, 5, 0.5),
  rect(9, 9, 9, 5, 0.5),
);
drawn(
  'bench',
  line(2, 5, 18, 5),
  line(2, 9, 18, 9),
  line(2, 13, 18, 13),
  line(5, 13, 5, 18),
  line(15, 13, 15, 18),
);
drawn('door', polygon(4, 2, 16, 4, 16, 18, 4, 18), line(4, 2, 4, 18), circle(13, 11, 0.6));
drawn(
  'lighthouse',
  polygon(6, 18, 8, 7, 12, 7, 14, 18),
  rect(7, 3, 6, 4, 0.3),
  polygon(6, 3, 10, 1, 14, 3),
  line(2, 4, 4, 4),
  line(16, 4, 18, 4),
  line(8, 12, 12, 12),
);
drawn(
  'church',
  polygon(2, 18, 2, 10, 7, 10, 7, 6, 10, 2, 13, 6, 13, 10, 18, 10, 18, 18),
  rect(8, 13, 4, 5, 0.2),
  line(10, 3, 10, 7),
  line(8, 5, 12, 5),
);
drawn('monument', polygon(6, 16, 8, 3, 10, 1.5, 12, 3, 14, 16), rect(3, 16, 14, 3, 0.2));
drawn(
  'stadium',
  'M 2 10 C 2 0 18 0 18 10 C 18 20 2 20 2 10 Z M 5 10 C 5 4 15 4 15 10 C 15 16 5 16 5 10 Z',
  line(7, 10, 13, 10),
);
drawn(
  'basketball',
  circle(10, 10, 8),
  line(2, 10, 18, 10),
  line(10, 2, 10, 18),
  'M 4 4 Q 12 10 4 16 M 16 4 Q 8 10 16 16',
);
drawn(
  'baseball',
  circle(10, 10, 8),
  'M 5 3 Q 11 10 5 17 M 15 3 Q 9 10 15 17',
  line(6, 7, 8, 6),
  line(6, 13, 8, 14),
  line(12, 6, 14, 7),
  line(12, 14, 14, 13),
);
drawn(
  'rugby',
  'M 2 15 Q 1 3 17 2 Q 19 17 5 18 Z',
  line(6, 14, 14, 6),
  line(8, 9, 11, 12),
  line(10, 7, 13, 10),
);
drawn(
  'volleyball',
  circle(10, 10, 8),
  'M 10 10 L 7 2 M 10 10 L 3 15 M 10 10 L 17 15 M 9 5 Q 14 4 17 8 M 6 13 Q 5 7 3 6 M 13 13 Q 10 16 7 17',
);
drawn(
  'golf',
  line(4, 2, 4, 17),
  polygon(4, 2, 15, 5, 4, 9),
  'M 2 18 Q 10 14 18 18',
  circle(14, 13, 1.3),
);
drawn(
  'swimming',
  circle(8, 5, 2),
  line(2, 12, 7, 8, 13, 11, 17, 8),
  'M 2 15 Q 5 12 8 15 Q 11 18 14 15 Q 17 12 19 15 M 2 19 Q 5 16 8 19 Q 11 22 14 19',
);
drawn(
  'skiing',
  circle(10, 3, 1.5),
  line(9, 6, 6, 11, 12, 12, 14, 17),
  line(7, 8, 14, 8, 17, 4),
  line(3, 8, 5, 18),
  line(2, 18, 18, 18),
);
drawn(
  'skating',
  circle(10, 3, 1.5),
  line(10, 6, 9, 11, 14, 14, 12, 17),
  line(9, 11, 5, 15),
  line(4, 6, 10, 8, 16, 6),
  line(11, 19, 17, 19),
);
drawn(
  'running',
  circle(12, 3, 1.5),
  line(11, 6, 8, 11, 13, 13, 11, 18),
  line(8, 11, 4, 15, 2, 15),
  line(5, 7, 8, 5, 12, 8, 17, 8),
);
drawn(
  'walking',
  circle(11, 3, 1.5),
  line(10, 6, 9, 11, 5, 18),
  line(9, 11, 14, 18),
  line(5, 10, 10, 6, 13, 10, 17, 10),
);
drawn(
  'dog',
  polygon(
    3,
    8,
    7,
    8,
    10,
    10,
    15,
    10,
    15,
    4,
    18,
    6,
    18,
    12,
    16,
    13,
    16,
    18,
    13,
    18,
    12,
    13,
    7,
    13,
    6,
    18,
    3,
    18,
  ),
  line(3, 8, 2, 4),
);
drawn(
  'cat',
  'M 5 17 C -2 16 2 7 5 12 M 7 18 V 9 L 6 3 L 10 6 L 14 3 L 14 10 Q 20 18 13 18 Z',
  circle(9, 10, 0.4),
  circle(12, 10, 0.4),
);
drawn(
  'bird',
  'M 2 11 Q 7 5 11 7 L 15 3 L 17 7 L 19 8 L 16 10 Q 15 18 7 16 Z',
  line(6, 16, 6, 19),
  line(11, 17, 11, 19),
  'M 6 11 Q 10 6 13 11',
);
drawn(
  'fish',
  'M 5 10 Q 11 1 18 10 Q 11 19 5 10 L 1 5 V 15 Z',
  circle(14, 9, 0.5),
  'M 9 6 Q 12 10 9 14',
);
drawn(
  'paw',
  circle(4, 6, 2),
  circle(9, 3.5, 2),
  circle(14, 4, 2),
  circle(17, 8, 2),
  'M 4 15 C 3 10 9 7 11 10 C 15 9 18 17 13 18 Q 10 16 7 18 Q 3 19 4 15 Z',
);
drawn(
  'deer',
  circle(11, 9, 3),
  line(9, 7, 6, 4, 6, 1.5),
  line(6, 4, 3, 3),
  line(13, 7, 16, 4, 16, 1.5),
  line(16, 4, 18, 3),
  polygon(3, 12, 11, 12, 15, 15, 15, 18, 12, 18, 11, 15, 6, 15, 5, 18, 2, 18),
);
drawn(
  'bear',
  circle(6, 5, 2),
  circle(14, 5, 2),
  circle(10, 10, 6),
  circle(8, 9, 0.5),
  circle(12, 9, 0.5),
  circle(10, 12, 2),
  line(6, 15, 5, 18),
  line(14, 15, 15, 18),
);
drawn(
  'elephant',
  'M 3 18 V 8 Q 5 2 12 5 Q 18 4 18 10 V 16 Q 14 19 14 14 V 11 L 12 10 V 18 H 9 V 13 H 6 V 18 Z',
  line(3, 9, 1.5, 6),
  'M 12 5 Q 7 6 11 11',
  circle(15, 8, 0.5),
);
drawn(
  'snake',
  'M 3 17 C -2 8 19 14 15 7 C 13 4 5 10 4 5 C 3 1 14 1 17 4',
  line(17, 4, 19, 3),
  line(17, 4, 19, 5),
);
drawn(
  'turtle',
  circle(10, 10, 5),
  circle(17, 8, 2),
  line(6, 6, 4, 4),
  line(6, 14, 4, 17),
  line(13, 6, 14, 3),
  line(13, 14, 15, 17),
  polygon(8, 7, 12, 7, 14, 11, 10, 14, 6, 11),
);
drawn(
  'frog',
  circle(6, 5, 2),
  circle(14, 5, 2),
  'M 3 17 Q 5 9 3 9 Q 10 4 17 9 Q 15 9 17 17 L 13 16 L 10 18 L 7 16 Z',
  line(5, 12, 7, 14),
  line(15, 12, 13, 14),
);
drawn(
  'cow',
  polygon(5, 4, 8, 6, 12, 6, 15, 4, 17, 7, 15, 10, 15, 16, 10, 18, 5, 16, 5, 10, 3, 7),
  circle(8, 10, 0.5),
  circle(12, 10, 0.5),
  rect(7, 13, 6, 3, 1),
  line(5, 4, 4, 2),
  line(15, 4, 16, 2),
);
drawn(
  'horse',
  polygon(4, 18, 7, 9, 5, 6, 7, 2, 13, 4, 16, 10, 13, 12, 12, 18),
  line(7, 9, 13, 7),
  line(8, 3, 10, 8),
  circle(12, 6, 0.5),
);
drawn(
  'alligator',
  'M 2 12 L 6 7 L 13 9 L 18 9 L 18 13 L 8 13 L 5 16 L 2 16 L 4 12 Z',
  line(9, 9, 9, 7),
  line(12, 9, 12, 7),
  line(11, 11, 17, 11),
  line(9, 13, 12, 17),
);
drawn(
  'mosquito',
  circle(10, 9, 2),
  line(10, 2, 10, 18),
  line(8, 7, 3, 3),
  line(12, 7, 17, 3),
  'M 8 8 C 0 5 1 13 8 11 M 12 8 C 20 5 19 13 12 11',
  line(8, 13, 4, 17),
  line(12, 13, 16, 17),
);
drawn(
  'mushroom',
  'M 2 11 C 2 -1 18 -1 18 11 Z M 8 11 L 7 18 H 13 L 12 11',
  circle(7, 7, 0.5),
  circle(12, 5, 0.5),
  circle(14, 8, 0.5),
);
drawn(
  'crab',
  circle(10, 12, 5),
  line(6, 9, 3, 6, 2, 2),
  line(14, 9, 17, 6, 18, 2),
  line(2, 2, 5, 4, 2, 5),
  line(18, 2, 15, 4, 18, 5),
  line(5, 12, 2, 11),
  line(5, 15, 2, 17),
  line(15, 12, 18, 11),
  line(15, 15, 18, 17),
);
drawn(
  'coral',
  line(10, 3, 10, 18),
  line(3, 4, 3, 8, 10, 11, 17, 7, 17, 3),
  line(2, 12, 6, 15, 10, 13, 16, 17, 18, 14),
);
drawn(
  'antenna',
  line(10, 8, 10, 18),
  circle(10, 5, 1.5),
  'M 6 2 Q 1 5 6 8 M 14 2 Q 19 5 14 8',
  line(6, 18, 14, 18),
);
drawn(
  'faucet',
  line(3, 8, 16, 8, 16, 12, 12, 12, 12, 11, 3, 11),
  line(6, 8, 6, 4, 10, 4, 10, 8),
  line(4, 2, 12, 2),
  line(8, 2, 8, 4),
  'M 14 14 C 10 19 18 20 14 14 Z',
);
drawn(
  'hydrant',
  rect(6, 6, 8, 12, 1),
  rect(3, 9, 3, 4, 0.3),
  rect(14, 9, 3, 4, 0.3),
  'M 6 6 A 4 4 0 0 1 14 6',
  line(4, 18, 16, 18),
  circle(10, 12, 1),
);
drawn(
  'electrical-cabinet',
  rect(3, 2, 14, 16, 1),
  line(10, 2, 10, 18),
  polygon(7, 5, 5, 9, 8, 9, 6, 13),
  line(13, 8, 13, 11),
);
drawn(
  'earth',
  circle(10, 10, 8),
  'M 4 5 L 7 6 L 8 9 L 4 11 M 13 3 L 12 7 L 16 9 L 17 14 M 8 14 L 11 12 L 13 14 L 10 18',
);
drawn(
  'gearbox',
  rect(3, 3, 14, 14, 2),
  circle(10, 10, 4),
  circle(10, 10, 1.2),
  line(1.5, 10, 3, 10),
  line(17, 10, 18.5, 10),
);
drawn(
  'solar',
  polygon(4, 6, 17, 6, 15, 15, 2, 15),
  line(3, 10, 16, 10),
  line(8, 6, 6, 15),
  line(13, 6, 11, 15),
  line(8, 15, 8, 18),
  line(5, 18, 12, 18),
  circle(3, 2, 0.5),
);
drawn(
  'windmill',
  line(10, 8, 10, 18),
  circle(10, 7, 1.5),
  polygon(10, 5, 8, 1.5, 12, 1.5),
  polygon(12, 8, 18, 7, 17, 11),
  polygon(8, 8, 5, 14, 2, 11),
);
drawn(
  'digger',
  line(2, 16, 11, 16),
  circle(4, 17, 1.5),
  circle(10, 17, 1.5),
  rect(4, 10, 7, 5, 0.5),
  line(10, 10, 13, 3, 17, 9, 19, 10, 17, 13, 15, 11, 17, 9),
);
drawn(
  'stop-sign',
  polygon(6, 2, 14, 2, 18, 6, 18, 14, 14, 18, 6, 18, 2, 14, 2, 6),
  line(6, 10, 14, 10),
);
drawn(
  'person-id',
  rect(2, 3, 16, 14, 1),
  circle(7, 8, 2),
  'M 4 14 Q 7 9 10 14',
  line(12, 7, 16, 7),
  line(12, 11, 16, 11),
);
drawn(
  'dna',
  'M 5 2 C 5 10 15 10 15 18 M 15 2 C 15 10 5 10 5 18',
  line(5.5, 4, 14.5, 4),
  line(7.5, 7, 12.5, 7),
  line(7.5, 13, 12.5, 13),
  line(5.5, 16, 14.5, 16),
);
drawn(
  'magnifier-person',
  circle(8, 8, 6),
  circle(8, 6, 1.7),
  'M 4.5 11 Q 8 7.5 11.5 11',
  line(13, 13, 18, 18),
);
drawn(
  'scales',
  line(10, 2, 10, 18),
  line(4, 5, 16, 5),
  line(6, 18, 14, 18),
  polygon(4, 5, 1.5, 12, 6.5, 12),
  polygon(16, 5, 13.5, 12, 18.5, 12),
);
drawn(
  'podium',
  rect(4, 7, 12, 4, 0.5),
  polygon(6, 11, 14, 11, 13, 18, 7, 18),
  line(10, 7, 10, 3, 14, 3),
);
drawn('music', line(7, 15, 7, 4, 17, 2, 17, 13), circle(4, 16, 3), circle(14, 14, 3));
drawn(
  'mask',
  'M 4 5 Q 10 9 16 5 V 13 Q 10 18 4 13 Z M 4 7 C -1 4 -1 13 4 12 M 16 7 C 21 4 21 13 16 12',
  line(7, 10, 13, 10),
  line(7, 12, 13, 12),
);
drawn(
  'air-conditioning',
  rect(2, 3, 16, 10, 1),
  line(5, 7, 15, 7),
  line(5, 10, 15, 10),
  'M 6 15 V 18 M 10 15 V 19 M 14 15 V 18',
);
drawn('fan', circle(10, 10, 1.5), 'M 10 8 C 1 -2 18 -2 12 9 C 24 9 18 23 11 12 C 4 22 -3 9 8 10 Z');
drawn('infinity', 'M 10 10 C -2 -3 -2 23 10 10 C 22 -3 22 23 10 10 Z');
drawn('chain', circle(5, 10, 3), circle(15, 10, 3), line(8, 10, 12, 10));
drawn(
  'construction-cone',
  polygon(9, 2, 11, 2, 16, 17, 4, 17),
  line(7, 8, 13, 8),
  line(5, 13, 15, 13),
  line(2, 18, 18, 18),
);
drawn(
  'barrier',
  rect(2, 5, 16, 8, 0.5),
  line(5, 13, 5, 18),
  line(15, 13, 15, 18),
  line(3, 11, 8, 6),
  line(10, 12, 16, 6),
);
drawn(
  'magnet',
  'M 3 2 H 7 V 10 A 3 3 0 0 0 13 10 V 2 H 17 V 10 A 7 7 0 0 1 3 10 Z',
  line(3, 6, 7, 6),
  line(13, 6, 17, 6),
);
aliases('speech-bubble', 'message', 'conversation', 'chat', 'pop-up-blank', 'popup', 'pop-up-1');
aliases('music', 'music-note');
aliases('bed', 'hotel', 'lodging', 'medical-bed');
aliases('church', 'place-of-worship');
aliases('racket', 'handball-racquetball');
aliases('basketball', 'basketball');
aliases('baseball', 'baseball', 'softball');
aliases('rugby', 'rugby', 'football');
aliases('golf', 'golf-course', 'golf-green', 'golf-fairway', 'golf-tee', 'golf-practice-green');
aliases('swimming', 'swimming-pool', 'pool', 'toddler-pool', 'splash-pad');
aliases('skiing', 'ski-resort', 'snow-mobile-trail');
aliases('skating', 'ice-skating', 'ice-rink', 'rollerskating');
aliases('walking', 'person-walking', 'walking-travel-mode');
aliases('running', 'running-outline');
aliases('bird', 'turkey', 'eagle', 'waterfowl');
aliases('cat', 'bobcat', 'mountain-lion', 'furbearer');
aliases('dog', 'wolf', 'coyote', 'animal-safety');
aliases('deer', 'elk', 'moose');
aliases('bear', 'big-foot');
aliases('paw', 'pawprint', 'animal-shelter', 'dog-park');
aliases('cow', 'hog');
aliases('turtle', 'reptile');
aliases('crab', 'crab-pot');
aliases('bird', 'bird-nest');
aliases('hydrant', 'fire-department-connection');
aliases(
  'electrical-cabinet',
  'cabinet',
  'junction-box',
  'substation',
  'power-substation',
  'switch-gear',
  'network-protector',
);
aliases('solar', 'electric-charging-station', 'ev-charging-station');
aliases('fan', 'cooling-system');
aliases('air-conditioning', 'temperature-sensor');
aliases('person-id', 'id', 'employee-id', 'identity', 'identity-card');
aliases('scales', 'justice', 'law', 'government-permit', 'permit');
aliases('construction-cone', 'traffic-cone', 'work-zone');
aliases('barrier', 'barricade', 'jersey-barrier', 'metal-barrier');
aliases('digger', 'bulldozer', 'road-grader', 'plow', 'mining', 'dig');
aliases('magnet', 'snap');

const simpleAliases = {
  '2d': 'square',
  '3d': 'cube',
  '3d-glasses': 'binoculars',
  '3d-building': 'building',
  accessibility: 'wheelchair',
  accessible: 'wheelchair',
  'wheelchair-assistance': 'wheelchair',
  'wheelchair-travel-mode': 'wheelchair',
  'accessibility-parking-space': 'parking',
  atm: 'money',
  cash: 'money',
  credits: 'money',
  'bank-account': 'money',
  'financial-transaction': 'money',
  mortgage: 'home',
  'property-value': 'home',
  'real-estate': 'home',
  'for-sale': 'home',
  house: 'home',
  residence: 'home',
  'personal-homepage': 'home',
  'qr-code': 'grid-3',
  'qt-code': 'grid-3',
  barcode: 'grid',
  'scan-barcode': 'grid',
  brightness: 'sun',
  day: 'sun',
  daylight: 'sun',
  night: 'moon',
  'battery-charging': 'battery',
  recycling: 'recycle',
  composter: 'recycle',
  'waste-disposal': 'trash',
  litter: 'trash',
  'hazardous-waste': 'trash',
  dumpster: 'trash',
  'shopping-cart': 'shop',
  'shopping-cart-plus': 'shop',
  'grocery-store': 'shop',
  'shop-or-service': 'shop',
  'default-shop-or-service': 'shop',
  'gas-station': 'pump',
  'car-wash': 'faucet',
  article: 'file',
  document: 'file',
  'document-learning': 'file',
  license: 'file',
  'official-document': 'file',
  notepad: 'file',
  notebook: 'file',
  'notebook-snapshot': 'file',
  'file-text': 'file',
  files: 'file',
  'file-data': 'database',
  'data-type': 'database',
  'data-cloud': 'cloud',
  'cloud-data': 'cloud',
  'data-folder': 'folder',
  event: 'calendar',
  date: 'calendar',
  'date-time': 'calendar',
  appointment: 'calendar',
  dictionary: 'book',
  description: 'list',
  'text-paragraph': 'list',
  transcript: 'list',
  menu: 'menu',
  hamburger: 'menu',
  sliders: 'slider',
  'sliders-horizontal': 'slider',
  properties: 'slider',
  'property-setting': 'slider',
  configuration: 'gear',
  configure: 'gear',
  'app-gear': 'gear',
  fingerprint: 'fingerprint',
  'face-id': 'fingerprint',
  security: 'shield',
  'safety-and-communication': 'shield',
  'security-check': 'shield',
  'check-shield': 'shield-health',
  premium: 'star',
  'premium-content-user-credit': 'person',
  membership: 'person',
  collaboration: 'people',
  partner: 'people',
  'shared-group': 'people',
  technology: 'monitor',
  'web-camera': 'camera',
  'web-adaptor': 'server',
  'web-adapter': 'server',
  portal: 'server',
  'portal-other': 'server',
  terminal: 'terminal',
  console: 'terminal',
  integration: 'plug',
  'plug-connection': 'plug',
  'phone-number': 'phone',
  headset: 'phone',
  'security-camera': 'camera',
  'cctv-camera': 'camera',
  'traffic-camera': 'camera',
  'livestream-video-protocols': 'video',
  audio: 'volume',
  sound: 'volume',
  'sound-low': 'volume',
  'sound-board': 'slider',
  'music-note': 'music',
  'text-outline': 'text',
  'time-zone': 'globe',
  medical: 'first-aid',
  'medical-professional': 'clinician',
  'emergency-medical-professional': 'clinician',
  'medical-bed': 'bed',
  'medical-helicopter': 'telehealth',
  doctor: 'clinician',
  dentist: 'tooth',
  veterinarian: 'paw',
  'animal-treatment': 'paw',
  pharmaceuticals: 'pill',
  pharmacy: 'medication-bottle',
  medicine: 'pill',
  drug: 'pill',
  opioids: 'capsule',
  opiates: 'capsule',
  'unknown-drug': 'pill',
  'designer-drug': 'capsule',
  'prescription-drug-drop-off': 'medication-bottle',
  prescription: 'prescription',
  injection: 'syringe',
  methamphetamine: 'test-tube',
  cocaine: 'test-tube',
  steroids: 'medication-bottle',
  kidneys: 'kidney',
  'health-and-human-services': 'care-team',
  'health-alert': 'shield-health',
  healthcare: 'hospital',
  'mental-health': 'mental-health',
  patient: 'patient',
  'home-support': 'home-care',
  'home-with-heart': 'home-care',
  care: 'home-care',
  'alternative-medicine': 'plant',
  cannabis: 'leaf',
  'plant-concentrates': 'leaf',
  'substance-abuse': 'pill',
  'drug-waste': 'medication-bottle',
  'dangerous-substance': 'warning',
  overdose: 'pill',
  'overdose-treatment': 'medical-bag',
  aed: 'heartbeat',
  birth: 'maternity',
  'breastfeeding-station': 'maternity',
  'volunteer-service': 'organ-donation',
  death: 'skull',
  'overdose-death': 'skull',
  stadium: 'stadium',
  arena: 'stadium',
  auditorium: 'stadium',
  baseball: 'baseball',
  soccer: 'ball',
  basketball: 'basketball',
  rugby: 'rugby',
  football: 'rugby',
  volleyball: 'volleyball',
  cricket: 'baseball',
  curling: 'ball',
  'sport-rental': 'racket',
  'default-sport': 'ball',
  'table-tennis': 'racket',
  'disc-golf': 'golf',
  'disc-golf-baskets': 'golf',
  'disc-golf-tees': 'golf',
  tennis: 'racket',
  pickleball: 'racket',
  'golf-driving-range': 'golf',
  'golf-sand-bunker': 'golf',
  'golf-clubhouse': 'golf',
  'golf-bag-drop': 'golf',
  'multipurpose-field': 'stadium',
  'track-and-field': 'running',
  wakeboarding: 'swimming',
  windsurfing: 'boat',
  waterslide: 'swimming',
  aquarium: 'fish',
  fishing: 'fish',
  'fishing-pier': 'fish',
  fish: 'fish',
  zoo: 'paw',
  'zoo-exhibit': 'paw',
  'default-building': 'building',
  'default-education': 'school',
  'default-government-or-public-facility': 'bank',
  'default-residence': 'home',
  'default-industrial-or-infrastructure': 'factory',
  'default-medical': 'hospital',
  'default-medical-or-emergency': 'first-aid',
  'default-outdoors': 'tree',
  'default-water-feature': 'water',
  'default-land-feature': 'mountain',
  'default-transportation': 'bus',
  'default-arts-and-entertainment': 'music',
  'default-indoors': 'door',
  gallery: 'image',
  'art-gallery': 'image',
  museum: 'bank',
  'performing-arts': 'music',
  'movie-theater': 'video',
  theater: 'mask',
  'post-office': 'mail',
  embassy: 'flag',
  'memorial-site': 'monument',
  cemetery: 'monument',
  historical: 'monument',
  tombstone: 'monument',
  'rest-area': 'bench',
  'picnic-area': 'bench',
  park: 'tree',
  'park-office': 'home',
  'national-park': 'tree',
  garden: 'flower',
  'park-tree-problem': 'tree',
  'nursery-and-stock-dealer': 'plant',
  greenhouse: 'plant',
  weeds: 'leaf',
  reeds: 'plant',
  infestation: 'mosquito',
  'land-feature-hill': 'mountain',
  woodland: 'tree',
  'pine-tree': 'tree',
  mountain: 'mountain',
  waterfall: 'water',
  stormwater: 'water',
  'water-recycling': 'recycle',
  fountain: 'faucet',
  'water-fountain': 'faucet',
  'water-faucet': 'faucet',
  restroom: 'person',
  washroom: 'person',
  toilet: 'person',
  'gender-neutral-restroom': 'person',
  'vault-toilet': 'person',
  'changing-room': 'person',
  stairs: 'stair',
  escalator: 'stair',
  elevator: 'panel',
  'elevator-1': 'panel',
  'elevator-2': 'panel',
  'aerial-tram': 'train',
  'aerial-car': 'car',
  'aerial-truck': 'truck',
  'railroad-sign': 'road-sign',
  'railroad-crossings': 'road-sign',
  'traffic-signal': 'traffic-light',
  'traffic-signal-cabinet': 'electrical-cabinet',
  'road-closures': 'barrier',
  detour: 'road-sign',
  'lane-reduction-arrow': 'road',
  'divided-highway': 'road',
  'major-road': 'road',
  'narrow-road': 'road',
  'divided-highway-end': 'road',
  'freeway-expressway-ramp-arrow': 'road',
  'speed-hump': 'road',
  speedbump: 'road',
  'bicycle-detector': 'bicycle',
  'bike-lane': 'bicycle',
  'electric-vehicle': 'car',
  'rail-depot': 'train',
  port: 'ship',
  marina: 'anchor',
  'boat-ramp': 'boat',
  dock: 'boat',
  tunnel: 'road',
  wayfinding: 'road-sign',
  signpost: 'road-sign',
  'sign-arrow': 'road-sign',
  'street-sweeper': 'truck',
  'traffic-accident': 'car',
  'transit-collision': 'train',
  'traffic-safety-problem': 'road',
  'train-derailment': 'train',
  atv: 'car',
  jeep: 'car',
  rv: 'truck',
  trailer: 'truck',
  'stroller-travel-mode': 'car',
  seaplane: 'airplane',
  shuttle: 'bus',
  submarine: 'ship',
  'electric-vehicle': 'car',
  wood: 'tree',
  'farming-structure': 'home',
  barn: 'home',
  cow: 'cow',
  horse: 'horse',
  tractor: 'truck',
  bait: 'fish',
  agriculture: 'plant',
  'valve-inspection': 'valve',
  'smart-pig-launcher': 'pipe',
  'smart-pig-receiver': 'pipe',
  'service-point': 'point',
  'discharge-point': 'point',
  'connection-point': 'point',
  'connection-point-two': 'multi-point',
  'calibration-point': 'point',
  'clean-out': 'pipe',
  manhole: 'circle',
  handhole: 'square',
  vault: 'electrical-cabinet',
  gate: 'fence',
  'gate-bank': 'fence',
  handhole: 'square',
  'catch-basins': 'water',
  drip: 'blood-drop',
  droplet: 'blood-drop',
  'water-drop': 'blood-drop',
  generation: 'lightning',
  generator: 'lightning',
  compressor: 'pump',
  'compressor-station': 'pump',
  'power-plant': 'factory',
  'power-distribution': 'electric-pole',
  'transmission-power': 'electric-pole',
  inverter: 'lightning',
  'power-failure': 'lightning',
  capacitor: 'transformer',
  reactor: 'transformer',
  regulator: 'meter',
  'voltage-regulator': 'meter',
  'regulation-station': 'meter',
  'meter-setting': 'meter',
  'temp-source-location-meter-setting': 'meter',
  'temp-source-location-regulator-station': 'meter',
  'temp-source-location-compressor-station': 'pump',
  'temp-source-location-wellhead': 'pipe',
  wellhead: 'pipe',
  'wellhead-source-flange': 'pipe',
  'custody-transfer-to-distribution-meter': 'meter',
  'custody-transfer-to-gathering-meter': 'meter',
  'custody-transfer-to-transmission-meter': 'meter',
  ground: 'ground',
  arson: 'flame',
  homicide: 'skull',
  assassination: 'skull',
  assault: 'person',
  'simple-assault': 'person',
  attack: 'person',
  violence: 'person',
  riot: 'people',
  gun: 'gun',
  'direct-fire': 'gun',
  knife: 'knife',
  'police-badge': 'shield',
  'police-officer': 'clinician',
  'police-officer-two': 'clinician',
  'police-officer-three': 'clinician',
  'police-9-unit': 'dog',
  'swat-team': 'shield',
  offender: 'person',
  suspect: 'person',
  detained: 'handcuffs',
  handcuffs: 'handcuffs',
  investigation: 'search',
  'missing-person': 'magnifier-person',
  'welfare-checkup': 'person',
  hitchhiker: 'walking',
  'child-abuse': 'patient',
  'domestic-disturbance': 'home',
  'human-trafficking-commercial-sex-acts': 'people',
  kidnapping: 'person',
  'mentally-ill': 'mental-health',
  'sexual-assault': 'person',
  'rape-whistle': 'volume',
  'pornography-obscene-material': 'file',
  'prostitution-assisting-or-promoting-prostitution-purchasing-prostitution': 'person',
  cult: 'people',
  pirate: 'skull',
  hacker: 'code',
  'identity-theft': 'person-id',
  'counterfeiting-forgery': 'file',
  'credit-card-fraud': 'credit-card',
  embezzlement: 'money',
  bribery: 'money',
  'extortion-blackmail': 'mail',
  'all-other-larceny': 'money',
  larceny: 'money',
  robbery: 'money',
  burglary: 'home',
  smuggling: 'box',
  sabotage: 'gear',
  'stolen-property-offenses': 'box',
  'theft-from-building': 'building',
  'theft-from-coin-operated-machine-or-device': 'money',
  'theft-of-motor-vehicle-parts-or-accessories': 'car',
  'vehicle-theft': 'car',
  'recovered-vehicle': 'car',
  shoplifting: 'shop',
  'shoplifting-cart': 'shop',
  speeding: 'car',
  swerve: 'car',
  dui: 'car',
  intimidation: 'warning',
  'technical-issue': 'gear',
  'spray-paint': 'paint-bucket',
  'fuel-can': 'tank',
  bomb: 'warning',
  explosion: 'flame',
  explosive: 'flame',
  nuclear: 'warning',
  'chemical-weapons': 'lab-flask',
  'chemical-incident': 'lab-flask',
  'bomb-technician': 'shield',
  'battle-damage-assessment-point': 'map-pin',
  'ip-address': 'code',
  'tech-support': 'gear',
  'fire-alarm': 'bell',
  'alarm-control-panel': 'panel',
  'alarm-other': 'bell',
  'annunciator-panel': 'panel',
  'fire-station': 'home',
  'fire-truck': 'truck',
  firefighter: 'clinician',
  'fire-extinguisher': 'medication-bottle',
  'fire-service-box': 'box',
  'fire-suppression-other': 'hydrant',
  'fire-escape': 'stairs',
  'hose-connection': 'pipe',
  'oxygen-shut-off': 'valve',
  'gas-shut-off': 'valve',
  'compressed-natural-gas-shut-off': 'valve',
  'liquefied-natural-gas-shut-off': 'valve',
  'sprinkler-control-valve': 'valve',
  'sprinkler-control-panel': 'panel',
  'utility-shut-off-other': 'ground',
  'telecommunications-shut-off': 'antenna',
  'building-access-other': 'door',
  'attic-access': 'door',
  'basement-access': 'door',
  'key-box-other': 'key',
  'security-area-of-refuge': 'shield',
  'security-area-of-refuge-accessible': 'wheelchair',
  occupancies: 'people',
  'reset-panel': 'panel',
  avalanche: 'mountain',
  'damaged-dam': 'water',
  dam: 'water',
  'levee-failure': 'water',
  flooding: 'water',
  tsunami: 'water',
  earthquake: 'earthquake',
  tornado: 'tornado',
  hurricane: 'tornado',
  'volcanic-eruption': 'mountain',
  drought: 'sun',
  'extreme-heat': 'sun',
  'hot-cold': 'thermometer',
  fog: 'cloud',
  hail: 'rain',
  thunderstorm: 'rain',
  'severe-thunderstorm-incident': 'rain',
  'lightning-strike': 'lightning',
  landslide: 'mountain',
  debris: 'mountain',
  'debris-sediment': 'mountain',
  sandbags: 'box',
  electronics: 'monitor',
  refrigerator: 'electrical-cabinet',
  'personal-property': 'home',
  warehouse: 'factory',
  'food-storage': 'box',
  clothes: 'person',
  clothing: 'person',
  assistance: 'person',
  shelter: 'home',
  'shelters-2': 'home',
  'shelter-open': 'home',
  'shelter-closed': 'home',
  'incident-command-post': 'flag',
  'entry-point-primary': 'door',
  'entry-point-alternative': 'door',
  'false-alarm': 'bell',
  'call-false-alarm': 'phone',
  'call-hung-up': 'phone',
  'call-dropped': 'phone',
  distribution: 'network',
  'stream-gauge': 'meter',
  'water-truck': 'truck',
  food: 'utensils',
  beer: 'cup',
  'beer-can': 'cup',
  coffee: 'cup',
  'coffee-or-tea': 'cup',
  breakfast: 'cup',
  pizza: 'pizza',
  italian: 'pizza',
  chinese: 'utensils',
  indian: 'utensils',
  mediterranean: 'utensils',
  mexican: 'utensils',
  sushi: 'utensils',
  thai: 'utensils',
  steak: 'utensils',
  cocktail: 'wine',
  'bar-or-pub': 'wine',
  bottle: 'wine',
  grapes: 'flower',
  bakery: 'shop',
  hamburger: 'shop',
  'amusement-park': 'stadium',
  casino: 'ball',
  'bowling-alley': 'ball',
  curling: 'ball',
  'conference-room': 'people',
  'community-center': 'people',
  fair: 'flag',
  'exposition-center': 'building',
  campfire: 'flame',
  'splash-pad': 'water',
  'ferris-wheel': 'circle',
  playground: 'home',
  canopy: 'tent',
  cabana: 'tent',
  gazebo: 'home',
  'staff-housing': 'home',
  shed: 'home',
  neighborhood: 'building',
  'community-events': 'flag',
  grandstand: 'stadium',
  bleacher: 'bench',
  stage: 'podium',
  'stage-lighting': 'lightbulb',
  'strobe-light': 'lightbulb',
  laser: 'lightning',
  'guest-services': 'information',
  'muster-point': 'people',
  'lost-and-found': 'search',
  vendor: 'shop',
  pot: 'cup',
  'bag-check': 'box',
  'ticket-check': 'ticket',
  'security-sign': 'shield',
  'vehicle-checkpoint': 'car',
  fireworks: 'star',
  'jersey-barrier': 'barrier',
  'highway-message-board': 'road-sign',
  'street-lamp': 'electric-pole',
  'wire-down': 'electric-pole',
  solar: 'solar',
  geothermal: 'thermometer',
  windmill: 'windmill',
  telecom: 'antenna',
  culvert: 'water',
  'service-request': 'clipboard',
  'treatment-exemptions': 'scales',
  mortgage: 'home',
  'polling-place': 'check',
  'key-access': 'key',
  'key-no-access': 'lock',
  gateway: 'door',
  'gateway-2': 'door',
  bollard: 'construction-cone',
  'garage-door': 'door',
  'vacant-lot': 'square',
  chemicals: 'lab-flask',
  'pesticide-discharge': 'lab-flask',
  biomass: 'leaf',
  blight: 'warning',
  bluetooth: 'network',
  'sd-card': 'file',
  'serial-port': 'plug',
  rfid: 'sensor',
  'usb-security-key': 'key',
  'reference-chip': 'square',
  keypad: 'grid-3',
  beacon: 'antenna',
  radio: 'antenna',
  lightbulb: 'lightbulb',
  battery: 'battery',
  'total-station': 'gps-receiver',
  rangefinder: 'binoculars',
  'gps-receiver': 'gps-receiver',
  'drone-quadcopter': 'satellite',
  'drone-quadcopter-top': 'satellite',
  'drone-fixed-wing': 'airplane',
  'drone-flying-wing': 'airplane',
  'smart-camera': 'camera',
  'camera-sensor': 'camera',
  soccer: 'ball',
  'aerial-image': 'image',
  footprint: 'paw',
  'human-footprints': 'walking',
  'vehicle-tracks': 'car',
  'ufo-uap': 'satellite',
  bear: 'bear',
  rhino: 'cow',
  'big-foot': 'paw',
  'marine-mammal': 'fish',
  'widget-place-holder': 'square',
  empty: 'square',
  none: 'slash',
  null: 'slash',
  blank: 'square',
  temporary: 'clock',
  'directional-navigation': 'compass',
  'sequential-navigation': 'arrow-right',
  online: 'globe',
  offline: 'wifi',
  'actual-size': 'bounding-box',
  'full-screen': 'bounding-box',
  fullscreen: 'bounding-box',
  'fullscreen-view': 'bounding-box',
  maximum: 'arrow-up',
  minimum: 'arrow-down',
  move: 'arrows-move',
  drag: 'arrows-move',
  'spatial-analysis-tool': 'analysis',
  extent: 'bounding-box',
  selection: 'bounding-box',
  select: 'bounding-box',
  'cursor-selection': 'cursor',
  'white-cursor-selection': 'cursor',
  'lasso-select': 'lasso',
  'rectangle-area': 'square',
  'rectangle-plus': 'square',
  'polygon-area': 'polygon',
  'circle-area': 'circle',
  'circle-inset-large': 'circle',
  'circle-inset-medium': 'circle',
  'circle-inset-small': 'circle',
  area: 'polygon',
  'area-hash-filled': 'polygon',
  'hillshade-effect': 'hillshade',
  hillshade: 'hillshade',
  'line-straight': 'polyline',
  line: 'polyline',
  'freehand-line': 'polyline',
  'freehand-area': 'polygon',
  'line-of-sight': 'bearing',
  'distance-type': 'measure-distance',
  'measure-line': 'measure-distance',
  measure: 'ruler',
  wms: 'layers',
  wfs: 'vector-layer',
  wmts: 'tile-grid',
  geojson: 'polygon',
  kml: 'map',
  csv: 'table',
  'feature-service': 'vector-layer',
  geometry: 'polygon',
  geoenrichment: 'spatial-join',
  geocoding: 'map-pin',
  utility: 'network',
  'data-scene': 'terrain',
  'scene-view': 'terrain',
  'scene-service': 'terrain',
  'raster-tool': 'raster-grid',
  'raster-analysis': 'raster-grid',
  'raster-function': 'raster-grid',
  'new-raster-function-template': 'raster-grid',
  analysis: 'buffer',
  analyze: 'buffer',
  model: 'network',
  'new-model': 'network',
  'new-training': 'brain',
  'deep-learning': 'brain',
  retrain: 'brain',
  'model-history': 'clock',
  'review-map': 'map',
  explore: 'compass',
  '2d-explore': 'map',
  pins: 'map-pin',
  'map-space': 'map',
  'map-information': 'map',
  'map-level-settings': 'map',
  'no-map': 'map',
  'pin-plus': 'map-pin',
  'line-check': 'polyline',
  'vertex-check': 'vertex',
  'vertex-edit': 'edit-vertex',
  'vertex-gps': 'vertex',
  'vertex-move': 'vertex',
  'vertex-plus': 'add-vertex',
  'vertex-x': 'remove-vertex',
  rings: 'buffer',
  'buffer-point': 'buffer',
  'buffer-polyline': 'polyline',
  'buffer-polygon': 'polygon',
  'dissolve-features': 'dissolve',
  'dissolve-boundaries': 'dissolve',
  'split-features': 'split-line',
  'split-geometry': 'split-line',
  'overlap-features': 'intersect',
  'overlay-layers': 'intersect',
  'merge-layers': 'layers',
  'generate-tessellations': 'raster-grid',
  'find-point-clusters': 'multi-point',
  'calculate-density': 'point-cloud',
  'find-similar-locations': 'multi-point',
  'interpolate-points': 'multi-point',
  'generate-travel-areas': 'geofence',
  'calculate-travel-cost': 'route',
  'choose-best-facilities': 'map-pin',
  'plan-routes': 'route',
  'extract-data': 'database',
  attribute: 'table',
  'attribute-selection': 'table',
  'extent-filter': 'map',
  'map-view': 'map',
  'web-map': 'map',
  'web-scene': 'terrain',
  'data-map': 'map',
  'data-point': 'point',
  'data-line': 'polyline',
  'data-polygon': 'polygon',
  basemap: 'map',
  'along-path': 'route',
  path: 'route',
  'trace-path': 'route',
  'trace-path-complete': 'route',
  traverse: 'route',
  'rural-driving-distance': 'road',
  'rural-driving-time': 'car',
  'driving-distance': 'road',
  'driving-time': 'car',
  'trucking-distance': 'road',
  'trucking-time': 'truck',
  'walking-distance': 'walking',
  'walking-time': 'walking',
  'drive-time': 'route',
  'drive-time-largest': 'route',
  'drive-time-smallest': 'route',
  'drive-time-threshold': 'route',
  'drive-time-x-bar': 'route',
  'route-point': 'map-pin',
  'route-from': 'route',
  'route-to': 'route',
  'spatial-reference': 'globe',
  'coordinate-system': 'globe',
  'compass-north-circle': 'compass',
  'compass-needle': 'compass',
  'north-arrow': 'north-arrow',
  compass: 'compass',
  crosshair: 'locate',
  'gps-on': 'locate',
  'gps-off': 'locate',
  raster: 'raster-grid',
  'data-raster': 'raster-grid',
  'image-layer': 'image',
  'image-collection': 'image',
  'oriented-imagery': 'aerial-image',
  'point-cloud': 'point-cloud',
  'spatial-data': 'spatial-database',
  annotation: 'pencil',
  'storage-electrical': 'battery',
  'animal-cruelty': 'paw',
  hunting: 'deer',
  'hunting-safety': 'shield',
  'trap-set': 'square',
  'trail-cam': 'camera',
  'large-animal-shelter': 'home',
  'bird-tagging-violation': 'bird',
  'duck-blind': 'bird',
  'float-blind': 'bird',
  'tree-stand': 'tree',
  'box-stand': 'home',
  'social-media': 'speech-bubble',
  blog: 'speech-bubble',
  geonet: 'network',
  'geonet-question': 'network',
  fingerprint: 'fingerprint',
  theta: 'circle',
  'user-risk': 'person',
  org: 'network',
  organization: 'network',
  hierarchy: 'network',
  entity: 'network',
  'knowledge-graph': 'network',
  'link-chart': 'network',
  'model-edit': 'network',
  graph: 'network',
  flowchart: 'network',
  'workflow-diagram': 'network',
  'community-detection': 'network',
  'collaboration-distributed': 'network',
  'code-branch': 'network',
  branch: 'network',
  'tree-map': 'grid',
  'heat-chart': 'grid-3',
  'calendar-heat-chart': 'calendar',
  'matrix-heat-chart': 'grid-3',
  'gau ge': 'meter',
  gauge: 'meter',
  'gauge-summary': 'meter',
  'radar-chart': 'compass',
  'sky-plot': 'compass',
  'radial-tree-link-chart-layout': 'network',
  'hierarchical-link-chart-layout': 'network',
  'force-directed-link-chart-layout': 'network',
  'simple-link-chart-layout': 'network',
  'smart-tree-link-chart-layout': 'network',
  'geographic-link-chart-layout': 'network',
  'community-link-chart-layout': 'network',
  'multi-timeline': 'clock',
  'single-timeline': 'clock',
  infographic: 'chart-bar',
  'data-card': 'table',
  catalog: 'folder',
  'catalog-dataset': 'database',
  collection: 'folder',
  schema: 'database',
  domain: 'database',
  'coded-value-domain': 'list',
  'range-domain': 'slider',
  'contingent-values': 'list',
  'form-dropdown': 'form',
  'form-field': 'form',
  'form-field-multiline': 'form',
  'form-elements': 'form',
  'group-form': 'form',
  'smart-form': 'form',
  'field-groups': 'form',
  'sub-fields': 'form',
  'variable-generic': 'code',
  expression: 'code',
  'expression-defined-color': 'palette',
  function: 'code',
  'function-editor': 'code',
  number: 'text',
  'number-set': 'text',
  string: 'text',
  'string-set': 'text',
  integer: 'text',
  'integer-set': 'text',
  'double-float': 'text',
  'double-float-set': 'text',
  boolean: 'toggle',
  binary: 'code',
  parameters: 'slider',
  'profile-variables': 'slider',
  'feature-details': 'list',
  'feature-details-set': 'list',
  metadata: 'file',
  playback: 'play',
  beginning: 'play',
  end: 'play',
  forward: 'play',
  reverse: 'play',
  'stop-square': 'stop',
  transcript: 'list',
  'closed-caption': 'text',
  'frame-export': 'image',
  gradient: 'palette',
  transparency: 'circle',
  contrast: 'sun',
  'color-correction': 'palette',
  effects: 'magic-wand',
  styling: 'palette',
  'color-more': 'palette',
  colors: 'palette',
  theme: 'palette',
  custom: 'gear',
  toolbox: 'wrench',
  tools: 'wrench',
  magic: 'magic-wand',
  'hand-draw': 'hand',
  pan: 'hand',
  'pan-drag': 'hand',
  tour: 'map-pin',
  'tour-pin-tear': 'map-pin',
  'information-two': 'information',
  'question-two': 'question',
  'exclamation-point-two': 'warning',
  'annotation-tool': 'pencil',
  'annotate-tool': 'pencil',
  bim: 'building',
  'building-component': 'building',
  'building-group': 'building',
  'building-scene': 'building',
  '3d-building-parameter': 'building',
  'streetlight-electrical': 'electric-pole',
  'fire-index': 'flame',
  'building-index': 'building',
  'geology-index': 'mountain',
  'soil-adjusted-vegetation-index': 'leaf',
  'vegetation-index': 'leaf',
  sun: 'sun',
  'snow-thunder': 'snowflake',
  'rain-thunder': 'rain',
  'rain-snow': 'rain',
  rain: 'rain',
  'heavy-rain': 'rain',
  'light-rain': 'rain',
  'heavy-snow': 'snowflake',
  'light-snow': 'snowflake',
  weather: 'sun',
  'weather-radar': 'compass',
  'key-no-access': 'lock',
  wellhead: 'pipe',
  'attic-access': 'door',
  'basement-access': 'door',
  'alarm-other': 'bell',
  'alarm-control-panel': 'panel',
  occupancies: 'people',
  'person-waving': 'person',
  clothes: 'person',
  coast: 'water',
  'entry-point-alternative': 'door',
  'entry-point-primary': 'door',
  'food-storage': 'box',
  'recreation-fixtures': 'bench',
  highlighter: 'pencil',
  'highlighter-tip': 'pencil',
  'brush-tip': 'brush',
  'brush-mark': 'brush',
  'pen-tip': 'pencil',
  'pen-mark': 'pencil',
  'pencil-tip': 'pencil',
  pen: 'pencil',
  'paint-bucket': 'palette',
  'swatch-palette': 'palette',
  paste: 'clipboard',
  erase: 'close',
  'read-only-non-editable': 'lock',
  'construction-supplies': 'hammer',
  repair: 'wrench',
  shortcut: 'external',
  publish: 'upload',
  submit: 'upload',
  send: 'airplane',
  preserve: 'save',
  'image-navigation': 'image',
  overview: 'panel',
  plans: 'map',
  footprint: 'paw',
  'floor-plan': 'panel',
  'screenshot-mode': 'bounding-box',
  'all-servers': 'server',
  applications: 'grid',
  apps: 'grid',
  application: 'grid',
  'app-launcher': 'grid',
  window: 'panel',
  browser: 'panel',
  'embedded-content': 'panel',
  'embedded-card': 'panel',
  'embedded-live-content': 'panel',
  'view-card': 'panel',
  'view-list': 'list',
  column: 'panel',
  row: 'panel',
  'carousel-frames': 'panel',
  sidecar: 'panel',
  gallery: 'grid',
  'widgets-group': 'grid',
  'widgets-tabs': 'panel',
  tabs: 'panel',
  'tabbed-view': 'panel',
  slideshow: 'panel',
  presentation: 'monitor',
  'live-view-setting': 'monitor',
  insets: 'bounding-box',
  block: 'panel',
  'screen-group': 'monitor',
  splash: 'image',
  'cookie-banner': 'panel',
  'theme-mode-switcher': 'sun',
  'form-field-off': 'form',
  'email-circle': 'mail',
  page: 'file',
  document: 'file',
  'text-page': 'file',
  detail: 'list',
  draft: 'file',
  published: 'upload',
  'unpublished-changes': 'file',
  new: 'plus',
  'start-end': 'route',
  embed: 'code',
  'embed-circle': 'code',
  'share-text': 'share',
  subscriber: 'person',
  'tool-align': 'slider',
  'text-outline': 'text',
  'data-invisible': 'eye',
  'data-visible': 'eye',
  'view-visible': 'eye',
  'view-hide': 'eye',
  'view-mixed': 'eye',
  visible: 'eye',
  invisible: 'eye',
  notification: 'bell',
  day: 'sun',
  night: 'moon',
  'tool-history': 'clock',
  'load-configuration': 'gear',
  'job-dependency': 'network',
  query: 'search',
  'stored-query': 'search',
  'processing-templates': 'file',
  'processing-template': 'file',
  'project-template': 'file',
  project: 'folder',
  projects: 'folder',
  'project-mission': 'flag',
  initiative: 'flag',
  'initiative-template': 'flag',
  processing: 'gear',
};
drawn(
  'cube',
  polygon(2, 6, 10, 2, 18, 6, 18, 15, 10, 19, 2, 15),
  line(2, 6, 10, 10, 18, 6),
  line(10, 10, 10, 19),
);
drawn('stair', line(2, 18, 2, 14, 6, 14, 6, 10, 10, 10, 10, 6, 14, 6, 14, 2, 18, 2));
drawn('road-sign', polygon(2, 4, 15, 4, 19, 8, 15, 12, 2, 12), line(9, 12, 9, 18));
drawn('question', circle(10, 10, 8), 'M 7 7 C 7 3 15 3 13 8 L 10 11 V 12', line(10, 15, 10, 15.1));
drawn('slash', line(3, 17, 17, 3));
register('text', lettering('T', 3, 4, 12), 'Typography');
register(
  'arrows-move',
  path(
    line(10, 2, 10, 18) +
      line(2, 10, 18, 10) +
      line(7, 5, 10, 2, 13, 5) +
      line(7, 15, 10, 18, 13, 15) +
      line(5, 7, 2, 10, 5, 13) +
      line(15, 7, 18, 10, 15, 13),
  ),
);
const shapeNames = new Set([
  'circle',
  'square',
  'rectangle',
  'ellipse',
  'triangle',
  'diamond',
  'hexagon',
  'pentagon',
  'octagon',
  'rounded-rectangle',
]);
function arrowIcon(name) {
  const direction = (name.match(/(?:up|down|left|right)(?:-(?:left|right))?/) || [])[0] || 'right';
  let kind = /chevron|caret|small/.test(name)
    ? /caret/.test(name)
      ? 'caret'
      : 'chevron'
    : 'arrow';
  let body = arrow(direction, kind);
  if (/double|chevrons|left-left|right-right/.test(name))
    body = transform(body, -3, 0, 0.7) + transform(body, 4, 0, 0.7);
  if (/circle/.test(name)) body = path(circle(10, 10, 8.5)) + transform(body, 4, 4, 0.6);
  if (/up-down|left-right|right-left/.test(name))
    body =
      transform(arrow(direction), 0, -3, 0.8) +
      transform(arrow(direction === 'up' ? 'down' : 'left'), 4, 7, 0.8);
  if (/curve|turn|redo|undo|fork|bear|ramp|merge-on-highway/.test(name)) {
    const left = /left|undo/.test(name);
    body = path(
      line(10, 18, 10, 9, left ? 3 : 17, 9) +
        line(left ? 6 : 14, 5, left ? 2 : 18, 9, left ? 6 : 14, 13),
    );
  }
  return art('direction-' + name, body, 'Navigation');
}
function diagram(name) {
  if (/grid|tessellat|matrix|heat-chart|pixel|raster/.test(name)) {
    const nums = { one: 1, two: 2, three: 3, four: 4 };
    const m = name.match(/(one|two|three|four)-by-(one|two|three|four)/);
    let body = m
      ? grid(nums[m[1]], nums[m[2]])
      : grid(/two|2x/.test(name) ? 2 : 3, /two|2x/.test(name) ? 2 : 3);
    if (/plus|add/.test(name)) return badge(art('raster-grid', body), 'plus');
    if (/history/.test(name)) return badge(art('raster-grid', body), 'clock');
    if (/lock/.test(name)) return badge(art('raster-grid', body), 'lock');
    if (/analysis|function/.test(name)) return compose(art('raster-grid', body), get('code'));
    if (/maximum/.test(name)) return badge(art('raster-grid', body), 'up');
    if (/minimum/.test(name)) return badge(art('raster-grid', body), 'down');
    if (/mean|sum/.test(name))
      return compose(art('raster-grid', body), textGlyph(/mean/.test(name) ? 'M' : '+'));
    return art('grid-' + (m ? m[0] : name), body, 'Data & layouts');
  }
  if (
    /network|graph|entities|relationships|link-chart|node|associations|path-waypoint/.test(name)
  ) {
    let g = get(
      /chart|graph/.test(name) && !/network|knowledge|link-chart|nodes|workflow/.test(name)
        ? 'chart-line'
        : 'network',
    );
    if (/export/.test(name)) return badge(g, 'up');
    if (/import/.test(name)) return badge(g, 'down');
    if (/hide|exclude|remove|uncollapse|unlink|unmerge/.test(name)) return badge(g, 'minus');
    if (/new|add|expand|increase|connect|mandatory/.test(name)) return badge(g, 'plus');
    if (/find|search/.test(name)) return badge(g, 'search');
    if (/collapse|decrease/.test(name)) return badge(g, 'minus');
    if (/edit|tools/.test(name)) return badge(g, 'edit');
    return g;
  }
  if (/chart|graph|timeline|moving-average/.test(name)) {
    let base = /pie|chord/.test(name)
      ? get('chart-pie')
      : /scatter|plot|dispersion/.test(name)
        ? get('chart-scatter')
        : /line|time|moving/.test(name)
          ? get('chart-line')
          : /box/.test(name)
            ? get('table')
            : get('chart-bar');
    if (/gear/.test(name)) base = badge(base, 'gear');
    if (/search|magnifying/.test(name)) base = badge(base, 'search');
    if (/maximum/.test(name)) base = badge(base, 'up');
    if (/minimum/.test(name)) base = badge(base, 'down');
    return base;
  }
  return null;
}
const seen = new Set();
export function resolveGlyph(name, entry = {}, depth = 0) {
  if (depth > 7) return null;
  name = normalized(name)
    .replace(
      /^(?:filled|outlined)-(?:application|brand|data|directional|editor|suggested|gis)-/,
      '',
    )
    .replace(/-f$/, '');
  if (/-rtl$/.test(name)) {
    const g = resolveGlyph(name.slice(0, -4), entry, depth + 1);
    return (
      g &&
      art(g.key + '-rtl', `<g transform="translate(20 0) scale(-1 1)">${g.body}</g>`, g.category)
    );
  }
  if (name.startsWith('widget-')) return resolveGlyph(name.slice(7), entry, depth + 1);
  const extended = resolveExtension(name, entry, resolveGlyph, depth);
  if (extended) return extended;
  if (/^number-circle-[0-9]$/.test(name))
    return art(name, path(circle(10, 10, 8.5)) + lettering(name.slice(-1), 3, 6, 8), 'Numbers');
  if (/^[a-z0-9]$/.test(name)) return textGlyph(name);
  if (/^(?:1-2|1-4|1-8|1|2|4|8)x$/.test(name)) return textGlyph(name.replace(/^1-/, '1/'));
  if (/-text$/.test(name) && entry.collection === 'calcite-point')
    return art(
      'road-marking-' + name,
      lettering(
        name
          .replace(/-text$/, '')
          .replace(/-/g, ' ')
          .slice(0, 5),
        3,
        6,
        8,
      ),
      'Road markings',
    );
  if (/^(a3|a4|ansi-[ab]|custom-print)-(portrait|landscape)$/.test(name)) {
    const landscape = name.endsWith('landscape');
    return art(
      name,
      path(
        rect(landscape ? 2 : 4, landscape ? 4 : 2, landscape ? 16 : 12, landscape ? 12 : 16, 0),
      ) + lettering(name.startsWith('ansi') ? name.slice(5, 6) : name.slice(0, 2), 3, 7, 6),
      'Documents',
    );
  }
  if (
    /^(arrow|chevron|chevrons|caret|bear|fork|ramp|sharp|u-turn|left|right|straight|through-lane|wrong-way|exit-highway|merge-on-highway|round-about|center-horizontal|center-vertical|up-|down-|top-|bottom-)/.test(
      name,
    ) ||
    /turn-arrow|direction-arrows/.test(name)
  )
    return arrowIcon(name);
  if (
    /^align-|distribute|space-around|space-between|spaced-evenly|stretch-horizontal|stretch-vertical/.test(
      name,
    )
  ) {
    const horizontal = /horizontal|left|right/.test(name);
    const positions = /right|bottom/.test(name)
      ? [14, 14, 14]
      : /center|evenly/.test(name)
        ? [6, 4, 7]
        : [2, 2, 2];
    let d = line(horizontal ? 1 : 2, horizontal ? 2 : 1, horizontal ? 1 : 18, horizontal ? 18 : 1);
    for (let i = 0; i < 3; i++) {
      const x = horizontal ? positions[i] : 3 + i * 5,
        y = horizontal ? 3 + i * 5 : positions[i];
      d += rect(x, y, horizontal ? [11, 7, 9][i] : 3, horizontal ? 3 : [11, 7, 9][i], 0.2);
    }
    return art(name, path(d), 'Alignment');
  }
  if (shapeNames.has(name)) return get(name);
  if (
    /^(circle|square|diamond|hexagon|hexagon-2|polygon|trapezoid|rectangle|pie-chart-section|triangle|circle-ring)(-area|-hash|-inset|-ring|-ellipse|-small|-sections|-hollow|-2)/.test(
      name,
    )
  ) {
    const shape = name.split('-')[0];
    let body = get(shape)?.body || get('polygon').body;
    if (/inset|ring/.test(name)) body += transform(body, 5, 5, 0.5);
    if (/hash|sections/.test(name)) body += path(line(5, 13, 13, 5) + line(8, 15, 15, 8));
    if (/plus/.test(name)) return badge(art(name, body), 'plus');
    return art(name, body, 'Shapes');
  }
  if (/^file-(?!user)/.test(name)) {
    const ext = name.slice(5);
    const symbol = /image|video|sound|code|data/.test(ext)
      ? get(ext === 'sound' ? 'volume' : ext)
      : null;
    if (symbol) return compose(get('file'), symbol);
    if (/magnifying-glass|search/.test(ext)) return badge(get('file'), 'search');
    if (/pdf-plus/.test(ext)) return badge(compose(get('file'), textGlyph('PDF')), 'plus');
    return art(
      'file-' + ext,
      get('file').body + lettering(ext.replace('archive', 'ZIP').slice(0, 3), 3, 10, 5),
      'Files',
    );
  }
  if (
    /^(layer|feature-layer|data-layer|tile-layer|image-layer|scene-layer|video-layer|knowledge-layer|oriented-imagery-layer|livestream-video-layer|utility-network-layer|parcel-layer)/.test(
      name,
    )
  ) {
    let base = get('layers');
    const mark = /polygon|multipatch|geojson|shape/.test(name)
      ? get('polygon')
      : /point/.test(name)
        ? get('point')
        : /line|route/.test(name)
          ? get('polyline')
          : /tile|raster|wms|wcs|wfs/.test(name)
            ? get('raster-grid')
            : /image|imagery/.test(name)
              ? get('image')
              : /video|media|stream/.test(name)
                ? get('video')
                : /3d|scene/.test(name)
                  ? get('cube')
                  : /network|connection|knowledge/.test(name)
                    ? get('network')
                    : /csv|kml|ogc|parquet|georss/.test(name)
                      ? textGlyph(
                          (name.match(/csv|kml|ogc|parquet|georss/) || ['DB'])[0].slice(0, 3),
                        )
                      : null;
    if (/add|plus/.test(name)) return badge(base, 'plus');
    if (/hide|broken/.test(name)) return slash(base);
    if (/edit/.test(name)) return badge(base, 'edit');
    if (/check/.test(name)) return badge(base, 'check');
    if (/filter/.test(name)) return badge(base, 'filter');
    if (/zoom/.test(name)) return badge(base, 'search');
    if (/setting/.test(name)) return badge(base, 'gear');
    if (mark) return compose(base, mark);
    if (/group|set|multiple/.test(name)) return repeated(base);
    return base;
  }
  if (
    /^p-(anomaly|identified-issue|ili|inspection-note|pipe|pipeline|calibration|coupon|dasurvey|document|elevation|gas|liquid|squeeze)/.test(
      name,
    )
  ) {
    const subject = name.replace(/^p-/, '');
    const base = /pipe|anomaly|corrosion|dent|gouge|squeeze/.test(subject)
      ? get('pipe')
      : /elevation/.test(subject)
        ? get('elevation-profile')
        : /document|note|reading|survey/.test(subject)
          ? get('clipboard')
          : get('map-pin');
    const mark = /corrosion|metal-loss/.test(subject)
      ? get('blood-drop')
      : /dent|damag|gouge|crack/.test(subject)
        ? get('warning')
        : /gas|liquid|hydro/.test(subject)
          ? get('blood-drop')
          : /vegetation|environment/.test(subject)
            ? get('plant')
            : /maintenance/.test(subject)
              ? get('wrench')
              : /crossing/.test(subject)
                ? get('plus')
                : /unknown/.test(subject)
                  ? get('question')
                  : get('point');
    return compose(base, mark);
  }
  if (/^(non-controllable|controllable)-fitting/.test(name)) {
    const shape = /elbow/.test(name)
      ? line(3, 3, 3, 13, 17, 13)
      : /tee/.test(name)
        ? line(2, 10, 18, 10) + line(10, 2, 10, 18)
        : /coupling|transition/.test(name)
          ? line(2, 10, 18, 10) + rect(7, 5, 6, 10, 0.3)
          : /reducer/.test(name)
            ? polygon(2, 5, 8, 5, 12, 8, 18, 8, 18, 12, 12, 12, 8, 15, 2, 15)
            : /end-cap/.test(name)
              ? line(2, 10, 12, 10) + line(12, 4, 12, 16)
              : line(2, 7, 18, 7) + line(2, 13, 18, 13) + line(8, 4, 8, 16) + line(12, 4, 12, 16);
    return art(name, path(shape), 'Utilities');
  }
  if (/-bank$/.test(name)) {
    const base = resolveGlyph(name.slice(0, -5), entry, depth + 1);
    if (base) return repeated(base);
  }
  if (
    /(?:-off$|^no-|^unselected|unavailable|disallowed|no-access|closed|failure|violation|unlawful|illegal|unauthorized|trespass|no-map)/.test(
      name,
    )
  ) {
    let raw = name
      .replace(/^(?:no|unlawful|illegal|unauthorized)-/, '')
      .replace(/-off$|unavailable|disallowed|no-access|closed|failure/g, '')
      .replace(/^-|-$/g, '');
    let base = raw !== name ? resolveGlyph(raw, entry, depth + 1) : null;
    if (!base) {
      const subjects = [
        'bird',
        'fish',
        'animal',
        'plant',
        'tree',
        'person',
        'hunting',
        'vehicle',
        'motor',
        'crab',
        'noise',
        'propane',
        'metal',
        'entrance',
        'area',
      ];
      const hit = subjects.find((x) => name.includes(x));
      const map = {
        animal: 'paw',
        hunting: 'deer',
        vehicle: 'car',
        motor: 'car',
        noise: 'volume',
        metal: 'sensor',
        entrance: 'door',
        area: 'polygon',
        propane: 'tank',
      };
      if (hit) base = get(map[hit] || hit);
    }
    if (base) return slash(base);
  }
  if (/(?:^add-|^new-|^create-|^insert-|-plus$|-new$|-add$)/.test(name)) {
    const raw = name
      .replace(/^(add|new|create|insert)-(?:to-)?/, '')
      .replace(/-(plus|new|add)$/, '');
    const base = resolveGlyph(raw, entry, depth + 1);
    if (base) return badge(base, 'plus');
  }
  if (
    /^(remove|delete|clear|hide|show|view|edit|check|select|filter|update|configure|merge|split|convert|change|copy|paste|move|increase|decrease|enable|disable|replace|apply|assign|register|unregister|load|overwrite|retrain|unmerge|unpin|pin)-/.test(
      name,
    )
  ) {
    const verb = name.split('-')[0],
      raw = name.slice(verb.length + 1).replace(/^(?:from|to|and|all|the)-/, '');
    let base = resolveGlyph(raw, entry, depth + 1);
    if (!base && raw.endsWith('s')) base = resolveGlyph(raw.slice(0, -1), entry, depth + 1);
    if (base) {
      if (['hide', 'disable'].includes(verb)) return slash(base);
      return badge(
        base,
        {
          remove: 'minus',
          delete: 'x',
          clear: 'x',
          show: 'check',
          view: 'search',
          edit: 'edit',
          check: 'check',
          select: 'check',
          filter: 'filter',
          update: 'up',
          configure: 'gear',
          merge: 'plus',
          split: 'minus',
          convert: 'up',
          change: 'edit',
          copy: 'plus',
          paste: 'plus',
          move: 'up',
          increase: 'plus',
          decrease: 'minus',
          enable: 'check',
          replace: 'edit',
          apply: 'check',
          assign: 'check',
          register: 'plus',
          unregister: 'minus',
          load: 'down',
          overwrite: 'edit',
          unmerge: 'minus',
          unpin: 'minus',
          pin: 'plus',
        }[verb] || 'edit',
      );
    }
  }
  if (
    /-(check|plus|minus|x|lock|unlock|gear|settings|setting|filter|search|magnifying-glass|clock|calendar|history|play|pause|edit|new|view|up|down|save|user|person|circle|square|group|set|multiple)$/.test(
      name,
    )
  ) {
    const m = name.match(
      /-(check|plus|minus|x|lock|unlock|gear|settings|setting|filter|search|magnifying-glass|clock|calendar|history|play|pause|edit|new|view|up|down|save|user|person|circle|square|group|set|multiple)$/,
    );
    const raw = name.slice(0, -m[0].length),
      base = resolveGlyph(raw, entry, depth + 1);
    if (base) {
      const mod = m[1];
      if (['circle', 'square'].includes(mod)) return enclosure(base, mod);
      if (['group', 'set', 'multiple'].includes(mod)) return repeated(base);
      return badge(
        base,
        {
          settings: 'gear',
          setting: 'gear',
          calendar: 'clock',
          history: 'clock',
          pause: 'minus',
          view: 'search',
          save: 'check',
          new: 'plus',
          user: 'person',
          unlock: 'lock',
          'magnifying-glass': 'search',
        }[mod] || mod,
      );
    }
  }
  if (
    /^(?:folder|browser|user|person|camera|clipboard|table|map|cloud|server|network|data|graph|image|video|sound|speech-bubble|text|pencil|brush|pen|hammer|shield|hand|box|battery|calendar|date|clock|sensor|valve|pump|tank)-/.test(
      name,
    )
  ) {
    const roots = [
      'speech-bubble',
      'folder',
      'browser',
      'user',
      'person',
      'camera',
      'clipboard',
      'table',
      'map',
      'cloud',
      'server',
      'network',
      'data',
      'graph',
      'image',
      'video',
      'sound',
      'text',
      'pencil',
      'brush',
      'pen',
      'hammer',
      'shield',
      'hand',
      'box',
      'battery',
      'calendar',
      'date',
      'clock',
      'sensor',
      'valve',
      'pump',
      'tank',
    ];
    const root = roots.find((x) => name.startsWith(x + '-'));
    const base = resolveGlyph(root, entry, depth + 1),
      suffix = name.slice(root.length + 1);
    const mark = resolveGlyph(suffix, entry, depth + 1);
    if (base && mark) return compose(base, mark);
  }
  if (simpleAliases[name] && simpleAliases[name] !== name) {
    const alias = resolveGlyph(simpleAliases[name], entry, depth + 1);
    if (alias) return alias;
  }
  const exact = get(name);
  if (exact) return exact;
  const d = diagram(name);
  if (d) return d;
  if (/server$|data-store$|endpoint$|service$/.test(name)) {
    const mark =
      /image|video|scene|geoevent|geoanalytics|gis|spatiotemporal|knowledge|workflow|mission|notebook/.test(
        name,
      )
        ? /image/.test(name)
          ? get('image')
          : /video/.test(name)
            ? get('video')
            : /knowledge|workflow/.test(name)
              ? get('network')
              : /notebook/.test(name)
                ? get('file')
                : get('map')
        : null;
    return mark ? compose(get('server'), mark) : get('database');
  }
  if (/route|drive-time|rings|distance|elevation|territory/.test(name)) {
    const base = /elevation|altitude/.test(name)
      ? get('elevation-profile')
      : /rings|territory|buffer/.test(name)
        ? get('buffer')
        : /distance/.test(name)
          ? get('measure-distance')
          : get('route');
    const mark = /truck/.test(name)
      ? get('truck')
      : /walk/.test(name)
        ? get('walking')
        : /driv/.test(name)
          ? get('car')
          : null;
    return mark ? compose(base, mark) : base;
  }
  if (
    /template-group|point-at-|multiple-polygon|single-line-feature|two-point-lines|template|layout|content-|block-height|column-|row-|header|footer/.test(
      name,
    )
  ) {
    const base = /polygon/.test(name)
      ? get('polygon')
      : /line|point/.test(name)
        ? get('polyline')
        : /template/.test(name)
          ? get('file')
          : get('panel');
    if (/start/.test(name)) return badge(base, 'plus');
    if (/end/.test(name)) return badge(base, 'x');
    if (/buffer/.test(name)) return compose(base, get('buffer'));
    if (/every|multiple|group/.test(name)) return repeated(base);
    return base;
  }
  if (
    /^(?:text-|heading|subheading|subscript|superscript|string|integer|double-float|a-z|ltr-|rtl-|title|summary|n-variable|beta|gamma|pi|mu|sigma|percent|boolean|number|maximum|minimum|x-bar|strikethrough)/.test(
      name,
    )
  ) {
    if (/align|paragraph/.test(name)) {
      let d = '';
      for (let i = 0; i < 4; i++) {
        const len = i === 3 ? 9 : 16;
        const x = /right/.test(name) ? 18 - len : /center/.test(name) ? 10 - len / 2 : 2;
        d += line(x, 3 + i * 4, x + len, 3 + i * 4);
      }
      return art(name, path(d), 'Typography');
    }
    if (/bold/.test(name)) return get('bold');
    if (/under/.test(name)) return get('underline');
    if (/strike/.test(name)) return get('strike-through');
    const special = {
      beta: 'B',
      gamma: 'Y',
      pi: 'PI',
      mu: 'U',
      sigma: 'E',
      percent: '%',
      'x-bar': 'X',
      'a-z': 'AZ',
      'n-variable': 'N',
      number: '123',
      string: 'ABC',
      integer: '12',
      'double-float': '1.2',
      boolean: 'TF',
    };
    return textGlyph(
      special[name] ||
        (/heading|title/.test(name)
          ? 'H' + (name.match(/[1-5]/)?.[0] || '')
          : /small/.test(name)
            ? 'a'
            : /large/.test(name)
              ? 'A'
              : 'T'),
    );
  }
  if (/^(?:play|pause|end|beginning|reverse|forward|closed-caption|stop)/.test(name))
    return get(
      /pause/.test(name)
        ? 'pause'
        : /stop/.test(name)
          ? 'stop'
          : /caption/.test(name)
            ? 'text'
            : 'play',
    );
  if (
    /(?:arcgis|esri|exb-|autodesk|facebook|google-plus|instagram|linkedin|pinterest|rss|slack|twitter|knowledge-studio|living-atlas|open-data|tapestry|partnered-collaboration|mission-system-message|marketplace|mission)/.test(
      name,
    )
  ) {
    const abbr = name.includes('facebook')
      ? 'F'
      : name.includes('twitter')
        ? 'X'
        : name.includes('linkedin')
          ? 'IN'
          : name.includes('instagram')
            ? 'IG'
            : name.includes('esri')
              ? 'E'
              : name.includes('arcgis')
                ? 'AG'
                : name.includes('autodesk')
                  ? 'A'
                  : name.includes('slack')
                    ? 'S'
                    : name.includes('rss')
                      ? 'RSS'
                      : name.includes('google')
                        ? 'G'
                        : name.includes('pinterest')
                          ? 'P'
                          : 'APP';
    return art(
      'original-application-mark-' + normalized(abbr),
      path(rect(2, 2, 16, 16, 3)) + lettering(abbr, 3, 6, 8),
      'Applications',
    );
  }
  return null;
}
