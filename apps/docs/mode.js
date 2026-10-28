// Applies the reader's stored light or dark choice before the first paint; src/shell.ts stores it.
try {
  const mode = localStorage.getItem('oddkin-docs-mode');
  if (mode === 'light' || mode === 'dark') document.documentElement.dataset.oddMode = mode;
} catch {
  // Storage can be unavailable (a privacy mode); the page follows the system setting.
}
