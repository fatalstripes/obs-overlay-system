import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

/**
 * Browsers (including OBS's CEF) refuse to load `type="module"` scripts and `crossorigin`
 * assets from file:// URLs. The build emits a single IIFE bundle, so rewrite the tags to a
 * classic deferred script. This lets dist/index.html be opened straight from disk.
 */
function fileProtocolFriendlyHtml(): Plugin {
  return {
    name: 'file-protocol-friendly-html',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler: (html) =>
        html
          .replace(/<script type="module" crossorigin /g, '<script defer ')
          .replace(/ crossorigin(?==|>| )/g, ''),
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  // Relative asset paths so the build works from GitHub Pages (project sites live under /<repo>/)
  // and when opened straight from disk via file:///.
  base: './',
  plugins: [react(), tailwindcss(), fileProtocolFriendlyHtml()],
  build: {
    rollupOptions: {
      output: { format: 'iife', inlineDynamicImports: true },
    },
  },
  // Fixed ports so we never collide with other local OBS tools (Better Alerts uses 5173).
  // strictPort fails loudly instead of silently hopping to another port.
  server: { port: 5317, strictPort: true },
  preview: { port: 5318, strictPort: true },
})
