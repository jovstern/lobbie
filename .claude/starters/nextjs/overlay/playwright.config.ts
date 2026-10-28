import { defineConfig, devices } from '@playwright/test'

const isCI = Boolean(process.env.CI)
const port = 3100

export default defineConfig({
  testDir: './e2e',
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${port}`,
    // Every run is recorded; the pr-demo skill turns a recording into the PR's demo GIF.
    video: { mode: 'on', size: { width: 1280, height: 720 } },
    viewport: { width: 1280, height: 720 },
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run build && npx next start --port ${port}`,
    url: `http://localhost:${port}`,
    // Always a fresh build: a server left running from an earlier run would test old code.
    reuseExistingServer: false,
    timeout: 180_000,
  },
})
