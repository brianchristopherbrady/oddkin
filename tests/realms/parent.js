// The page's realm: its own copy of @oddkin/core, the button and input it defines, and a signal
// another realm reads. The frame comes last, so its script finds this realm ready.
import * as core from '@oddkin/core';
import '@oddkin/components/define/button';
import '@oddkin/components/define/input';

globalThis.parentRealm = { core, count: core.signal(1) };

const frame = document.createElement('iframe');
frame.id = 'frame';
frame.title = 'Another realm';
frame.src = './frame.html';
document.querySelector('main').append(frame);
document.body.dataset.ready = 'true';
