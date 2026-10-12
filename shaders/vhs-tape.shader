// vhs-tape.shader — tracking wobble, color bleed, grain and faint scanlines. obs-shaderfilter.
// Library preset: VHS Tape.
// Params: wobble, color_bleed, noise, scanline_intensity
// SETUP: in the filter's properties tick "Override entire effect". These files are complete effects;
// with it unticked, obs-shaderfilter wraps them in its own template, the uniforms are declared twice,
// OBS logs "Not all shader parameters were set" and the source disappears.

uniform float4x4 ViewProj;
uniform texture2d image;
uniform float elapsed_time;
uniform float2 uv_size;
uniform float2 uv_pixel_interval;

uniform float wobble<
    string label = "Tracking Wobble";
    string widget_type = "slider";
    float minimum = 0.0;
    float maximum = 1.0;
    float step = 0.01;
> = 0.4;

uniform float color_bleed<
    string label = "Color Bleed";
    string widget_type = "slider";
    float minimum = 0.0;
    float maximum = 1.0;
    float step = 0.01;
> = 0.5;

uniform float noise<
    string label = "Noise";
    string widget_type = "slider";
    float minimum = 0.0;
    float maximum = 1.0;
    float step = 0.01;
> = 0.2;

uniform float scanline_intensity<
    string label = "Scanline Intensity";
    string widget_type = "slider";
    float minimum = 0.0;
    float maximum = 1.0;
    float step = 0.01;
> = 0.2;

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

float hash21(float2 p)
{
    return frac(sin(dot(p, float2(12.9898, 78.233))) * 43758.5453);
}

float4 mainImage(VertData v_in) : TARGET
{
    float2 uv = v_in.uv;

    // Slow wave plus occasional per-band horizontal tearing.
    float band = floor(uv.y * uv_size.y * 0.1);
    float tick = floor(fmod(elapsed_time * 12.0, 1024.0)); // wrapped: keeps hash precision on long streams
    float tear = (hash21(float2(band, tick)) - 0.5) * step(0.93, hash21(float2(band + 11.0, tick)));
    uv.x = uv.x + (sin(uv.y * 18.0 + elapsed_time * 2.0) * 0.0015 + tear * 0.03) * wobble;

    // Red and blue sampled a few pixels apart (premultiplied so transparent edges don't tint).
    float shift = color_bleed * 4.0 * uv_pixel_interval.x;
    float4 sr = image.Sample(textureSampler, uv + float2(shift, 0.0));
    float4 sg = image.Sample(textureSampler, uv);
    float4 sb = image.Sample(textureSampler, uv - float2(shift, 0.0));
    float a = max(sr.a, max(sg.a, sb.a));
    float3 rgb = float3(sr.r * sr.a, sg.g * sg.a, sb.b * sb.a) / max(a, 0.0001);

    float lines = 0.5 + 0.5 * sin(uv.y * uv_size.y * 3.14159265);
    rgb = rgb * (1.0 - scanline_intensity * 0.5 * lines);

    float n = hash21(floor(uv * uv_size) + frac(elapsed_time) * 57.3) - 0.5;
    rgb = saturate(rgb + n * noise * 0.6);
    return float4(rgb, a);
}

technique Draw
{
    pass
    {
        vertex_shader = mainTransform(v_in);
        pixel_shader  = mainImage(v_in);
    }
}
