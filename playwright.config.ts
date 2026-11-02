import { existsSync } from 'node:fs'
import { defineConfig, devices } from '@playwright/test'

// The e2e database URL lives in .env.local with the other secrets; loading it prints nothing.
if (existsSync('.env.local')) process.loadEnvFile('.env.local')

const e2eDatabaseUrl = process.env.E2E_DATABASE_URL
if (!e2eDatabaseUrl) {
  throw new Error(
    'E2E_DATABASE_URL is not set. Add the Neon test branch to .env.local (see .env.example); e2e never runs against DATABASE_URL.',
  )
}

const isCI = Boolean(process.env.CI)
const port = 3100

export default defineConfig({
  testDir: './e2e',
  // Migrates, resets and seeds the test branch, and empties the outbox.
  globalSetup: './e2e/global-setup.ts',
  // One shared database: tests run one at a time.
  workers: 1,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${port}`,
    // Every run is recorded; the pr-demo skill turns a recording into the PR's demo GIF.
    video: { mode: 'on', size: { width: 1280, height: 720 } },
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } },
    },
    {
      name: 'phone',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 360, height: 780 },
        isMobile: true,
        hasTouch: true,
        video: { mode: 'on', size: { width: 360, height: 780 } },
      },
    },
  ],
  webServer: {
    command: `npm run build && npx next start --port ${port}`,
    url: `http://localhost:${port}`,
    // Always a fresh build: a server left running from an earlier run would test old code.
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      // The test branch, never the app's database.
      DATABASE_URL: e2eDatabaseUrl,
      // Test-only values (approved in the plan); the e2e server never sees a real secret.
      BETTER_AUTH_SECRET: 'e2e-only-not-a-secret-4f9c2a7d1b8e6c3f0a5d9b2e7c1f4a8d',
      BETTER_AUTH_URL: `http://localhost:${port}`,
      MAIL_TRANSPORT: 'outbox',
    },
  },
})
