import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

// Oddkin's tags are custom elements, not Vue components.
export default defineConfig({
  base: './',
  plugins: [
    vue({ template: { compilerOptions: { isCustomElement: (tag) => tag.startsWith('odd-') } } }),
  ],
});
