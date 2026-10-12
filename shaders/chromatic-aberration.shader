// chromatic-aberration.shader — red/blue channel offset that grows toward the edges, plus vignette.
// obs-shaderfilter. Library preset: Chromatic Aberration.
// Params: offset (px), angle (degrees), vignette

uniform float4x4 ViewProj;
uniform texture2d image;
uniform float2 uv_pixel_interval;

uniform float offset<
    string label = "Offset (px)";
    string widget_type = "slider";
    float minimum = 0.0;
    float maximum = 20.0;
    float step = 0.1;
> = 3.0;

uniform float angle<
    string label = "Angle (degrees)";
    string widget_type = "slider";
    float minimum = 0.0;
    float maximum = 360.0;
    float step = 1.0;
> = 0.0;

uniform float vignette<
    string label = "Vignette";
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

float4 mainImage(VertData v_in) : TARGET
{
    float2 uv = v_in.uv;
    float dist = length(uv - 0.5);

    // Offset is half strength at the center and grows toward the corners.
    float rad = angle * 0.0174533;
    float2 dir = float2(cos(rad), sin(rad));
    float2 shift = dir * offset * (0.5 + dist) * uv_pixel_interval;

    float4 sr = image.Sample(textureSampler, uv + shift);
    float4 sg = image.Sample(textureSampler, uv);
    float4 sb = image.Sample(textureSampler, uv - shift);
    float a = max(sr.a, max(sg.a, sb.a));
    float3 rgb = float3(sr.r * sr.a, sg.g * sg.a, sb.b * sb.a) / max(a, 0.0001);

    rgb = rgb * (1.0 - vignette * smoothstep(0.25, 0.75, dist));
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
