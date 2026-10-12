# OBS Overlay System

Vite + React + TypeScript + Tailwind dashboard that controls OBS (via `obs-websocket-js` on
`ws://localhost:4455`) shader-filter uniforms and text styling, with a built-in shader library and
Zustand-backed presets. You don't need a dev server to use it — pick one of the options below.

## Before you start (OBS)

Enable the WebSocket server in OBS: **Tools → WebSocket Server Settings**. Open the dashboard, enter the
password if you set one, and press **Connect**. Enter the source/filter names; sliders and color pickers
sync live. Presets persist in the browser's localStorage.

## Option 1: GitHub Pages (hosted)

Every push to `main` builds the app and deploys it via `.github/workflows/deploy.yml`.

One-time setup: in the repo go to **Settings → Pages** and set **Source** to **GitHub Actions**.

The dashboard is then available at:

```
https://fatalstripes.github.io/obs-overlay-system/
```

In OBS: **Docks → Custom Browser Docks**, give it a name, and paste that URL.

Notes:
- The page is served over HTTPS but talks to OBS at `ws://localhost:4455`. Chromium (which OBS's browser
  uses) allows this for `localhost`.
- Presets are stored per origin, so the hosted copy and the local copy below have separate preset lists.

## Option 2: Local file (no server, works offline)

```
npm install
npm run build
```

This produces `dist/index.html`. Load it in OBS via a `file:///` URI under **Docks → Custom Browser Docks**:

| OS      | URL example                                                  |
| ------- | ------------------------------------------------------------ |
| Windows | `file:///C:/Users/you/obs-overlay-system/dist/index.html`    |
| macOS   | `file:///Users/you/obs-overlay-system/dist/index.html`       |
| Linux   | `file:///home/you/obs-overlay-system/dist/index.html`        |

Use forward slashes, and replace spaces in the path with `%20`. Rebuild after pulling changes.

The build is configured for this: asset paths are relative (`base: './'`) and the bundle is emitted as a
classic script, because browsers refuse `type="module"` scripts from `file://`.

## Development

```
npm run dev   # http://localhost:5317
```

The port is fixed (`strictPort`) because Better Alerts uses 5173; change it in `vite.config.ts` if needed.
