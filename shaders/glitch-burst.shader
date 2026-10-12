// glitch-burst.shader — random block displacement with RGB split. obs-shaderfilter.
// Library preset: Glitch Burst.
// Params: glitch_amount, block_size (px), rgb_split (px), speed (changes per second)
// Photosensitivity: keep speed low (<= 4) if you or your viewers are sensitive to flicker.

uniform float4x4 ViewProj;
uniform texture2d image;
uniform float elapsed_time;
uniform float2 uv_size;
uniform float2 uv_pixel_interval;

uniform float glitch_amount<
    string label = "Glitch Amount";
    string widget_type = "slider";
    float minimum = 0.0;
    float maximum = 1.0;
    float step = 0.01;
> = 0.6;

uniform float block_size<
    string label = "Block Size (px)";
    string widget_type = "slider";
    float minimum = 2.0;
    float maximum = 128.0;
    float step = 1.0;
> = 24.0;

uniform float rgb_split<
    string label = "RGB Split (px)";
    string widget_type = "slider";
    float minimum = 0.0;
    float maximum = 30.0;
    float step = 0.5;
> = 6.0;

uniform float speed<
    string label = "Speed";
    string widget_type = "slider";
    float minimum = 0.0;
    float maximum = 20.0;
    float step = 0.01;
> = 4.0;

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
    float t = floor(elapsed_time * speed);
    float2 blk = floor(uv * uv_size / max(block_size, 1.0));

    // A block is "hit" this tick with probability proportional to glitch_amount.
    float hit = step(1.0 - glitch_amount, hash21(float2(blk.y, t + blk.x * 0.37)));
    float shove = (hash21(float2(blk.y + 31.0, t)) - 0.5) * glitch_amount * 0.3 * hit;
    uv.x = uv.x + shove;

    float split = rgb_split * hit * uv_pixel_interval.x;
    float4 sr = image.Sample(textureSampler, uv + float2(split, 0.0));
    float4 sg = image.Sample(textureSampler, uv);
    float4 sb = image.Sample(textureSampler, uv - float2(split, 0.0));
    float a = max(sr.a, max(sg.a, sb.a));
    float3 rgb = float3(sr.r * sr.a, sg.g * sg.a, sb.b * sb.a) / max(a, 0.0001);
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
