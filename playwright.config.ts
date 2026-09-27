import { defineConfig, devices } from '@playwright/test';

// Browser tests run against a production build with the device-only preview enabled,
// served like GitHub Pages. No credentials or network services are involved.
const phone = { viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30000,
  fullyParallel: true,
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure' },
  projects: [
    { name: 'iphone-webkit', use: { ...devices['iPhone 13'], ...phone } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'], ...phone } }
  ],
  webServer: {
    command: 'PUBLIC_LOCAL_PREVIEW=true BUILD_DIR=build-e2e npm run build && node scripts/serve-static.mjs build-e2e 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
    timeout: 120000
  }
});
