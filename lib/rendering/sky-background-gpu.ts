import type { LensView } from '../physics/gravitational-lensing.ts';
import type { ObservationMode, ViewCamera } from "./contracts.ts";
import type { Vector3 } from "../physics/vector.ts";
import type { AtmospherePreset } from "./planet-atmosphere.ts";
import { daylightVisibilityPenaltyMagnitude } from "./planet-atmosphere.ts";
import { createCameraBasis } from "./projection.ts";

const vertexSource=`attribute vec2 position;void main(){gl_Position=vec4(position,0.0,1.0);}`;
const fragmentSource=`precision highp float;
uniform sampler2D sky;
uniform vec2 resolution;
uniform vec3 lensDirection;
uniform float lensDistance,lensStrength,lensShadow;
uniform vec3 forward,cameraRight,cameraUp,zenith,sun;
uniform float tangentHalfFov,exposure,atmosphere,infrared,sunAltitude,daylightPenalty;
const float pi=3.141592653589793;
void main(){
  vec2 screen=gl_FragCoord.xy/resolution*2.0-1.0;
  vec3 direction=normalize(forward+cameraRight*screen.x*tangentHalfFov+cameraUp*screen.y*tangentHalfFov*resolution.y/resolution.x);
  vec3 sampledDirection=direction;
  if(lensStrength>0.0&&lensDistance<1.0){
    float cosine=dot(direction,lensDirection);
    if(cosine>0.0){
      vec3 offset=direction/cosine-lensDirection;
      float theta2=dot(offset,offset);
      if(theta2<lensShadow*lensShadow){gl_FragColor=vec4(0.0,0.0,0.0,1.0);return;}
      if(theta2<400.0*lensStrength)sampledDirection=normalize(lensDirection+offset*(1.0-lensStrength/max(theta2,0.00000000000001)));
    }
  }
  vec2 uv=vec2(atan(sampledDirection.y,sampledDirection.x)/(2.0*pi)+0.5,0.5-asin(clamp(sampledDirection.z,-1.0,1.0))/pi);
  vec3 colour=texture2D(sky,uv).rgb;
  colour=pow(min(vec3(1.0),pow(colour,vec3(2.2))*pow(2.0,exposure)),vec3(1.0/2.2));
  if(atmosphere>0.5){
    float altitude=asin(clamp(dot(direction,zenith),-1.0,1.0))*180.0/pi;
    float twilight=clamp((sunAltitude+18.0)/18.0,0.0,1.0);
    float daylight=clamp((sunAltitude+6.0)/24.0,0.0,1.0);
    if(altitude<=0.0){
      float lift=clamp((altitude+8.0)/8.0,0.0,1.0);
      colour=(vec3(1.0,2.0,3.0)+vec3(2.0,3.0,5.0)*lift+vec3(24.0,27.0,31.0)*daylight)/255.0;
    }else{
      float airMass=clamp(1.0/(sin(radians(altitude))+0.50572*pow(altitude+6.07995,-1.6364)),1.0,40.0);
      float vertical=atmosphere>1.5 ? (infrared>0.5 ? 0.14:0.38) : (infrared>0.5 ? 0.07:0.18);
      vec3 factors=infrared>0.5 ? vec3(0.32,0.5,0.78):vec3(0.72,1.0,1.55);
      colour*=pow(vec3(10.0),-0.4*vertical*airMass*factors)*pow(10.0,-0.4*daylightPenalty);
      float haze=atmosphere>1.5?1.55:1.0;
      float sunward=pow(clamp((dot(direction,sun)+0.2)/1.2,0.0,1.0),4.0);
      float horizon=haze*exp(-altitude/7.5)*(0.035+twilight*(0.18+0.82*sunward));
      float airglow=0.008*haze*exp(-altitude/28.0);
      float daytime=daylight*(0.34+0.66*sqrt(clamp(sin(radians(altitude)),0.0,1.0)));
      float halo=daylight*sunward*sunward;
      vec3 twilightColour=infrared>0.5 ? vec3(22.0,17.0,18.0):vec3(75.0,42.0,23.0);
      colour+=(horizon*twilightColour+airglow*vec3(13.0,24.0,38.0)+daytime*vec3(54.0,94.0,158.0)+halo*vec3(95.0,76.0,44.0))/255.0;
    }
  }
  gl_FragColor=vec4(clamp(colour,0.0,1.0),1.0);
}`;

export interface SkyBackgroundGpuRenderer {
  setSky(pixels: Uint8ClampedArray,width:number,height:number):void;
  render(camera:ViewCamera,width:number,height:number,zenith:Vector3,sun:Vector3,sunAltitude:number,
    atmosphere:AtmospherePreset,mode:ObservationMode,exposure:number,lens?:LensView|null):boolean;
  dispose():void;
}

export function createSkyBackgroundGpuRenderer(canvas:HTMLCanvasElement):SkyBackgroundGpuRenderer|null{
  const gl=canvas.getContext("webgl",{alpha:false,antialias:false,preserveDrawingBuffer:false});if(!gl)return null;
  const compile=(type:number,source:string)=>{const shader=gl.createShader(type)!;gl.shaderSource(shader,source);gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){gl.deleteShader(shader);return null;}return shader;};
  const vertex=compile(gl.VERTEX_SHADER,vertexSource),fragment=compile(gl.FRAGMENT_SHADER,fragmentSource);if(!vertex||!fragment)return null;
  const program=gl.createProgram()!;gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);
  gl.deleteShader(vertex);gl.deleteShader(fragment);if(!gl.getProgramParameter(program,gl.LINK_STATUS)){gl.deleteProgram(program);return null;}
  gl.useProgram(program);
  const buffer=gl.createBuffer()!;gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
  const attribute=gl.getAttribLocation(program,"position");gl.enableVertexAttribArray(attribute);gl.vertexAttribPointer(attribute,2,gl.FLOAT,false,0,0);
  const uniforms=Object.fromEntries(["lensDirection","lensDistance","lensStrength","lensShadow","sky","resolution","forward","cameraRight","cameraUp","zenith","sun","tangentHalfFov","exposure","atmosphere","infrared","sunAltitude","daylightPenalty"].map(name=>[name,gl.getUniformLocation(program,name)]));
  const texture=gl.createTexture()!;gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.uniform1i(uniforms.sky,0);
  let loaded=false;
  return{
    setSky(pixels,width,height){gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,width,height,0,gl.RGBA,gl.UNSIGNED_BYTE,pixels);loaded=true;},
    render(camera,width,height,zenith,sun,sunAltitude,atmosphere,mode,exposure,lens=null){
      if(gl.isContextLost()||!loaded)return false;
      if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
      gl.viewport(0,0,width,height);gl.useProgram(program);
      gl.uniform3f(uniforms.lensDirection,lens?.direction.x??0,lens?.direction.y??0,lens?.direction.z??1);
      gl.uniform1f(uniforms.lensDistance,lens?.distance??0);gl.uniform1f(uniforms.lensStrength,lens?.strength??0);gl.uniform1f(uniforms.lensShadow,lens?.shadowAngle??0);
      const basis=createCameraBasis(camera);gl.uniform2f(uniforms.resolution,width,height);
      for(const [name,value] of [["forward",basis.forward],["cameraRight",basis.right],["cameraUp",basis.up],["zenith",zenith],["sun",sun]] as const)gl.uniform3f(uniforms[name],value.x,value.y,value.z);
      gl.uniform1f(uniforms.tangentHalfFov,Math.tan(camera.horizontalFieldOfViewDegrees*Math.PI/360));
      gl.uniform1f(uniforms.exposure,exposure);gl.uniform1f(uniforms.atmosphere,atmosphere==="space"?0:atmosphere==="earth-clear"?1:2);
      gl.uniform1f(uniforms.infrared,mode==="near-infrared"?1:0);gl.uniform1f(uniforms.sunAltitude,sunAltitude);
      gl.uniform1f(uniforms.daylightPenalty,daylightVisibilityPenaltyMagnitude(sunAltitude,atmosphere));
      gl.drawArrays(gl.TRIANGLES,0,6);return true;
    },
    dispose(){gl.deleteTexture(texture);gl.deleteBuffer(buffer);gl.deleteProgram(program);},
  };
}
