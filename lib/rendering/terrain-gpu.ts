import type { ViewCamera } from "./contracts.ts";
import { createCameraBasis } from "./projection.ts";

// Only projects existing landscape assets. No astronomical light is painted
// here. The local frame is shared with stellar extinction and the solar source.
const vertexSource = `attribute vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }`;
const fragmentSource = `precision highp float;
uniform vec2 resolution;
uniform vec3 forward, cameraRight, cameraUp;
uniform float tangentHalfFov, inclination, daylight, exposure;
uniform sampler2D panorama, ground;
const float pi = 3.141592653589793;
void main() {
  vec2 screen = gl_FragCoord.xy / resolution * 2.0 - 1.0;
  vec3 ray = normalize(forward + cameraRight * screen.x * tangentHalfFov +
    cameraUp * screen.y * tangentHalfFov * resolution.y / resolution.x);
  float c = cos(inclination), s = sin(inclination);
  vec3 localRay = vec3(c * ray.x - s * ray.z, ray.y, s * ray.x + c * ray.z);
  float longitude = atan(localRay.y, localRay.x);
  float latitude = asin(clamp(localRay.z, -1.0, 1.0));
  vec4 distant = texture2D(panorama, vec2(fract(longitude / (2.0*pi) + 0.5), 0.5 - latitude/pi));
  float lighting = mix(0.09, 0.95, daylight) * pow(2.0, exposure * 0.45);
  vec3 base = mix(vec3(0.002,0.004,0.007), vec3(0.08,0.095,0.11), daylight);
  vec4 result = localRay.z < 0.0 ? vec4(base,1.0) : vec4(0.0);
  result.rgb = mix(result.rgb, distant.rgb * lighting, distant.a);
  result.a = distant.a + result.a * (1.0 - distant.a);
  if (localRay.z < -0.002) {
    vec2 hit = localRay.xy * (1.65 / -localRay.z);
    float distance = length(hit);
    float blend = (1.0-smoothstep(35.0,180.0,distance)) * smoothstep(0.002,0.035,-localRay.z);
    vec3 textureColour = texture2D(ground, hit / 17.0 + vec2(0.173,0.417)).rgb;
    result.rgb = mix(result.rgb, textureColour * lighting, blend);
    result.a = max(result.a, blend);
  }
  gl_FragColor = vec4(result.rgb, result.a);
}`;

export interface TerrainGpuRenderer {
  canvas: HTMLCanvasElement;
  render(camera: ViewCamera, width: number, height: number, inclination: number, daylight: number, exposure: number): boolean;
  dispose(): void;
}

export function createTerrainGpuRenderer(panorama: HTMLImageElement, ground: HTMLImageElement, targetCanvas?: HTMLCanvasElement): TerrainGpuRenderer | null {
  const canvas = targetCanvas ?? document.createElement("canvas");
  const gl = canvas.getContext("webgl", { alpha: true, antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: !targetCanvas });
  if (!gl) return null;
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  };
  const vertex = compile(gl.VERTEX_SHADER, vertexSource);
  const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
  if (!vertex || !fragment) return null;
  const program = gl.createProgram()!;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { gl.deleteProgram(program); return null; }
  gl.useProgram(program);
  const buffer = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
  const attribute = gl.getAttribLocation(program, "position");
  gl.enableVertexAttribArray(attribute);
  gl.vertexAttribPointer(attribute, 2, gl.FLOAT, false, 0, 0);
  const uniforms = Object.fromEntries(["resolution","forward","cameraRight","cameraUp","tangentHalfFov","inclination","daylight","exposure","panorama","ground"].map(name => [name, gl.getUniformLocation(program, name)]));
  const textures: WebGLTexture[] = [];
  for (const [unit, asset] of [panorama, ground].entries()) {
    const texture = gl.createTexture()!;
    textures.push(texture);
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    // Upload power-of-two rasters so mipmaps remove distant ground shimmer.
    const upload = document.createElement("canvas");
    const maximum = Math.min(4096, gl.getParameter(gl.MAX_TEXTURE_SIZE));
    upload.width = Math.min(maximum, 2 ** Math.ceil(Math.log2(asset.naturalWidth)));
    upload.height = Math.min(maximum, 2 ** Math.ceil(Math.log2(asset.naturalHeight)));
    upload.getContext("2d")!.drawImage(asset, 0, 0, upload.width, upload.height);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, upload);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, unit === 0 ? gl.CLAMP_TO_EDGE : gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.uniform1i(uniforms[unit === 0 ? "panorama" : "ground"], unit);
  }
  return {
    canvas,
    render(camera, width, height, inclination, daylight, exposure) {
      if (gl.isContextLost()) return false;
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
      gl.viewport(0, 0, width, height);
      gl.useProgram(program);
      const basis = createCameraBasis(camera);
      gl.uniform2f(uniforms.resolution, width, height);
      for (const [name, vector] of [["forward",basis.forward],["cameraRight",basis.right],["cameraUp",basis.up]] as const) gl.uniform3f(uniforms[name], vector.x, vector.y, vector.z);
      gl.uniform1f(uniforms.tangentHalfFov, Math.tan(camera.horizontalFieldOfViewDegrees * Math.PI / 360));
      gl.uniform1f(uniforms.inclination, inclination * Math.PI / 180);
      gl.uniform1f(uniforms.daylight, daylight);
      gl.uniform1f(uniforms.exposure, exposure);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      return true;
    },
    dispose() { for (const texture of textures) gl.deleteTexture(texture); gl.deleteBuffer(buffer); gl.deleteProgram(program); },
  };
}
