# OBS Overlay System

Vite + React + TypeScript + Tailwind dashboard that controls OBS (via obs-websocket-js on `ws://localhost:4455`) shader-filter uniforms and text styling, with Zustand-backed presets.

```
npm install
npm run dev   # serves on http://localhost:5317
```

Enable the WebSocket server in OBS (Tools → WebSocket Server Settings), then press Connect. Enter the source/filter names; sliders and color pickers sync live. Presets persist in localStorage.

Add the dashboard in OBS via Docks → Custom Browser Docks with URL `http://localhost:5317`. The port is fixed (strictPort) because Better Alerts uses 5173; change it in `vite.config.ts` if needed.
