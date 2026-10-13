// duotone.shader — maps shadows and highlights to two colors. obs-shaderfilter.
// Library preset: Duotone.
// Params: shadow_color, highlight_color, mix_amount, contrast
// White text maps to highlight_color; dark areas map to shadow_color.
// SETUP: in the filter's properties tick "Use Effect File (.effect)". These files are complete effects;
// with it unticked, obs-shaderfilter wraps them in its own template, the uniforms are declared twice,
// OBS logs "Not all shader parameters were set" and the source disappears.
// EXTRA ROOM: the filter's "Extra pixels on left/right/top/bottom" are supported: they enlarge the drawing area
// without stretching the source, and the effect can spread into it.

uniform float4x4 ViewProj;
uniform texture2d image;
uniform float2 uv_offset;
uniform float2 uv_scale;

uniform float4 shadow_color<
    string label = "Shadow Color";
    string widget_type = "color";
> = {0.118, 0.106, 0.294, 1.0};

uniform float4 highlight_color<
    string label = "Highlight Color";
    string widget_type = "color";
> = {0.957, 0.447, 0.714, 1.0};

uniform float mix_amount<
    string label = "Mix Amount";
    string widget_type = "slider";
    float minimum = 0.0;
    float maximum = 1.0;
    float step = 0.01;
> = 1.0;

uniform float contrast<
    string label = "Contrast";
    string widget_type = "slider";
    float minimum = 0.5;
    float maximum = 2.0;
    float step = 0.01;
> = 1.0;

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
    // With the filter's "Extra pixels on left/right/top/bottom" set, the drawing area is larger than the source;
    // uv_scale / uv_offset map it back onto the source (identity when the extras are 0), so the source isn't
    // stretched and the effect can spread into the extra room. Done here, once: v_in.uv is already in source coordinates.
    vert_out.uv  = v_in.uv * uv_scale + uv_offset;
    return vert_out;
}

float4 mainImage(VertData v_in) : TARGET
{
    float4 base = image.Sample(textureSampler, v_in.uv);
    float lum = dot(base.rgb, float3(0.2126, 0.7152, 0.0722));
    float t = saturate((lum - 0.5) * contrast + 0.5);
    float3 duo = lerp(shadow_color.rgb, highlight_color.rgb, t);
    return float4(lerp(base.rgb, duo, mix_amount), base.a);
}

technique Draw
{
    pass
    {
        vertex_shader = mainTransform(v_in);
        pixel_shader  = mainImage(v_in);
    }
}
