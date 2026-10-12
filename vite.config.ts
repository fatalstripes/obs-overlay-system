import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Fixed ports so we never collide with other local OBS tools (Better Alerts uses 5173).
  // strictPort fails loudly instead of silently hopping to another port.
  server: { port: 5317, strictPort: true },
  preview: { port: 5318, strictPort: true },
})
