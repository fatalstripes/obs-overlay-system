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

## Shaders for the Shader Library

The Shader Library only sets uniform *values*. The effect itself comes from a shader file loaded into the
[obs-shaderfilter](https://github.com/exeldro/obs-shaderfilter) plugin on your source. Matching shaders live in
[`shaders/`](shaders/):

| Library presets                     | Shader file                          |
| ----------------------------------- | ------------------------------------ |
| Neon Glow, Electric Storm, Soft Bloom | `shaders/glow.shader`                |
| CRT Classic                         | `shaders/crt-classic.shader`         |
| VHS Tape                            | `shaders/vhs-tape.shader`            |
| Glitch Burst                        | `shaders/glitch-burst.shader`        |
| Heat Wave                           | `shaders/heat-wave.shader`           |
| Chromatic Aberration                | `shaders/chromatic-aberration.shader`|
| Duotone                             | `shaders/duotone.shader`             |

Setup in OBS:
1. Right-click your **text source** → **Filters** → **+** → **User-defined shader**.
2. Tick **Load shader text from file** and browse to the `.shader` file for the preset you want.
3. **Tick "Use Effect File (.effect)".** Required: these files are complete effects. With it unticked, obs-shaderfilter
   pastes the file into its own template, the uniforms get declared twice, OBS logs `Not all shader parameters were
   set`, and the source disappears. If you ticked it after adding the filter and nothing changed, delete the filter and
   re-add it with the box ticked from the start.
4. In the dashboard, connect, pick that **Source** and the **Filter** (the name you gave it, e.g. "User-defined shader"),
   then press **Apply** on the matching preset.

Tips:
- Effects that spread outside the text (Glow, Heat Wave, Glitch) are clipped at the source's bounds. Give the text
  source some empty room around it (a larger custom text extent, or put it in a bigger scene/group).
- The **Filter on/off** switch in the Shader Uniforms panel turns the filter on or off in OBS (the eye icon) and follows
  changes made in OBS. **Push now** and live sync only send values; they never switch the filter on.
- Glitch Burst and Electric Storm flicker; keep the speed low if you or your viewers are sensitive to flashing.
- A source that vanishes when you add the filter almost always means **Use Effect File (.effect)** is unticked.
- If a shader doesn't load, check **Help → Log Files → View Current Log** and search for `error` near the file name.

## Importing your own shader

You don't need the library to use a shader. In **Shader Uniforms**, drop a `.shader` / `.effect` file onto the
dashed area (or press **Import shader…**). The dashboard reads the file's `uniform` declarations and builds the
controls for you, then keeps them in sync with the filter on your source:

| Declaration       | Control                | Sent to OBS as                |
| ----------------- | ---------------------- | ----------------------------- |
| `uniform float`   | range slider           | number                        |
| `uniform int`     | range slider (whole)   | integer                       |
| `uniform bool`    | on/off toggle          | `true` / `false`              |
| `uniform float4`  | color picker           | ABGR integer (`0xAABBGGRR`)   |

- Defaults come from the `= value` after the declaration. Slider ranges come from the `minimum`, `maximum` and
  `step` annotations and the label from `string label`; with no annotations the range is guessed from the default.
- obs-shaderfilter's own uniforms (`ViewProj`, `image`, `elapsed_time`, `uv_*`, `rand_*`, …) are ignored. Other types
  (`float2`, `float3`, `texture2d`, …) have no control and are listed after the import.
- A `float4` without `widget_type = "color"` still becomes a color picker, with a warning, because OBS may store it
  differently.
- Importing replaces the current uniform list. Uniforms from the previous list that the new shader doesn't declare
  are reset to 0 / false / black in OBS with the next push.
- The shader file in OBS still needs **Use Effect File (.effect)** ticked, as above.

`npm test` runs the parser's tests, including a check that every bundled shader parses to exactly the controls its
library presets expect.

### Checking that OBS really uses int / bool values

`scripts/verify-shader-types.mjs` pushes raw `int`, `bool`, `float` and color values to a shader filter on your
live OBS and checks that obs-shaderfilter both **stored** them and **rendered** them. The probe shader
(`scripts/type-probe.shader`) paints its output from those uniforms, and the script reads the result back with
`GetSourceScreenshot`, so a silently dropped value shows up as a missing color.

```
npm run verify:obs-types -- --create --yes
```

`--create` builds a throwaway scene, color source and shader filter (named `ZZ overlay probe …`), runs the checks
and deletes them. To use a filter you already set up instead (User-defined shader loading
`scripts/type-probe.shader`, with **Use Effect File (.effect)** ticked), pass `--source "…" --filter "…"`; its
settings are saved first and restored afterwards. Without `--yes` it only prints what it would do. Other options:
`--url ws://localhost:4455`, `--password …` (or `OBS_PASSWORD`), `--kind <filterKind>`, `--keep`. Run it on the
machine running OBS. It uses the JSON wire encoding, the same as the dashboard.

