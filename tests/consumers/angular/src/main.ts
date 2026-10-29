import '@oddkin/components/define/card';
import '@oddkin/components/define/input';
import '@oddkin/components/define/checkbox';
import '@oddkin/components/define/button';
import { provideZonelessChangeDetection } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { App } from './app';

bootstrapApplication(App, { providers: [provideZonelessChangeDetection()] }).catch(
  (error: unknown) => console.error(error),
);
