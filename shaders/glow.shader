// glow.shader — colored bloom around the source's alpha (text, logos). obs-shaderfilter.
// Library presets: Neon Glow, Electric Storm, Soft Bloom (all share these uniforms).
// Params: glow_color, glow_size (px), glow_intensity, pulse_speed (0 = steady)
// NOTE: the glow can only draw inside the source's bounds. Give the text source some empty
// room (larger custom extents / padding) or the glow gets clipped at the text's box.
// SETUP: in the filter's properties tick "Override entire effect". These files are complete effects;
// with it unticked, obs-shaderfilter wraps them in its own template, the uniforms are declared twice,
// OBS logs "Not all shader parameters were set" and the source disappears.

uniform float4x4 ViewProj;
uniform texture2d image;
uniform float elapsed_time;
uniform float2 uv_pixel_interval;
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

float4 mainImage(VertData v_in) : TARGET
{
    float4 base = image.Sample(textureSampler, v_in.uv);

    // Blur the alpha channel with three rings of eight taps; nearer rings weigh more.
    float glow = 0.0;
    float total = 0.0;
    for (int ring = 1; ring <= 3; ring++) {
        float radius = glow_size * float(ring) / 3.0;
        float w = 1.0 / float(ring);
        for (int i = 0; i < 8; i++) {
            float ang = float(i) * 0.7853982;
            float2 dir = float2(cos(ang), sin(ang));
            glow += image.Sample(textureSampler, v_in.uv + dir * radius * uv_pixel_interval).a * w;
            total += w;
        }
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
