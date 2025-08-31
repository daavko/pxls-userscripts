#version 300 es

precision highp float;

uniform sampler2D u_image;

uniform float u_pointSize;

in vec2 v_texCoord;

out vec4 outColor;

void main() {
    vec2 texelPosition = fract(v_texCoord * textureSize(u_image, 0));
    vec2 distFromCenter = abs(texelPosition - vec2(0.5));

    vec2 cutoff = step(distFromCenter, u_pointSize * 0.5);
    float alpha = cutoff.x * cutoff.y;

    outColor = texture(u_image, v_texCoord) * alpha;
}
