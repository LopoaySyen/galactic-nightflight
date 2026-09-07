import { flightCamera } from './flight-path.ts';

/** A persistent 3D scene for the artistic homepage, isolated from the observatory. */
export function createStarFlight(canvas: HTMLCanvasElement, onTextureReady?: () => void) {
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, powerPreference: 'low-power' });
  if (!gl) return null;
  const vertex = `#version 300 es
  precision highp float;
  in vec4 seed;
  uniform vec2 viewport;
  uniform vec3 cameraPosition,cameraRight,cameraUp,cameraForward,previousPosition,previousRight,previousUp,previousForward;
  uniform float densityScale,exposure;
  out vec2 shape; out float opacity; out vec3 tint;
  const vec2 corners[6]=vec2[6](vec2(-1.,-1.),vec2(1.,-1.),vec2(-1.,1.),vec2(-1.,1.),vec2(1.,-1.),vec2(1.,1.));
  vec3 viewPoint(vec3 p,vec3 eye,vec3 right,vec3 up,vec3 forward){vec3 d=p-eye;return vec3(dot(d,right),dot(d,up),dot(d,forward));}
  void main(){
    vec3 v=viewPoint(seed.xyz,cameraPosition,cameraRight,cameraUp,cameraForward);
    vec3 old=viewPoint(seed.xyz,previousPosition,previousRight,previousUp,previousForward);
    vec2 centre=viewport*vec2(.58,.49); float focal=viewport.y*.92;
    vec2 position=centre+v.xy*vec2(1.,-1.)*focal/max(.3,v.z);
    vec2 previous=centre+old.xy*vec2(1.,-1.)*focal/max(.3,old.z);
    vec2 movement=position-previous; float lengthOnScreen=length(movement);
    vec2 direction=lengthOnScreen>.001?movement/lengthOnScreen:vec2(1.,0.);
    vec2 perpendicular=vec2(-direction.y,direction.x);
    float radius=clamp((.45+seed.w*.7+2.4/max(1.,v.z))*densityScale,.55,2.8*densityScale);
    float streak=min(lengthOnScreen*.65,50.*densityScale);
    vec2 corner=corners[gl_VertexID];
    vec2 point=position+direction*corner.x*(radius+streak*.5)+perpendicular*corner.y*radius;
    gl_Position=vec4(point/viewport*vec2(2.,-2.)+vec2(-1.,1.),0.,1.); shape=corner;
    float nearFade=smoothstep(.3,2.2,v.z); float farFade=1.-smoothstep(90.,145.,v.z);
    opacity=nearFade*farFade*(.3+seed.w*.7)*exposure;
    tint=mix(vec3(.66,.79,1.),vec3(1.,.83,.62),smoothstep(.77,.98,seed.w));
  }`;
  const fragment = `#version 300 es
  precision highp float; in vec2 shape; in float opacity; in vec3 tint; out vec4 colour;
  void main(){float core=exp(-dot(shape,shape)*5.); colour=vec4(tint,opacity*core);}`;
  const compile = (kind: number, source: string) => { const s = gl.createShader(kind)!; gl.shaderSource(s, source); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { gl.deleteShader(s); return null; } return s; };
  const program = (vs: string, fs: string) => {
    const v = compile(gl.VERTEX_SHADER, vs), f = compile(gl.FRAGMENT_SHADER, fs);
    if (!v || !f) { if (v) gl.deleteShader(v); if (f) gl.deleteShader(f); return null; }
    const p = gl.createProgram()!; gl.attachShader(p, v); gl.attachShader(p, f); gl.linkProgram(p); gl.deleteShader(v); gl.deleteShader(f);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { gl.deleteProgram(p); return null; } return p;
  };
  const stars = program(vertex, fragment); if (!stars) return null;
  const photoProgram = program(`#version 300 es
    precision highp float; uniform vec2 viewport,halfSize; uniform vec3 centre,cameraPosition,cameraRight,cameraUp,cameraForward;
    out vec2 uv; out float distanceFade;
    const vec2 corners[6]=vec2[6](vec2(-1.,-1.),vec2(1.,-1.),vec2(-1.,1.),vec2(-1.,1.),vec2(1.,-1.),vec2(1.,1.));
    void main(){vec2 corner=corners[gl_VertexID];vec3 d=centre+vec3(corner*halfSize,0.)-cameraPosition;
      vec3 v=vec3(dot(d,cameraRight),dot(d,cameraUp),dot(d,cameraForward));float focal=viewport.y*.92;
      gl_Position=vec4(.16*v.z+2.*v.x*focal/viewport.x,.02*v.z+2.*v.y*focal/viewport.y,v.z-.6,v.z);
      uv=corner*vec2(.5,-.5)+.5;distanceFade=smoothstep(.8,7.,v.z)*(1.-smoothstep(70.,125.,v.z));}
  `, `#version 300 es
    precision highp float;uniform sampler2D photo;uniform float strength;in vec2 uv;in float distanceFade;out vec4 colour;
    void main(){vec3 c=texture(photo,uv).rgb;float rim=smoothstep(0.,.19,uv.x)*smoothstep(0.,.19,1.-uv.x)*smoothstep(0.,.16,uv.y)*smoothstep(0.,.16,1.-uv.y);
      c=max(vec3(0.),c-vec3(.024));colour=vec4(c,rim*distanceFade*strength);}
  `);
  const count = 5600, particles = new Float32Array(count * 4); let state = 3719;
  const fraction = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  for (let i = 0; i < count; i++) particles.set([(fraction() - .5) * 115, (fraction() - .5) * 80, fraction() * 230 - 25, fraction()], i * 4);
  const buffer = gl.createBuffer()!, vao = gl.createVertexArray()!; gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, particles, gl.STATIC_DRAW);
  const seed = gl.getAttribLocation(stars, 'seed'); gl.enableVertexAttribArray(seed); gl.vertexAttribPointer(seed, 4, gl.FLOAT, false, 0, 0); gl.vertexAttribDivisor(seed, 1);
  const uniformNames = ['viewport', 'cameraPosition', 'cameraRight', 'cameraUp', 'cameraForward', 'previousPosition', 'previousRight', 'previousUp', 'previousForward', 'densityScale', 'exposure'];
  const uniforms = Object.fromEntries(uniformNames.map(name => [name, gl.getUniformLocation(stars, name)]));
  const pu = photoProgram ? Object.fromEntries(['viewport','centre','halfSize','cameraPosition','cameraRight','cameraUp','cameraForward','photo','strength'].map(name => [name, gl.getUniformLocation(photoProgram, name)])) : {};
  const layers = [
    { source: '/brand/milky-way-4096.webp', centre: [7, 1, 35], size: [30, 15], strength: .68 },
    { source: '/brand/theme-orion.webp', centre: [-8, 4, 70], size: [18, 14], strength: .38 },
    { source: '/brand/theme-andromeda.webp', centre: [10, 2, 118], size: [26, 17], strength: .62 },
  ];
  let disposed = false;
  const textures = layers.map(layer => {
    const texture = gl.createTexture()!, image = new Image(); let ready = false;
    image.onload = () => { if (disposed) return; gl.bindTexture(gl.TEXTURE_2D, texture); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); gl.generateMipmap(gl.TEXTURE_2D); ready = true; onTextureReady?.(); };
    image.src = layer.source; return { texture, image, ready: () => ready };
  });
  gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE); gl.clearColor(.003, .007, .015, 1);
  let previous = flightCamera(0), width = 1, height = 1, ratio = 1;
  const resize = () => { ratio = Math.min(window.devicePixelRatio || 1, 1.5); width = Math.max(1, Math.round(canvas.clientWidth * ratio)); height = Math.max(1, Math.round(canvas.clientHeight * ratio)); canvas.width = width; canvas.height = height; gl.viewport(0, 0, width, height); };
  resize();
  return {
    resize,
    hasPhoto: () => textures.some(item => item.ready()),
    draw(progress: number, swayX: number, swayY: number, reset = false) {
      const camera = flightCamera(progress, swayX, swayY); if (reset) previous = camera;
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (photoProgram) {
        gl.useProgram(photoProgram); gl.bindVertexArray(null); gl.uniform2f(pu.viewport, width, height);
        gl.uniform3fv(pu.cameraPosition, camera.position); gl.uniform3fv(pu.cameraRight, camera.right); gl.uniform3fv(pu.cameraUp, camera.up); gl.uniform3fv(pu.cameraForward, camera.forward);
        layers.forEach((layer, index) => { if (!textures[index].ready()) return; gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, textures[index].texture); gl.uniform1i(pu.photo, 0); gl.uniform3fv(pu.centre, layer.centre); gl.uniform2fv(pu.halfSize, layer.size); gl.uniform1f(pu.strength, layer.strength); gl.drawArrays(gl.TRIANGLES, 0, 6); });
      }
      gl.useProgram(stars); gl.bindVertexArray(vao); gl.uniform2f(uniforms.viewport, width, height);
      for (const [name, value] of Object.entries({ cameraPosition: camera.position, cameraRight: camera.right, cameraUp: camera.up, cameraForward: camera.forward, previousPosition: previous.position, previousRight: previous.right, previousUp: previous.up, previousForward: previous.forward })) gl.uniform3fv(uniforms[name], value);
      gl.uniform1f(uniforms.densityScale, ratio); gl.uniform1f(uniforms.exposure, .7); gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, canvas.clientWidth < 700 ? 3400 : count);
      previous = camera;
    },
    dispose() { disposed = true; textures.forEach(item => { item.image.onload = null; gl.deleteTexture(item.texture); }); gl.deleteBuffer(buffer); gl.deleteVertexArray(vao); gl.deleteProgram(stars); if (photoProgram) gl.deleteProgram(photoProgram); },
  };
}
