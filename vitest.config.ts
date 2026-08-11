import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '#': new URL('./src', import.meta.url).pathname,
      zod: new URL('./node_modules/zod/index.cjs', import.meta.url).pathname,
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    coverage: {
      provider: 'istanbul',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/__tests__/**',
        'src/routeTree.gen.ts',
        'src/**/-types/**',
        'src/types/**',
      ],
    },
  },
})
