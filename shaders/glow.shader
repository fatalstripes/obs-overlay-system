// glow.shader — colored bloom around the source's alpha (text, logos). obs-shaderfilter.
// Library presets: Neon Glow, Electric Storm, Soft Bloom (all share these uniforms).
// Params: glow_color, glow_size (px), glow_intensity, pulse_speed (0 = steady)
// Cost: 12 texture reads per pixel at the default size, up to 48 at large sizes.
// NOTE: the glow can only draw inside the source's bounds. Give the text source some empty
// room (larger custom extents / padding) or the glow gets clipped at the text's box.
// SETUP: in the filter's properties tick "Use Effect File (.effect)". These files are complete effects;
// with it unticked, obs-shaderfilter wraps them in its own template, the uniforms are declared twice,
// OBS logs "Not all shader parameters were set" and the source disappears.

uniform float4x4 ViewProj;
uniform texture2d image;
uniform float elapsed_time;
uniform float2 uv_pixel_interval;
uniform float2 uv_size;
uniform float rand_instance_f;

uniform float4 glow_color<
    string label = "Glow Color";
    string widget_type = "color";
> = {0.133, 0.827, 0.933, 1.0};

uniform float glow_size<
    string label = "Glow Size (px)";
    string widget_type = "slider";
    float minimum = 0.0;
    float maximum = 40.0;
    float step = 0.5;
> = 8.0;

uniform float glow_intensity<
    string label = "Glow Intensity";
    string widget_type = "slider";
    float minimum = 0.0;
    float maximum = 4.0;
    float step = 0.01;
> = 1.2;

uniform float pulse_speed<
    string label = "Pulse Speed (0 = off)";
    string widget_type = "slider";
    float minimum = 0.0;
    float maximum = 10.0;
    float step = 0.01;
> = 0.0;

sampler_state textureSampler {
    Filter    = Linear;
    AddressU  = Border;
    AddressV  = Border;
    BorderColor = 00000000;
};

struct VertData {
    float4 pos : POSITION;
    float2 uv  : TEXCOORD0;
};

VertData mainTransform(VertData v_in)
{
    VertData vert_out;
    vert_out.pos = mul(float4(v_in.pos.xyz, 1.0), ViewProj);
    vert_out.uv  = v_in.uv;
    return vert_out;
}

// Interleaved gradient noise: a cheap per-pixel value in 0..1 with no visible pattern.
float pixel_noise(float2 p)
{
    return frac(52.9829189 * frac(dot(p, float2(0.06711056, 0.00583715))));
}

float4 mainImage(VertData v_in) : TARGET
{
    float4 base = image.Sample(textureSampler, v_in.uv);

    // Blur the alpha channel over a disk of radius glow_size. The taps follow a golden-angle spiral, which
    // covers the disk evenly (fixed rings of taps left visible echo rings at large sizes), and each pixel
    // rotates the spiral by its own noise value so any leftover sampling pattern becomes fine grain instead
    // of structure. The tap count grows with the size (12 at the default, 48 at most) to keep large halos smooth.
    float taps = clamp(glow_size * 1.5, 12.0, 48.0);
    float rot = pixel_noise(v_in.uv * uv_size) * 6.2831853;
    float glow = 0.0;
    float total = 0.0;
    for (int i = 0; i < 48; i++) {
        if (float(i) >= taps) {
            break;
        }
        float t = sqrt((float(i) + 0.5) / taps);        // 0..1, even over the disk's area
        float ang = float(i) * 2.3999632 + rot;
        float2 dir = float2(cos(ang), sin(ang));
        float w = 1.0 - 0.85 * t * t;                   // nearer taps weigh more: a soft falloff
        glow += image.Sample(textureSampler, v_in.uv + dir * (t * glow_size) * uv_pixel_interval).a * w;
        total += w;
    }
    glow = glow / total;

    // Phase offset per filter instance so several copies don't pulse in lockstep.
    float wave = 0.65 + 0.35 * sin(elapsed_time * pulse_speed + rand_instance_f * 6.2831853);
    float pulse = lerp(1.0, wave, step(0.001, pulse_speed));
    glow = saturate(glow * glow_intensity * pulse) * step(0.01, glow_size);

    // Composite the glow *behind* the original (straight-alpha "over").
    float ga = glow * glow_color.a;
    float out_a = base.a + ga * (1.0 - base.a);
    float3 out_rgb = (base.rgb * base.a + glow_color.rgb * ga * (1.0 - base.a)) / max(out_a, 0.0001);
    return float4(out_rgb, out_a);
}

technique Draw
{
    pass
    {
        vertex_shader = mainTransform(v_in);
        pixel_shader  = mainImage(v_in);
    }
}
