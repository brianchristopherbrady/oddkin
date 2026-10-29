// The probe behind a module graph that takes a while to load, like a cold, unbundled first preview.
import './probe-element.js';

await new Promise((resolve) => setTimeout(resolve, 1_500));
