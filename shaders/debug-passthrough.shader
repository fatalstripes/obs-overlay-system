// debug-passthrough.shader — returns the source unchanged. Diagnostic only (not in the library).
// If this pauses a Browser Source's animation, the cause is obs-shaderfilter + that source,
// not any effect code.

uniform float4x4 ViewProj;
uniform texture2d image;

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
    return image.Sample(textureSampler, v_in.uv);
}

technique Draw
{
    pass
    {
        vertex_shader = mainTransform(v_in);
        pixel_shader  = mainImage(v_in);
    }
}
