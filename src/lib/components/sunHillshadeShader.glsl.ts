export const vertexShader = `#version 100
attribute vec2 a_position;
attribute vec2 a_uv;

varying vec2 v_uv;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_uv = a_uv;
}
`;

export const fragmentShader = `#version 100
precision highp float;

uniform sampler2D u_dem;
uniform float u_sunAzimuth;
uniform float u_sunElevation;
uniform vec2 u_texelSize;

varying vec2 v_uv;

float decodeElevation(vec4 rgba) {
  return (rgba.r * 256.0 + rgba.g + rgba.b / 256.0) * 255.0 - 32768.0;
}

void main() {
  if (u_sunElevation <= 0.0) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 0.55);
    return;
  }

  float z   = decodeElevation(texture2D(u_dem, v_uv));
  float zN  = decodeElevation(texture2D(u_dem, v_uv + vec2(0.0, -u_texelSize.y)));
  float zS  = decodeElevation(texture2D(u_dem, v_uv + vec2(0.0, u_texelSize.y)));
  float zW  = decodeElevation(texture2D(u_dem, v_uv + vec2(-u_texelSize.x, 0.0)));
  float zE  = decodeElevation(texture2D(u_dem, v_uv + vec2(u_texelSize.x, 0.0)));
  float zNW = decodeElevation(texture2D(u_dem, v_uv + vec2(-u_texelSize.x, -u_texelSize.y)));
  float zNE = decodeElevation(texture2D(u_dem, v_uv + vec2(u_texelSize.x, -u_texelSize.y)));
  float zSW = decodeElevation(texture2D(u_dem, v_uv + vec2(-u_texelSize.x, u_texelSize.y)));
  float zSE = decodeElevation(texture2D(u_dem, v_uv + vec2(u_texelSize.x, u_texelSize.y)));

  float dzdx = (zNE + 2.0 * zE + zSE - (zNW + 2.0 * zW + zSW)) / 8.0;
  float dzdy = (zNW + 2.0 * zN + zNE - (zSW + 2.0 * zS + zSE)) / 8.0;

  float slope = atan(sqrt(dzdx * dzdx + dzdy * dzdy));
  float aspect = atan(-dzdx, -dzdy);

  float zen = radians(90.0 - u_sunElevation);
  float az = radians(u_sunAzimuth);

  float h = cos(zen) * cos(slope) + sin(zen) * sin(slope) * cos(az - aspect);
  h = clamp(h, 0.0, 1.0);

  gl_FragColor = vec4(vec3(h), 0.55);
}
`;
