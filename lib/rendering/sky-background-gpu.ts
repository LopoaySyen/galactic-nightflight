import type { LensView } from '../physics/gravitational-lensing.ts';
import type { ObservationMode, ViewCamera } from "./contracts.ts";
import type { Vector3 } from "../physics/vector.ts";
import type { AtmospherePreset } from "./planet-atmosphere.ts";
import { daylightVisibilityPenaltyMagnitude } from "./planet-atmosphere.ts";
import { createCameraBasis } from "./projection.ts";
import type { GalaxyColourGrade } from "./galaxy-radiance.ts";
import type { GalacticFieldCache } from "./galaxy-field-cache.ts";
import type { SkyComputeResult } from "./sky-compute.worker.ts";
import { galaxyVolumeShader } from "./galaxy-volume-shader.ts";

const vertexSource=`attribute vec2 position;void main(){gl_Position=vec4(position,0.0,1.0);}`;
const fragmentSource=`precision highp float;
uniform sampler2D sky;
uniform sampler2D coarseSky;
uniform float refinementWeight;
uniform vec2 resolution;
uniform vec3 lensDirection;
uniform float lensDistance,lensStrength,lensShadow;
uniform vec3 forward,cameraRight,cameraUp,zenith,sun;
uniform float tangentHalfFov,exposure,atmosphere,infrared,sunAltitude,daylightPenalty;
const float pi=3.141592653589793;
${galaxyVolumeShader}
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
  vec3 colour;
  if(fieldReady>0.5){
    colour=cachedGalaxy(sampledDirection);
    // A residual adds detail without replacing the sharp, current-view volume
    // with an enlarged all-sky image. It fades with distance from its own origin.
    if(refinementWeight>0.0)colour+=refinementWeight*(texture2D(sky,uv).rgb-texture2D(coarseSky,uv).rgb);
    colour=clamp(colour,0.0,1.0);
  }else colour=texture2D(sky,uv).rgb;
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
  setSky(result: SkyComputeResult):void;
  setFieldCache(cache: GalacticFieldCache):boolean;
  captureCoarseSky(position:Vector3,mode:ObservationMode,grade:GalaxyColourGrade,width:number):Uint8ClampedArray|null;
  render(camera:ViewCamera,width:number,height:number,zenith:Vector3,sun:Vector3,sunAltitude:number,
    atmosphere:AtmospherePreset,mode:ObservationMode,exposure:number,lens?:LensView|null,
    position?:Vector3,grade?:GalaxyColourGrade):boolean;
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
  const uniforms=Object.fromEntries(["lensDirection","lensDistance","lensStrength","lensShadow","sky","coarseSky","fieldAtlas","fieldReady","observation","immersive","observerPosition","refinementWeight","resolution","forward","cameraRight","cameraUp","zenith","sun","tangentHalfFov","exposure","atmosphere","infrared","sunAltitude","daylightPenalty"].map(name=>[name,gl.getUniformLocation(program,name)]));
  const texture=gl.createTexture()!;gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.uniform1i(uniforms.sky,0);
  const fieldTexture=gl.createTexture()!,coarseTexture=gl.createTexture()!;
  const upload=(target:WebGLTexture,unit:number,data:Uint8Array|Uint8ClampedArray,width:number,height:number)=>{
    gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,target);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,width,height,0,gl.RGBA,gl.UNSIGNED_BYTE,data);
  };
  // All sampler units must be complete even before the asynchronous cache arrives.
  for(const [target,unit] of [[texture,0],[fieldTexture,1],[coarseTexture,2]] as const)upload(target,unit,new Uint8Array([0,0,0,255]),1,1);
  gl.uniform1i(uniforms.fieldAtlas,1);gl.uniform1i(uniforms.coarseSky,2);
  let loaded=false,fieldLoaded=false,refinement:SkyComputeResult|null=null,refinementStarted=0;
  let captureProgram:WebGLProgram|null=null;
  let frame:number|null=null,lastArgs:Parameters<SkyBackgroundGpuRenderer["render"]>|null=null;
  const animate=()=>{
    frame=null;
    if(lastArgs)renderer.render(...lastArgs);
    if(performance.now()-refinementStarted<300)frame=requestAnimationFrame(animate);
  };
  const renderer:SkyBackgroundGpuRenderer={
    setFieldCache(cache){
      if(Math.max(cache.width,cache.height)>gl.getParameter(gl.MAX_TEXTURE_SIZE))return false;
      upload(fieldTexture,1,cache.data,cache.width,cache.height);fieldLoaded=true;return true;
    },
    captureCoarseSky(position,mode,grade,width){
      if(!fieldLoaded||gl.isContextLost())return null;
      // One small offscreen pass per settled position supplies the residual's
      // baseline. Never read back the live canvas or repeat this during travel.
      if(!captureProgram){
        const vertex=compile(gl.VERTEX_SHADER,vertexSource);
        const fragment=compile(gl.FRAGMENT_SHADER,`precision highp float;
          uniform vec2 resolution;${galaxyVolumeShader}
          void main(){
            float longitude=-3.141592653589793+gl_FragCoord.x/resolution.x*6.283185307179586;
            float latitude=1.570796326794897-gl_FragCoord.y/resolution.y*3.141592653589793;
            gl_FragColor=vec4(cachedGalaxy(vec3(cos(latitude)*cos(longitude),cos(latitude)*sin(longitude),sin(latitude))),1.0);
          }`);
        if(!vertex||!fragment)return null;
        const candidate=gl.createProgram()!;gl.attachShader(candidate,vertex);gl.attachShader(candidate,fragment);gl.linkProgram(candidate);
        gl.deleteShader(vertex);gl.deleteShader(fragment);
        if(!gl.getProgramParameter(candidate,gl.LINK_STATUS)){gl.deleteProgram(candidate);return null;}
        captureProgram=candidate;
      }
      const height=width/2,target=gl.createTexture()!,framebuffer=gl.createFramebuffer()!;
      gl.activeTexture(gl.TEXTURE3);gl.bindTexture(gl.TEXTURE_2D,target);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,width,height,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
      gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,target,0);
      let pixels:Uint8ClampedArray|null=null;
      if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE){
        gl.useProgram(captureProgram);gl.viewport(0,0,width,height);
        gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
        const captureAttribute=gl.getAttribLocation(captureProgram,"position");gl.enableVertexAttribArray(captureAttribute);gl.vertexAttribPointer(captureAttribute,2,gl.FLOAT,false,0,0);
        gl.uniform1i(gl.getUniformLocation(captureProgram,"fieldAtlas"),1);
        gl.uniform2f(gl.getUniformLocation(captureProgram,"resolution"),width,height);
        gl.uniform3f(gl.getUniformLocation(captureProgram,"observerPosition"),position.x,position.y,position.z);
        gl.uniform1f(gl.getUniformLocation(captureProgram,"observation"),mode==="near-infrared"?3:mode==="camera"?2:mode==="dark-adapted"?1:0);
        gl.uniform1f(gl.getUniformLocation(captureProgram,"immersive"),grade==="immersive"?1:0);
        gl.drawArrays(gl.TRIANGLES,0,6);
        const bytes=new Uint8Array(width*height*4);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,bytes);pixels=new Uint8ClampedArray(bytes.buffer);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.deleteFramebuffer(framebuffer);gl.deleteTexture(target);
      gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.enableVertexAttribArray(attribute);gl.vertexAttribPointer(attribute,2,gl.FLOAT,false,0,0);
      return pixels;
    },
    setSky(result){
      upload(texture,0,result.pixels,result.width,result.height);loaded=true;
      refinement=result.coarsePixels?result:null;
      if(result.coarsePixels)upload(coarseTexture,2,result.coarsePixels,result.width,result.height);
      refinementStarted=performance.now();
      if(frame===null)frame=requestAnimationFrame(animate);
    },
    render(camera,width,height,zenith,sun,sunAltitude,atmosphere,mode,exposure,lens=null,position={x:0,y:0,z:0},grade="observational"){
      if(gl.isContextLost()||(!loaded&&!fieldLoaded))return false;
      if(fieldLoaded){
        const scale=Math.min(1,800/width,Math.sqrt(400000/(width*height)));
        width=Math.max(1,Math.round(width*scale));height=Math.max(1,Math.round(height*scale));
      }
      lastArgs=[camera,width,height,zenith,sun,sunAltitude,atmosphere,mode,exposure,lens,position,grade];
      if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
      gl.viewport(0,0,width,height);gl.useProgram(program);
      gl.uniform1f(uniforms.fieldReady,fieldLoaded?1:0);
      gl.uniform3f(uniforms.observerPosition,position.x,position.y,position.z);
      gl.uniform1f(uniforms.observation,mode==="near-infrared"?3:mode==="camera"?2:mode==="dark-adapted"?1:0);
      gl.uniform1f(uniforms.immersive,grade==="immersive"?1:0);
      const distance=refinement?Math.hypot(position.x-refinement.position.x,position.y-refinement.position.y,4*(position.z-refinement.position.z)):Infinity;
      const relativeDistance=Math.min(1,distance/120);
      const proximity=1-relativeDistance*relativeDistance*(3-2*relativeDistance);
      const weight=refinement?.mode===mode&&refinement.grade===grade?proximity*Math.min(1,(performance.now()-refinementStarted)/300):0;
      gl.uniform1f(uniforms.refinementWeight,weight);
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
    dispose(){if(frame!==null)cancelAnimationFrame(frame);gl.deleteTexture(texture);gl.deleteTexture(fieldTexture);gl.deleteTexture(coarseTexture);gl.deleteBuffer(buffer);gl.deleteProgram(program);if(captureProgram)gl.deleteProgram(captureProgram);},
  };
  return renderer;
}
