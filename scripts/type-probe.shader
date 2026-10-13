// type-probe.shader — diagnostic for scripts/verify-shader-types.mjs (not part of the shader library).
// Paints the frame from its uniforms so the script can read the result back with a screenshot:
//   left half  = probe_color
//   right half = ( probe_int / 255,  probe_bool ? 1 : 0,  probe_float )
// If an int, bool, float or color sent over the WebSocket is dropped, its channel stays at the default (0).
// SETUP: needs "Use Effect File (.effect)" ticked on the filter.

uniform float4x4 ViewProj;
uniform texture2d image;

uniform int probe_int<
    string label = "Probe Int";
    string widget_type = "slider";
    int minimum = 0;
    int maximum = 255;
    int step = 1;
> = 0;

uniform bool probe_bool<
    string label = "Probe Bool";
> = false;

uniform float probe_float<
    string label = "Probe Float";
    string widget_type = "slider";
    float minimum = 0.0;
    float maximum = 1.0;
    float step = 0.01;
> = 0.0;

uniform float4 probe_color<
    string label = "Probe Color";
    string widget_type = "color";
> = {0.0, 0.0, 0.0, 1.0};

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

    float flag = 0.0;
    if (probe_bool) {
        flag = 1.0;
    }
    float3 right = float3(float(probe_int) / 255.0, flag, probe_float);

    float3 rgb = right;
    if (v_in.uv.x < 0.5) {
        rgb = probe_color.rgb;
    }
    return float4(rgb, base.a);
}

technique Draw
{
    pass
    {
        vertex_shader = mainTransform(v_in);
        pixel_shader  = mainImage(v_in);
    }
}
