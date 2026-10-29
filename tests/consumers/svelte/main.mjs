import '@oddkin/tokens/css/default.css';
import '@oddkin/components/css/base.css';
import '@oddkin/components/css/layout.css';
import '@oddkin/components/define/card';
import '@oddkin/components/define/input';
import '@oddkin/components/define/checkbox';
import '@oddkin/components/define/button';
import { mount } from 'svelte';
import App from './App.svelte';

mount(App, { target: document.querySelector('#app') });
