import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.tsx'],
  addons: [],
  core: { disableTelemetry: true },
  framework: { name: '@storybook/react-vite', options: {} },
  async viteFinal(cfg) {
    const { default: tailwindcss } = await import('@tailwindcss/vite');
    cfg.plugins = [...(cfg.plugins ?? []), tailwindcss()];
    return cfg;
  },
};
export default config;
