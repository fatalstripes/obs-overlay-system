#!/usr/bin/env node
// Verifies that obs-shaderfilter actually *uses* int, bool, float and color values sent over the
// obs-websocket API (and doesn't drop or choke on them), by pushing raw payloads to a filter that loads
// scripts/type-probe.shader and reading the rendered result back with GetSourceScreenshot.
//
//   node scripts/verify-shader-types.mjs --create --yes
//       Builds a throwaway scene + color source + shader filter, runs the checks, then deletes them.
//   node scripts/verify-shader-types.mjs --source "My Source" --filter "My Filter" --yes
//       Uses a filter you already set up. It must have been CREATED with scripts/type-probe.shader loaded
//       (User-defined shader, "Use Effect File (.effect)" ticked); re-pointing an existing filter at the probe
//       is not picked up by OBS. Its settings are saved first and restored afterwards.
//
// Options: --url ws://localhost:4455   --password <pw> (or OBS_PASSWORD)   --kind <filterKind>   --keep
// Requires: npm install (for obs-websocket-js), OBS with the WebSocket server enabled, obs-shaderfilter.

import { parseArgs } from 'node:util'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { inflateSync } from 'node:zlib'
// The JSON build, i.e. the same wire encoding the dashboard uses in the browser (Node's default is MessagePack).
import OBSWebSocket from 'obs-websocket-js/json'

const { values: opt } = parseArgs({
  options: {
    url: { type: 'string', default: 'ws://localhost:4455' },
    password: { type: 'string', default: process.env.OBS_PASSWORD },
    create: { type: 'boolean', default: false },
    source: { type: 'string' },
    filter: { type: 'string' },
    kind: { type: 'string' },
    keep: { type: 'boolean', default: false },
    yes: { type: 'boolean', default: false },
  },
})

const here = dirname(fileURLToPath(import.meta.url))
const SHADER_PATH = resolve(here, 'type-probe.shader')
const NAMES = { scene: 'ZZ overlay probe scene', input: 'ZZ overlay probe source', filter: 'ZZ overlay probe filter' }

// OBS colors are ABGR integers: 0xAABBGGRR
const abgr = (r, g, b) => ((0xff << 24) | (b << 16) | (g << 8) | r) >>> 0
const BLACK = abgr(0, 0, 0)
const BASE = { probe_int: 0, probe_bool: false, probe_float: 0, probe_color: BLACK }

if (opt.create === !!(opt.source || opt.filter)) {
  console.error('Pass either --create, or both --source and --filter.')
  process.exit(2)
}
if (!opt.create && !(opt.source && opt.filter)) {
  console.error('--source and --filter must be given together.')
  process.exit(2)
}
if (!opt.yes) {
  console.log(
    opt.create
      ? `Would create scene "${NAMES.scene}" with a color source and a shader filter, change that filter's settings, then delete them all.`
      : `Would change the settings of filter "${opt.filter}" on "${opt.source}" (saved first, restored afterwards).`,
  )
  console.log(`Probe shader: ${SHADER_PATH}\nRe-run with --yes to go ahead.`)
  process.exit(0)
}

// ---- minimal PNG decoder (8-bit, non-interlaced RGB/RGBA: what OBS/Qt produce) ----
function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG')
  let pos = 8, width, height, depth, type, interlace
  const idat = []
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos)
    const kind = buf.toString('ascii', pos + 4, pos + 8)
    const data = buf.subarray(pos + 8, pos + 8 + len)
    if (kind === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4)
      depth = data[8]; type = data[9]; interlace = data[12]
    } else if (kind === 'IDAT') idat.push(data)
    else if (kind === 'IEND') break
    pos += 12 + len
  }
  if (depth !== 8 || interlace !== 0 || (type !== 2 && type !== 6)) {
    throw new Error(`unsupported PNG (depth ${depth}, colorType ${type}, interlace ${interlace})`)
  }
  const bpp = type === 6 ? 4 : 3
  const stride = width * bpp
  const raw = inflateSync(Buffer.concat(idat))
  const out = Buffer.alloc(height * stride)
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)]
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1))
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[y * stride + x - bpp] : 0
      const b = y > 0 ? out[(y - 1) * stride + x] : 0
      const c = x >= bpp && y > 0 ? out[(y - 1) * stride + x - bpp] : 0
      let v = line[x]
      if (f === 1) v += a
      else if (f === 2) v += b
      else if (f === 3) v += (a + b) >> 1
      else if (f === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c
      }
      out[y * stride + x] = v & 0xff
    }
  }
  return { width, height, pixel: (x, y) => [0, 1, 2].map((i) => out[y * stride + x * bpp + i]) }
}

const obs = new OBSWebSocket()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
let created = false
let restore = null

async function shot(sourceName) {
  const { imageData } = await obs.call('GetSourceScreenshot', {
    sourceName, imageFormat: 'png', imageWidth: 64, imageHeight: 64,
  })
  const img = decodePng(Buffer.from(imageData.replace(/^data:image\/png;base64,/, ''), 'base64'))
  return {
    left: img.pixel(Math.floor(img.width * 0.25), Math.floor(img.height / 2)),
    right: img.pixel(Math.floor(img.width * 0.75), Math.floor(img.height / 2)),
  }
}

async function push(sourceName, filterName, settings) {
  await obs.call('SetSourceFilterSettings', { sourceName, filterName, filterSettings: settings, overlay: true })
  await sleep(250) // let OBS apply the update and render a frame
}

const near = (got, want, tol = 4) => got.every((v, i) => Math.abs(v - want[i]) <= tol)
const fmt = (p) => `(${p.join(',')})`

/** OBS applies a settings change on a later frame, so poll the screenshot until it shows `want` (or give up). */
async function settle(sourceName, side, want, timeoutMs = 2500) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const got = (await shot(sourceName))[side]
    if (near(got, want) || Date.now() > deadline) return got
    await sleep(150)
  }
}

async function main() {
  console.log(`Connecting to ${opt.url} ...`)
  await obs.connect(opt.url, opt.password)
  const version = await obs.call('GetVersion')
  console.log(`Connected: OBS ${version.obsVersion}, obs-websocket ${version.obsWebSocketVersion}`)
  if (!version.supportedImageFormats.includes('png')) throw new Error('OBS cannot produce PNG screenshots')

  let sourceName = opt.source
  let filterName = opt.filter

  if (opt.create) {
    const { filterKinds } = await obs.call('GetSourceFilterKindList')
    const kinds = opt.kind ? [opt.kind] : filterKinds.filter((k) => /shader/i.test(k))
    if (kinds.length !== 1) {
      throw new Error(
        kinds.length === 0
          ? 'No shader filter kind found: is obs-shaderfilter installed?'
          : `Several shader filter kinds found (${kinds.join(', ')}); pick one with --kind.`,
      )
    }
    sourceName = NAMES.input
    filterName = NAMES.filter
    created = true
    await obs.call('CreateScene', { sceneName: NAMES.scene })
    await obs.call('CreateInput', {
      sceneName: NAMES.scene,
      inputName: sourceName,
      inputKind: 'color_source_v3',
      inputSettings: { color: abgr(200, 100, 50), width: 256, height: 256 }, // orange: visible if the probe isn't applied
      sceneItemEnabled: true,
    })
    await obs.call('CreateSourceFilter', {
      sourceName,
      filterName,
      filterKind: kinds[0],
      filterSettings: { from_file: true, shader_file_name: SHADER_PATH, override_entire_effect: true },
    })
    await sleep(800) // compile the shader
    console.log(`Created throwaway scene/source/filter (filter kind "${kinds[0]}").`)
  } else {
    const f = await obs.call('GetSourceFilter', { sourceName, filterName })
    restore = f.filterSettings
    console.log(`Using filter "${filterName}" on "${sourceName}" (kind "${f.filterKind}"; settings saved for restore).`)
  }

  // ---- 0. baseline: everything low, so the probe must render black on both halves ----
  await push(sourceName, filterName, BASE)
  await settle(sourceName, 'left', [0, 0, 0])
  const base = await shot(sourceName)
  if (!near(base.left, [0, 0, 0]) || !near(base.right, [0, 0, 0])) {
    console.log(`\nBaseline should be black but left=${fmt(base.left)} right=${fmt(base.right)}.`)
    console.log('The probe shader does not look like it is being applied. Check that the filter loads')
    console.log(`${SHADER_PATH}`)
    console.log('with "Use Effect File (.effect)" ticked, and look in the OBS log for shader errors.')
    if (!opt.create) console.log('If you changed an existing filter to use the probe, create a new filter instead: OBS keeps the old shader.')
    process.exitCode = 1
    return
  }
  console.log(`Baseline OK: left=${fmt(base.left)} right=${fmt(base.right)} (probe shader is active)\n`)

  // ---- 1. each type: stored by OBS? consumed by the shader? ----
  const checks = [
    { type: 'int', key: 'probe_int', payload: 255, side: 'right', want: [255, 0, 0] },
    { type: 'bool', key: 'probe_bool', payload: true, side: 'right', want: [0, 255, 0] },
    { type: 'float', key: 'probe_float', payload: 1, side: 'right', want: [0, 0, 255] },
    { type: 'color (red)', key: 'probe_color', payload: abgr(255, 0, 0), side: 'left', want: [255, 0, 0] },
    { type: 'color (green)', key: 'probe_color', payload: abgr(0, 255, 0), side: 'left', want: [0, 255, 0] },
  ]
  for (const c of checks) {
    const row = { type: c.type, sent: `${c.key}=${JSON.stringify(c.payload)}` }
    try {
      await push(sourceName, filterName, { ...BASE, [c.key]: c.payload })
      const stored = (await obs.call('GetSourceFilter', { sourceName, filterName })).filterSettings[c.key]
      row.stored = stored === c.payload && typeof stored === typeof c.payload
      row.storedAs = `${typeof stored} ${JSON.stringify(stored)}`
      const got = await settle(sourceName, c.side, c.want)
      row.seen = `${c.side} ${fmt(got)}`
      row.consumed = near(got, c.want)
    } catch (e) {
      row.error = e.message
    }
    results.push(row)
    await push(sourceName, filterName, BASE).catch(() => {})
    await settle(sourceName, c.side, [0, 0, 0]).catch(() => {}) // back to baseline before the next check
  }

  // ---- report ----
  const mark = (ok) => (ok ? 'PASS' : 'FAIL')
  console.log('type           sent                         stored by OBS           rendered')
  for (const r of results) {
    console.log(
      `${r.type.padEnd(14)} ${r.sent.padEnd(28)} ${r.error ? 'ERROR ' + r.error : `${mark(r.stored)} (${r.storedAs})`.padEnd(23)} ${r.error ? '' : `${mark(r.consumed)} ${r.seen}`}`,
    )
  }
  const bad = results.filter((r) => r.error || !r.stored || !r.consumed)
  console.log(bad.length ? `\n${bad.length} check(s) FAILED.` : '\nAll types were stored and used by the shader.')
  for (const r of bad) {
    if (r.error) console.log(`- ${r.type}: request failed (${r.error})`)
    else if (!r.stored) console.log(`- ${r.type}: OBS did not keep the value as sent (${r.storedAs}).`)
    else console.log(`- ${r.type}: stored, but the shader did not render it: silently ignored by obs-shaderfilter.`)
  }
  if (bad.length) process.exitCode = 1
}

async function cleanup() {
  try {
    if (!obs.identified) return
    if (created && !opt.keep) {
      await obs.call('RemoveInput', { inputName: NAMES.input }).catch(() => {})
      await obs.call('RemoveScene', { sceneName: NAMES.scene }).catch(() => {})
      console.log('Removed the throwaway scene, source and filter.')
    } else if (created) {
      console.log(`Left "${NAMES.scene}" in OBS (--keep). Delete it when done.`)
    } else if (restore) {
      await obs.call('SetSourceFilterSettings', {
        sourceName: opt.source, filterName: opt.filter, filterSettings: restore, overlay: false,
      })
      console.log('Restored the filter\'s original settings.')
    }
  } finally {
    await obs.disconnect().catch(() => {})
  }
}

process.on('SIGINT', () => cleanup().finally(() => process.exit(130)))
try {
  await main()
} catch (e) {
  console.error(`\nFailed: ${e.message}`)
  process.exitCode = 1
} finally {
  await cleanup()
}
