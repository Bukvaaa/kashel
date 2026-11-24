import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/*
 * Content-Security-Policy для собранной страницы.
 *
 * Вторая линия защиты: даже если в окно попадёт чужой скрипт (через заметку,
 * архив, перетащенный файл), он не загрузит код со стороны и не отправит
 * данные куда попало. Разрешено ровно то, чем программа пользуется сама:
 * свои файлы, картинки и звуки из data:/blob:, облако Supabase и локальная
 * Ollama. Встраивается только в сборку: в режиме разработки Vite сам кладёт
 * на страницу встроенные скрипты и связь горячей перезагрузки.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co http://127.0.0.1:11434",
  "object-src 'none'",
  "frame-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ')

const csp = (): Plugin => ({
  name: 'kashel-csp',
  apply: 'build',
  transformIndexHtml: (html) =>
    html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
})

export default defineConfig({
  plugins: [react(), csp()],
  base: './',
  server: { port: 5173, strictPort: true },
  build: { outDir: 'dist', emptyOutDir: true, chunkSizeWarningLimit: 2000 },
})
