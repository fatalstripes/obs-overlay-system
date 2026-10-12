import type { Uniform } from '../store/types'

export type ShaderCategory = 'Glow' | 'Retro' | 'Distortion' | 'Color'

export type ShaderLibraryEntry = {
  id: string
  name: string
  category: ShaderCategory
  description: string
  /**
   * Uniform names must match the `uniform` variables declared in your .effect/.shader file;
   * rename them in the Shader Uniforms panel after applying if yours differ.
   */
  uniforms: Uniform[]
}

const f = (name: string, value: number, min: number, max: number, step = 0.01): Uniform => ({
  kind: 'float',
  name,
  value,
  min,
  max,
  step,
})
const c = (name: string, value: string): Uniform => ({ kind: 'color', name, value })

export const SHADER_CATEGORIES: ShaderCategory[] = ['Glow', 'Retro', 'Distortion', 'Color']

export const SHADER_LIBRARY: ShaderLibraryEntry[] = [
  {
    id: 'neon-glow',
    name: 'Neon Glow',
    category: 'Glow',
    description: 'Bright colored bloom around edges.',
    uniforms: [c('glow_color', '#22d3ee'), f('glow_size', 8, 0, 40, 0.5), f('glow_intensity', 1.2, 0, 4), f('pulse_speed', 0, 0, 10)],
  },
  {
    id: 'electric-storm',
    name: 'Electric Storm',
    category: 'Glow',
    description: 'Crackling blue-white energy with fast flicker.',
    uniforms: [c('glow_color', '#60a5fa'), f('glow_size', 14, 0, 40, 0.5), f('glow_intensity', 2, 0, 4), f('pulse_speed', 6, 0, 10)],
  },
  {
    id: 'soft-bloom',
    name: 'Soft Bloom',
    category: 'Glow',
    description: 'Gentle warm halo, good for text.',
    uniforms: [c('glow_color', '#fbbf24'), f('glow_size', 20, 0, 40, 0.5), f('glow_intensity', 0.6, 0, 4), f('pulse_speed', 0.5, 0, 10)],
  },
  {
    id: 'crt-classic',
    name: 'CRT Classic',
    category: 'Retro',
    description: 'Scanlines, curvature and a touch of noise.',
    uniforms: [f('scanline_intensity', 0.35, 0, 1), f('scanline_count', 240, 50, 1080, 1), f('curvature', 0.15, 0, 1), f('noise', 0.05, 0, 1)],
  },
  {
    id: 'vhs-tape',
    name: 'VHS Tape',
    category: 'Retro',
    description: 'Tracking wobble, color bleed and grain.',
    uniforms: [f('wobble', 0.4, 0, 1), f('color_bleed', 0.5, 0, 1), f('noise', 0.2, 0, 1), f('scanline_intensity', 0.2, 0, 1)],
  },
  {
    id: 'glitch-burst',
    name: 'Glitch Burst',
    category: 'Distortion',
    description: 'Block displacement with RGB split.',
    uniforms: [f('glitch_amount', 0.6, 0, 1), f('block_size', 24, 2, 128, 1), f('rgb_split', 6, 0, 30, 0.5), f('speed', 4, 0, 20)],
  },
  {
    id: 'heat-wave',
    name: 'Heat Wave',
    category: 'Distortion',
    description: 'Slow rippling air distortion.',
    uniforms: [f('wave_amplitude', 0.01, 0, 0.1, 0.001), f('wave_frequency', 12, 1, 60, 0.5), f('speed', 1.5, 0, 10)],
  },
  {
    id: 'chromatic-aberration',
    name: 'Chromatic Aberration',
    category: 'Color',
    description: 'Red/blue channel offset toward the edges.',
    uniforms: [f('offset', 3, 0, 20, 0.1), f('angle', 0, 0, 360, 1), f('vignette', 0.2, 0, 1)],
  },
  {
    id: 'duotone',
    name: 'Duotone',
    category: 'Color',
    description: 'Map shadows and highlights to two colors.',
    uniforms: [c('shadow_color', '#1e1b4b'), c('highlight_color', '#f472b6'), f('mix_amount', 1, 0, 1), f('contrast', 1, 0.5, 2)],
  },
]
