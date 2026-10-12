// crt-classic.shader — scanlines, screen curvature and noise. obs-shaderfilter.
// Library preset: CRT Classic.
// Params: scanline_intensity, scanline_count (lines across the source height), curvature, noise
// SETUP: in the filter's properties tick "Use Effect File (.effect)". These files are complete effects;
// with it unticked, obs-shaderfilter wraps them in its own template, the uniforms are declared twice,
// OBS logs "Not all shader parameters were set" and the source disappears.

uniform float4x4 ViewProj;
uniform texture2d image;
uniform float elapsed_time;
uniform float2 uv_size;

uniform float scanline_intensity<
    string label = "Scanline Intensity";
    string widget_type = "slider";
    float minimum = 0.0;
    float maximum = 1.0;
    float step = 0.01;
> = 0.35;

uniform float scanline_count<
    string label = "Scanline Count";
    string widget_type = "slider";
    float minimum = 50.0;
    float maximum = 1080.0;
    float step = 1.0;
> = 240.0;

uniform float curvature<
    string label = "Curvature";
    string widget_type = "slider";
    float minimum = 0.0;
    float maximum = 1.0;
    float step = 0.01;
> = 0.15;

uniform float noise<
    string label = "Noise";
    string widget_type = "slider";
    float minimum = 0.0;
    float maximum = 1.0;
    float step = 0.01;
> = 0.05;

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
    // Barrel distortion around the center. Samples pushed outside 0..1 come back transparent.
    float2 cc = v_in.uv * 2.0 - 1.0;
    cc = cc + cc * dot(cc, cc) * curvature * 0.35;
    float2 uv = cc * 0.5 + 0.5;

    float4 col = image.Sample(textureSampler, uv);

    float line_wave = 0.5 + 0.5 * sin(uv.y * scanline_count * 6.2831853);
    col.rgb = col.rgb * (1.0 - scanline_intensity * line_wave);

    float n = hash21(floor(uv * uv_size) + frac(elapsed_time) * 91.7) - 0.5;
    col.rgb = saturate(col.rgb + n * noise * col.a);
    return col;
}

technique Draw
{
    pass
    {
        vertex_shader = mainTransform(v_in);
        pixel_shader  = mainImage(v_in);
    }
}
