// Oddkin's own 20 px outline icons, copied from design/icons/general for the docs shell. They are
// decorative (aria-hidden): every control that shows one also has a text name.
export const icons = {
  search:
    '<svg class="icon" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><g transform="translate(-0.5000 -0.5000) scale(1.000000)"><path d="M 3 8 a 5 5 0 1 0 10 0 a 5 5 0 1 0 -10 0"></path><path d="M 12 12  L 18 18"></path></g></svg>',
  moon: '<svg class="icon" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><g transform="translate(-0.6762 0.4508) scale(1.000000)"><path d="M 14 2 A 8 8 0 1 0 18 14 A 8 8 0 0 1 14 2 Z"></path></g></svg>',
  sun: '<svg class="icon" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><g transform="translate(0.0000 0.0000) scale(1.000000)"><path d="M 6 10 a 4 4 0 1 0 8 0 a 4 4 0 1 0 -8 0"></path><path d="M 10 1.5  L 10 3"></path><path d="M 10 17  L 10 18.5"></path><path d="M 1.5 10  L 3 10"></path><path d="M 17 10  L 18.5 10"></path><path d="M 4 4  L 5 5"></path><path d="M 15 15  L 16 16"></path><path d="M 4 16  L 5 15"></path><path d="M 15 5  L 16 4"></path></g></svg>',
  menu: '<svg class="icon" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><g transform="translate(0.0000 0.0000) scale(1.000000)"><path d="M 2 4  L 18 4"></path><path d="M 2 10  L 18 10"></path><path d="M 2 16  L 18 16"></path></g></svg>',
  close:
    '<svg class="icon" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><g transform="translate(0.0000 0.0000) scale(1.000000)"><path d="M 4 4  L 16 16"></path><path d="M 16 4  L 4 16"></path></g></svg>',
  external:
    '<svg class="icon" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><g transform="translate(-0.5000 0.5000) scale(1.000000)"><path d="M 11 2  L 18 2 L 18 9"></path><path d="M 18 2  L 8 12"></path><path d="M 8 4  L 3 4 L 3 17 L 16 17 L 16 12"></path></g></svg>',
  arrowRight:
    '<svg class="icon" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><g transform="translate(0.0000 0.0000) scale(1.000000)"><g transform="rotate(0 10 10)"><path d="M 2 10  L 18 10M 12 4  L 18 10 L 12 16"></path></g></g></svg>',
} as const;

export type IconName = keyof typeof icons;
