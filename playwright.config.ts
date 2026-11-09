import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', timeout: 45000, fullyParallel: false, workers: 1,
  use: { baseURL: 'http://localhost:5000', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'], channel: 'chrome' } },
    { name: 'phone-webkit', use: { ...devices['iPhone 13'], defaultBrowserType: 'webkit' } },
  ],
});
