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
- Effects that spread outside the text (Glow, Heat Wave, Glitch) are clipped at the source's bounds unless the filter
  has room. In the filter's properties set **Extra pixels on left / right / top / bottom** (for Glow, at least the glow
  size); every bundled shader maps its coordinates for that, so the source isn't stretched. Confirmed on a live OBS
  for Glow. Giving the source empty room (a larger custom text extent, or a bigger scene/group) works too.
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
  are simply no longer sent; nothing is written to OBS for them.
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
and deletes them. To use a filter you already set up instead, pass `--source "…" --filter "…"`; its settings are saved first and
restored afterwards. That filter must be **created fresh with `scripts/type-probe.shader` loaded from the start**
(User-defined shader, shader text file = the probe, **Use Effect File (.effect)** ticked). Don't point an
existing filter at the probe through the API or by editing it: OBS keeps running the old shader, and the script
will correctly report that the baseline isn't black. Without `--yes` it only prints what it would do. Other options:
`--url ws://localhost:4455`, `--password …` (or `OBS_PASSWORD`), `--kind <filterKind>`, `--keep`. Run it on the
machine running OBS. It uses the JSON wire encoding, the same as the dashboard.

## Scene presets

Bind a saved preset to an OBS scene and the dashboard applies it whenever OBS switches to that scene.

1. Set up the shader and text the way you want them, then **Save** a preset (Presets panel).
2. In **Scene Presets**, pick that preset for a scene. Connect first so the scenes are listed; the scene that is
   live in OBS is marked.
3. Switch scenes in OBS. The dashboard follows the program scene (`CurrentProgramSceneChanged`), loads the bound
   preset and pushes its shader uniforms and text to OBS immediately; no clicks needed.

- A preset carries its own source, filter and text-source names, so each scene's preset can target different sources.
- Scenes with no binding leave everything as it is. The **Auto-apply** switch pauses the whole thing, and each row's
  **Apply** button applies its preset by hand.
- The bound preset is also applied when the dashboard connects (including the automatic reconnect on load) while
  OBS is already on a bound scene.
- Studio Mode: only the *program* scene counts, not the preview scene.
- Bindings follow scene renames made in OBS, and are removed when their preset is deleted.
- A preset can also carry the **Custom ProText** settings. The Presets panel's **Include the Custom ProText overlay
  settings** option decides: it ticks itself once you've changed the overlay from its defaults, and you can override
  it. Presets that carry them show a **ProText** badge. Applying such a preset (by **Load**, by **Apply** in the
  Scene Presets panel, or by a scene switch) restores the overlay's font, fill, stroke, lines and rotator along with the
  shader and native text. A scene switch pushes it immediately even with live sync off; **Load** follows live sync like
  any edit. A preset saved without them (including any saved before this existed) leaves the overlay as it is.
  Saving under an existing name replaces the whole preset, so unticking the option drops its ProText snapshot.
- **Each scene keeps its own overlay text.** The overlay is one shared source, so a plain edit would change it for every
  scene. To avoid that, edits you make in the Custom ProText panel while a scene with a bound preset is live are saved
  into that preset (a moment after you stop typing), and switching scenes brings each scene's own text back. The panel
  says which scene and preset an edit goes to, and has an **Auto-save** switch: turn it off and edits only change the
  live overlay until you switch scenes. If the live scene has no preset (or auto-apply is off) edits change the overlay
  for every scene. A bound preset that has no overlay settings yet is flagged in the Scene Presets panel, with a button
  to save the current overlay into it. Loading a preset is not an edit, so it never overwrites another scene's preset.
- Only values that are valid are sent. A uniform with no usable value is left out of the payload instead of being
  written as 0, and uniforms that a newly applied shader doesn't declare are not touched in OBS.

## Custom ProText (text overlay)

A text engine that runs as an OBS **Browser Source**, in the spirit of StreamUP ProText but driven from this dashboard:
any Google Font, a stroke, a solid or gradient fill, and a rotator that cycles through several lines (Framer Motion
transitions: fade, slide up, slide left, scale, blur). The **Custom ProText** panel at the bottom of the dashboard
controls it, with a live preview of a 1280×240 source.

**Set it up**
1. Connect the dashboard to OBS as usual.
2. In OBS add a **Browser Source** (Sources → + → Browser) and paste the URL from the panel's **OBS Browser Source URL**
   field (use the **URL** option, not "Local file"). Give it a width and height that fit your text, e.g. 1920×200, and
   leave the custom CSS empty (the page makes its own background transparent).
3. Edit in the panel. The overlay updates as you change things, and the panel shows `overlay: just now` when the source
   confirms it received the settings.

**How it works.** Both the dashboard and the Browser Source are obs-websocket clients. The dashboard sends the
settings with `BroadcastCustomEvent`, OBS delivers it to every client as a `CustomEvent`, and the overlay listens for
it. The overlay asks for the current settings whenever it (re)connects, so a freshly added or reloaded source fills in
at once, and it also remembers the last settings it saw. Messages carry a `channel` name so other plugins' custom events
are ignored, and everything the overlay receives is validated and clamped before it is rendered.

- The route is `index.html#/overlay/text?ws=ws://localhost:4455&pw=<password>`; add `&debug=1` to show a connection
  status badge on the overlay. The same build serves the dashboard and the overlay, on GitHub Pages or from `file://`.
- The URL contains the WebSocket password (only if one is set, and you can untick the box), and OBS stores a Browser
  Source's URL in plain text in the scene collection.
- Fonts come from Google Fonts, so the overlay needs internet access. Pick one from the list or type any family's exact
  name under **Other…**. If a family doesn't offer the chosen weight, it falls back to the family's default styles.
- With the rotator **off**, all lines are shown stacked; **on**, one at a time (sequential or random).
- It's one shared channel: every text-engine overlay on this OBS shows the same settings.
- It is a separate source from the native-text controls above, but presets can carry its settings: see "Scene presets" below.

