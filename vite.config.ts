import react from '@vitejs/plugin-react'
import { loadEnv, type Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

/**
 * Content-Security-Policy jako <meta> - GitHub Pages nie pozwala ustawic wlasnych naglowkow HTTP.
 * Tylko w buildzie: serwer deweloperski Vite wstrzykuje skrypty inline.
 * (frame-ancestors i X-Frame-Options nie dzialaja w <meta> - to ograniczenie GitHub Pages.)
 */
function contentSecurityPolicy(apiUrl: string): Plugin {
  const api = apiUrl ? new URL(apiUrl).origin : ''
  const policy = [
    "default-src 'self'",
    "script-src 'self' 'wasm-unsafe-eval'",
    "worker-src 'self' blob:",
    `connect-src 'self' ${api}`.trim(),
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ')
  return {
    name: 'content-security-policy',
    apply: 'build',
    transformIndexHtml: (html) =>
      html.replace(
        '<meta charset="UTF-8" />',
        `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />\n    <meta name="referrer" content="no-referrer" />`,
      ),
  }
}

// GitHub Pages serwuje aplikacje pod /<repo>/, dlatego base musi sie zgadzac z nazwa repozytorium.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  return {
    base: '/pdf-insight/',
    plugins: [react(), contentSecurityPolicy(env.VITE_API_URL ?? process.env.VITE_API_URL ?? '')],
    test: {
      include: ['src/**/*.test.ts', 'worker/**/*.test.ts'],
      environment: 'node',
    },
  }
})
