import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { configDefaults, defineConfig } from 'vitest/config'

const serverCode = 'app/lib/**/*.test.ts'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
      'server-only': fileURLToPath(new URL('./app/lib/test/server-only.ts', import.meta.url)),
    },
  },
  test: {
    setupFiles: ['./vitest.setup.ts'],
    projects: [
      {
        extends: true,
        test: { name: 'node', environment: 'node', include: [serverCode] },
      },
      {
        extends: true,
        test: {
          name: 'jsdom',
          environment: 'jsdom',
          include: ['app/**/*.test.{ts,tsx}', '{scripts,i18n,messages}/**/*.test.ts'],
          exclude: [...configDefaults.exclude, serverCode],
        },
      },
    ],
  },
})
