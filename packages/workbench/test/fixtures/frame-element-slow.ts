// A registration whose module graph takes a while to load, like a cold, unbundled first preview.
import './frame-element.js';

await new Promise((resolve) => setTimeout(resolve, 2_500));
