import type { ObservationMode, ViewCamera } from "./contracts.ts";
import type { Vector3 } from "../physics/vector.ts";
import type { PreparedGalaxyPointSource } from "./galaxy-star-renderer.ts";
import type { AtmospherePreset } from "./planet-atmosphere.ts";
import { daylightVisibilityPenaltyMagnitude } from "./planet-atmosphere.ts";
import { createCameraBasis } from "./projection.ts";
import { scintillationGlsl, starScintillationPhase } from "./stellar-scintillation.ts";

const vertexSource = `precision highp float;
attribute vec3 position, velocity, colour;
attribute float magnitude, phase;
uniform vec3 observerOffset, forward, cameraRight, cameraUp, zenith;
uniform vec2 tangentFov;
uniform float elapsedYears, atmosphere, mode, exposure, daylightPenalty, pixelRatio;
uniform float scintillationTime, scintillationEnabled;
varying vec3 starColour;
varying float signal, diameter, pulse;
${scintillationGlsl}
void main() {
  vec3 relative = position + velocity * elapsedYears * 0.000001022712165 - observerOffset;
  float distance = max(length(relative), 0.000001);
  vec3 direction = relative / distance;
  float front = dot(direction, forward);
  float altitude = asin(clamp(dot(direction,zenith),-1.0,1.0)) * 57.295779513;
  float attenuation = 0.0;
  pulse = 1.0;
  if (atmosphere > 0.5) {
    float airMass = clamp(1.0/(sin(radians(max(0.0,altitude))) + 0.50572 * pow(max(0.0,altitude)+6.07995,-1.6364)),1.0,40.0);
    float extinction = atmosphere > 1.5 ? (mode > 2.5 ? 0.14 : 0.38) : (mode > 2.5 ? 0.07 : 0.18);
    attenuation = airMass * extinction;
    if (scintillationEnabled > 0.5) pulse = atmosphericPulse(scintillationTime,phase,airMass,mode);
  }
  float apparent = magnitude + 5.0 * log(distance/10.0)/log(10.0) + attenuation + daylightPenalty;
  float limit = mode < 0.5 ? 6.2 : mode < 1.5 ? 7.1 : mode < 2.5 ? 12.4 : 12.0;
  vec2 screen = vec2(dot(direction,cameraRight),dot(direction,cameraUp))/(max(front,0.00001)*tangentFov);
  if (front <= 0.0 || apparent > limit || (atmosphere > 0.5 && altitude <= 0.0) || abs(screen.x)>1.05 || abs(screen.y)>1.05) {
    gl_Position=vec4(3.0,3.0,0.0,1.0); gl_PointSize=1.0; signal=0.0; starColour=vec3(0.0); diameter=1.0; return;
  }
  float gain = mode < 0.5 ? 105.0 : mode < 1.5 ? 155.0 : mode < 2.5 ? 420.0 : 360.0;
  signal = clamp(1.0-exp(-gain*pow(2.0,exposure)*pow(10.0,-0.4*apparent)),0.0,1.0);
  float white = mode < 0.5 ? clamp(0.64-0.12*signal,0.52,0.64) : mode < 1.5 ? 0.72 : clamp(0.46-0.2*signal,0.24,0.46);
  vec3 spectrum = mode > 2.5 ? vec3(1.0,0.56+colour.r*0.18,0.72+colour.b*0.12) : colour;
  starColour = pow(mix(spectrum,vec3(1.0),white),vec3(1.0/2.2));
  diameter = (signal > 0.15 ? 14.0 : 4.0) * pixelRatio;
  gl_PointSize=diameter; gl_Position=vec4(screen,0.0,1.0);
}`;
const fragmentSource = `precision highp float;
varying vec3 starColour;
varying float signal, diameter, pulse;
uniform float pixelRatio;
void main() {
  float radius=length(gl_PointCoord-vec2(0.5))*diameter/pixelRatio;
  float core=exp(-0.5*pow(radius/(0.38+0.17*signal),2.0))*pow(signal,0.36);
  float glow=signal>0.15 ? 0.065*signal*exp(-radius*radius/8.0) : 0.0;
  float alpha=clamp((core+glow)*pulse,0.0,1.0);
  if(alpha<0.002) discard;
  gl_FragColor=vec4(starColour*alpha,alpha);
}`;

export interface StarGpuRenderer {
  setSources(sources: readonly PreparedGalaxyPointSource[], origin: Vector3): void;
  render(camera: ViewCamera, position: Vector3, timeYears: number, width: number, height: number,
    pixelRatio: number, zenith: Vector3, atmosphere: AtmospherePreset, mode: ObservationMode, exposure: number, sunAltitude: number,
    scintillationTime?: number, scintillationEnabled?: boolean): boolean;
  animateAtmosphere(seconds: number): boolean;
  dispose(): void;
}

/** Upload one packed catalogue, then let the GPU perform live 3-D motion,
 * projection, atmospheric attenuation and point-light rendering. */
export function createStarGpuRenderer(canvas: HTMLCanvasElement): StarGpuRenderer | null {
  const gl=canvas.getContext("webgl",{alpha:true,antialias:false,premultipliedAlpha:true,preserveDrawingBuffer:false});
  if(!gl) return null;
  const compile=(type:number,source:string)=>{const shader=gl.createShader(type)!;gl.shaderSource(shader,source);gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){gl.deleteShader(shader);return null;}return shader;};
  const vertex=compile(gl.VERTEX_SHADER,vertexSource), fragment=compile(gl.FRAGMENT_SHADER,fragmentSource);
  if(!vertex||!fragment) return null;
  const program=gl.createProgram()!;gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);
  gl.deleteShader(vertex);gl.deleteShader(fragment);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS)){gl.deleteProgram(program);return null;}
  gl.useProgram(program);
  const buffer=gl.createBuffer()!;gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
  for(const [name,size,offset] of [["position",3,0],["velocity",3,12],["magnitude",1,24],["colour",3,28],["phase",1,40]] as const){
    const attribute=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(attribute);gl.vertexAttribPointer(attribute,size,gl.FLOAT,false,44,offset);}
  const uniforms=Object.fromEntries(["observerOffset","forward","cameraRight","cameraUp","zenith","tangentFov","elapsedYears","atmosphere","mode","exposure","daylightPenalty","pixelRatio","scintillationTime","scintillationEnabled"].map(name=>[name,gl.getUniformLocation(program,name)]));
  let count=0, epoch=0;
  let origin={x:0,y:0,z:0};
  gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE);gl.clearColor(0,0,0,0);
  return {
    setSources(sources,position){
      origin=position; epoch=sources[0]?.preparationTimeYears??0; count=sources.length;
      const data=new Float32Array(count*11);
      for(let index=0;index<count;index++){
        const source=sources[index], offset=index*11;
        data[offset]=source.emitterPositionParsec.x-origin.x;data[offset+1]=source.emitterPositionParsec.y-origin.y;data[offset+2]=source.emitterPositionParsec.z-origin.z;
        data[offset+3]=source.velocityKilometresPerSecond?.x??0;data[offset+4]=source.velocityKilometresPerSecond?.y??0;data[offset+5]=source.velocityKilometresPerSecond?.z??0;
        data[offset+6]=source.absoluteVisualMagnitude+source.extinctionMagnitude;
        data[offset+7]=source.linearRgb[0];data[offset+8]=source.linearRgb[1];data[offset+9]=source.linearRgb[2];
        data[offset+10]=starScintillationPhase(source.id,index);
      }
      gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);
    },
    render(camera,position,timeYears,width,height,pixelRatio,zenith,atmosphere,mode,exposure,sunAltitude,scintillationTime=0,scintillationEnabled=false){
      if(gl.isContextLost()) return false;
      if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
      gl.viewport(0,0,width,height);gl.useProgram(program);gl.clear(gl.COLOR_BUFFER_BIT);
      const basis=createCameraBasis(camera);
      for(const [name,value] of [["forward",basis.forward],["cameraRight",basis.right],["cameraUp",basis.up],["zenith",zenith]] as const)gl.uniform3f(uniforms[name],value.x,value.y,value.z);
      gl.uniform3f(uniforms.observerOffset,position.x-origin.x,position.y-origin.y,position.z-origin.z);
      const tangent=Math.tan(camera.horizontalFieldOfViewDegrees*Math.PI/360);gl.uniform2f(uniforms.tangentFov,tangent,tangent*height/width);
      gl.uniform1f(uniforms.elapsedYears,timeYears-epoch);gl.uniform1f(uniforms.exposure,exposure);gl.uniform1f(uniforms.pixelRatio,pixelRatio);
      gl.uniform1f(uniforms.atmosphere,atmosphere==="space"?0:atmosphere==="earth-clear"?1:2);
      gl.uniform1f(uniforms.mode,mode==="naked-eye"?0:mode==="dark-adapted"?1:mode==="camera"?2:3);
      gl.uniform1f(uniforms.daylightPenalty,daylightVisibilityPenaltyMagnitude(sunAltitude,atmosphere));
      gl.uniform1f(uniforms.scintillationTime,scintillationTime);
      gl.uniform1f(uniforms.scintillationEnabled,scintillationEnabled?1:0);
      gl.drawArrays(gl.POINTS,0,count);return true;
    },
    animateAtmosphere(seconds){
      if(gl.isContextLost())return false;
      gl.useProgram(program);gl.uniform1f(uniforms.scintillationTime,seconds);
      gl.clear(gl.COLOR_BUFFER_BIT);gl.drawArrays(gl.POINTS,0,count);return true;
    },
    dispose(){gl.deleteBuffer(buffer);gl.deleteProgram(program);},
  };
}
