// heat-wave.shader — slow rippling air distortion. obs-shaderfilter.
// Library preset: Heat Wave.
// Params: wave_amplitude (fraction of the source size), wave_frequency, speed
// NOTE: displacement pushes pixels past the source edge; leave a little empty room around the text.

uniform float4x4 ViewProj;
uniform texture2d image;
uniform float elapsed_time;

uniform float wave_amplitude<
    string label = "Wave Amplitude";
    string widget_type = "slider";
    float minimum = 0.0;
    float maximum = 0.1;
    float step = 0.001;
> = 0.01;

uniform float wave_frequency<
    string label = "Wave Frequency";
    string widget_type = "slider";
    float minimum = 1.0;
    float maximum = 60.0;
    float step = 0.5;
> = 12.0;

uniform float speed<
    string label = "Speed";
    string widget_type = "slider";
    float minimum = 0.0;
    float maximum = 10.0;
    float step = 0.01;
> = 1.5;

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
    float t = elapsed_time * speed;
    uv.x = uv.x + sin(uv.y * wave_frequency + t) * wave_amplitude;
    uv.y = uv.y + cos(uv.x * wave_frequency * 0.8 + t * 1.3) * wave_amplitude * 0.6;
    return image.Sample(textureSampler, uv);
}

technique Draw
{
    pass
    {
        vertex_shader = mainTransform(v_in);
        pixel_shader  = mainImage(v_in);
    }
}
