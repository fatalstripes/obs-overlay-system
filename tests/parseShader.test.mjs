// Run with: npm test  (Node >= 22.6 strips the TypeScript types on import)
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { test } from 'node:test'
import { parseShaderUniforms } from '../src/lib/parseShader.ts'
import { SHADER_LIBRARY } from '../src/lib/shaderLibrary.ts'

const shaderDir = new URL('../shaders/', import.meta.url)

test('every bundled shader parses to exactly the uniforms its library presets expect', () => {
  for (const file of readdirSync(shaderDir).filter((f) => f.endsWith('.shader'))) {
    const parsed = parseShaderUniforms(readFileSync(new URL(file, shaderDir), 'utf8'))
    const presets = SHADER_LIBRARY.filter((e) => e.shaderFile === file)
    assert.ok(presets.length > 0, `${file} is used by a library preset`)
    assert.deepEqual(parsed.skipped, [], `${file}: nothing skipped`)
    assert.deepEqual(parsed.warnings, [], `${file}: no warnings`)
    const [first, ...rest] = presets
    assert.deepEqual(
      parsed.uniforms.map((u) => u.name),
      first.uniforms.map((u) => u.name),
      `${file}: names and order`,
    )
    for (const want of first.uniforms) {
      const got = parsed.uniforms.find((u) => u.name === want.name)
      assert.equal(got.kind, want.kind, `${file}.${want.name} kind`)
      if (want.kind === 'color') {
        assert.equal(got.value, want.value, `${file}.${want.name} default`)
      } else {
        assert.deepEqual([got.min, got.max, got.step], [want.min, want.max, want.step], `${file}.${want.name} range`)
        assert.equal(got.value, want.value, `${file}.${want.name} default`)
      }
    }
    for (const preset of rest) {
      for (const u of preset.uniforms) {
        const got = parsed.uniforms.find((p) => p.name === u.name)
        if (u.kind !== 'color') assert.ok(u.value >= got.min && u.value <= got.max, `${file}: ${preset.id}.${u.name} in range`)
      }
    }
  }
})

test('reads types, defaults, annotations and labels', () => {
  const { uniforms, skipped, warnings } = parseShaderUniforms(`
    uniform float4x4 ViewProj;
    uniform texture2d image;
    uniform float elapsed_time;
    uniform float2 uv_size;
    // uniform float commented_out = 1.0;
    /* uniform float also_commented = 1.0; */
    uniform float speed<string label = "Animation // Speed"; string widget_type = "slider";
        float minimum = 0.5; float maximum = 5.0; float step = 0.25;> = 2.0;
    uniform int samples<int minimum = 2; int maximum = 16; int step = 1;> = 8;
    uniform bool invert<string label = "Invert";> = true;
    uniform bool off_by_default = false;
    uniform float4 tint<string widget_type = "color";> = {0.5, 0.0, 1.0, 1.0};
    uniform float2 offset = {0.0, 0.0};
    uniform texture2d mask;
  `)
  assert.deepEqual(uniforms, [
    { name: 'speed', label: 'Animation // Speed', kind: 'float', value: 2, min: 0.5, max: 5, step: 0.25 },
    { name: 'samples', kind: 'int', value: 8, min: 2, max: 16, step: 1 },
    { name: 'invert', label: 'Invert', kind: 'bool', value: true },
    { name: 'off_by_default', kind: 'bool', value: false },
    { name: 'tint', kind: 'color', value: '#8000ff' },
  ])
  assert.deepEqual(skipped, ['float2 offset', 'texture2d mask'])
  assert.deepEqual(warnings, [])
})

test('guesses a range when there are no annotations, and keeps the default inside it', () => {
  const { uniforms } = parseShaderUniforms(`
    uniform float a = 0.0;
    uniform float b = 3.0;
    uniform float c = -2.5;
    uniform int d = 7;
    uniform float e<float minimum = 0.0; float maximum = 1.0;> = 5.0;
  `)
  const by = Object.fromEntries(uniforms.map((u) => [u.name, u]))
  assert.deepEqual([by.a.min, by.a.max], [0, 1])
  assert.deepEqual([by.b.min, by.b.max], [0, 20])
  assert.deepEqual([by.c.min, by.c.max], [-10, 10])
  assert.deepEqual([by.d.min, by.d.max, by.d.step], [0, 50, 1])
  assert.equal(by.e.max, 5, 'range widened to include the default')
  for (const u of uniforms) assert.ok(u.value >= u.min && u.value <= u.max, u.name)
})

test('float4 without a color widget still becomes a color but warns; constructor defaults work', () => {
  const { uniforms, warnings } = parseShaderUniforms('uniform float4 c = float4(1.0, 0.0, 0.0, 1.0);')
  assert.deepEqual(uniforms, [{ name: 'c', kind: 'color', value: '#ff0000' }])
  assert.equal(warnings.length, 1)
})

test('handles missing defaults, duplicates and empty input', () => {
  const dup = parseShaderUniforms('uniform float x; uniform float x = 3.0;')
  assert.equal(dup.uniforms.length, 1)
  assert.equal(dup.uniforms[0].value, 0)
  assert.deepEqual(parseShaderUniforms('float4 mainImage() { return 0; }').uniforms, [])
})
