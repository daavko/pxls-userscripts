#version 300 es

precision highp float;
precision highp int;
precision highp usampler2D;
precision highp sampler2D;

uniform usampler2D u_templateImage;
uniform sampler2D u_styleImage;
uniform int u_styleColorSize;

in vec2 v_texCoord;

out vec4 outColor;

void main() {
    ivec2 templateSize = textureSize(u_templateImage, 0);
    ivec2 styleImageSize = textureSize(u_styleImage, 0);
    ivec2 styleColorsPerSide = styleImageSize / u_styleColorSize;

    uint templateColorIndex = texture(u_templateImage, v_texCoord).r;
    float templateAlpha = float(texture(u_templateImage, v_texCoord).g) / 255.0;

    vec2 templateTexelCoords = fract(v_texCoord * vec2(templateSize));
    vec2 styleTexelCoords = templateTexelCoords / vec2(styleColorsPerSide);

    uint styleColorX = templateColorIndex % uint(styleColorsPerSide.x);
    uint styleColorY = templateColorIndex / uint(styleColorsPerSide.x);
    vec2 styleTexCoord = vec2(float(styleColorX), float(styleColorY)) / vec2(styleColorsPerSide) + styleTexelCoords;

    vec4 styleColor = texture(u_styleImage, styleTexCoord);
    outColor = styleColor * templateAlpha;
}
