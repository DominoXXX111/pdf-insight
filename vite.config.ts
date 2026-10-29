import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// GitHub Pages serwuje aplikacje pod /<repo>/, dlatego base musi sie zgadzac z nazwa repozytorium.
export default defineConfig({
  base: '/pdf-insight/',
  plugins: [react()],
  test: {
    include: ['src/**/*.test.ts', 'worker/**/*.test.ts'],
    environment: 'node',
  },
})
