/** Artistic homepage particles; never part of the scientific observing scene. */
export function createStarFlight(canvas:HTMLCanvasElement){
  const gl=canvas.getContext('webgl2',{alpha:true,antialias:false,depth:false,premultipliedAlpha:true,powerPreference:'low-power'});
  if(!gl)return null;
  const vertexSource=`#version 300 es
  precision highp float;
  in vec4 seed;
  uniform vec2 viewport,steering;
  uniform float journey,speed,densityScale;
  out vec2 shape;
  out float opacity;
  out vec3 tint;
  const vec2 corners[6]=vec2[6](vec2(-1.,-1.),vec2(1.,-1.),vec2(-1.,1.),vec2(-1.,1.),vec2(1.,-1.),vec2(1.,1.));
  void main(){
    float z=mod(seed.z-journey,30.)+.55;
    vec2 centre=vec2(viewport.x*(viewport.x>700.? .65:.59),viewport.y*.43);
    vec2 world=seed.xy-steering*vec2(.6,.36);
    float focal=min(viewport.x,viewport.y)*.86;
    vec2 position=centre+world*focal/z;
    vec2 previous=centre+world*focal/(z+speed*.045);
    vec2 ray=position-centre;
    vec2 direction=length(ray)>.001?normalize(ray):vec2(1.,0.);
    vec2 perpendicular=vec2(-direction.y,direction.x);
    float radius=clamp((.48+seed.w*.55+2.6/z)*densityScale,.6,3.4*densityScale);
    float streak=min(length(position-previous),90.*densityScale);
    vec2 corner=corners[gl_VertexID];
    vec2 point=position+direction*corner.x*(radius+streak*.5)+perpendicular*corner.y*radius;
    gl_Position=vec4(point/viewport*vec2(2.,-2.)+vec2(-1.,1.),0.,1.);
    shape=corner;
    float emergence=(1.-smoothstep(25.,30.55,z))*smoothstep(.55,2.,z);
    float textProtection=mix(.22,1.,smoothstep(.20,.68,position.x/viewport.x));
    opacity=emergence*(.18+seed.w*.42)*textProtection;
    tint=mix(vec3(.52,.72,1.),vec3(1.,.88,.69),step(.86,seed.w));
  }`;
  const fragmentSource=`#version 300 es
  precision highp float;
  in vec2 shape;
  in float opacity;
  in vec3 tint;
  out vec4 colour;
  void main(){
    float core=exp(-dot(shape,shape)*4.);
    float edge=(1.-smoothstep(.65,1.,abs(shape.y)))*(1.-smoothstep(.4,1.,abs(shape.x)));
    colour=vec4(tint,opacity*(core*.85+edge*.15));
  }`;
  const compile=(kind:number,source:string)=>{const shader=gl.createShader(kind);if(!shader)return null;gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){gl.deleteShader(shader);return null;}return shader;};
  const vertex=compile(gl.VERTEX_SHADER,vertexSource),fragment=compile(gl.FRAGMENT_SHADER,fragmentSource);
  if(!vertex||!fragment){if(vertex)gl.deleteShader(vertex);if(fragment)gl.deleteShader(fragment);return null;}
  const program=gl.createProgram();if(!program){gl.deleteShader(vertex);gl.deleteShader(fragment);return null;}
  gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);gl.deleteShader(vertex);gl.deleteShader(fragment);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS)){gl.deleteProgram(program);return null;}
  const buffer=gl.createBuffer();if(!buffer){gl.deleteProgram(program);return null;}
  const count=1050,particles=new Float32Array(count*4);let state=3719;
  const fraction=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  for(let index=0;index<count;index++)particles.set([(fraction()-.5)*55,(fraction()-.5)*38,fraction()*30,fraction()],index*4);
  gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,particles,gl.STATIC_DRAW);
  const seed=gl.getAttribLocation(program,'seed');gl.enableVertexAttribArray(seed);gl.vertexAttribPointer(seed,4,gl.FLOAT,false,0,0);gl.vertexAttribDivisor(seed,1);
  const uniforms=Object.fromEntries(['viewport','steering','journey','speed','densityScale'].map(name=>[name,gl.getUniformLocation(program,name)]));
  gl.disable(gl.DEPTH_TEST);gl.enable(gl.BLEND);gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.clearColor(0,0,0,0);
  return {
    draw(journey:number,speed:number,steeringX:number,steeringY:number){
      const rect=canvas.getBoundingClientRect(),ratio=Math.min(window.devicePixelRatio||1,1.75);
      const width=Math.max(1,Math.round(rect.width*ratio)),height=Math.max(1,Math.round(rect.height*ratio));
      if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;gl.viewport(0,0,width,height);}
      gl.clear(gl.COLOR_BUFFER_BIT);gl.useProgram(program);
      gl.uniform2f(uniforms.viewport,width,height);gl.uniform2f(uniforms.steering,steeringX,steeringY);
      gl.uniform1f(uniforms.journey,journey);gl.uniform1f(uniforms.speed,speed);gl.uniform1f(uniforms.densityScale,ratio);
      gl.drawArraysInstanced(gl.TRIANGLES,0,6,rect.width<700?650:count);
    },
    dispose(){gl.deleteBuffer(buffer);gl.deleteProgram(program);},
  };
}
