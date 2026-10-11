import type { Preview } from '@storybook/react';
import './storybook.css';

// Viewports of 00-build-order §3 item 10: 1440 / 1024 / 390. Toolbar switch for RTL (Arabic).
const preview: Preview = {
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'ink', values: [{ name: 'ink', value: '#000000' }] },
    viewport: {
      viewports: {
        desktop: { name: '1440', styles: { width: '1440px', height: '900px' } },
        laptop: { name: '1024', styles: { width: '1024px', height: '768px' } },
        mobile: { name: '390', styles: { width: '390px', height: '844px' } },
      },
    },
  },
  globalTypes: {
    dir: { description: 'Direction', defaultValue: 'ltr', toolbar: { items: ['ltr', 'rtl'], dynamicTitle: true } },
  },
  decorators: [
    (Story, ctx) => {
      document.documentElement.dir = ctx.globals.dir;
      document.documentElement.lang = ctx.globals.dir === 'rtl' ? 'ar' : 'fr';
      return Story();
    },
  ],
};
export default preview;
