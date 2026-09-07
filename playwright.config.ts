import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './out/e2e-results',
  workers: 1,
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:52010',
    channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome',
    headless: true,
    viewport: { width: 1280, height: 900 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npx vite --config vite.renderer.config.ts --host 127.0.0.1 --port 52010 --strictPort',
    url: 'http://127.0.0.1:52010',
    reuseExistingServer: false,
  },
});
