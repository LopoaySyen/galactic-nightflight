import type { CompactObject } from './compact-object-catalog.ts';
import type { Vector3 } from '../physics/vector.ts';
import type { ViewCamera } from './contracts.ts';
import { createCameraBasis,projectDirectionPerspective } from './projection.ts';
import { lensView } from '../physics/gravitational-lensing.ts';
import { schwarzschildRayTable,schwarzschildLookupGlsl,thermalSpectrumTexture,thinDiscTemperature,type SchwarzschildRayTable } from '../physics/schwarzschild.ts';

const vertex=`attribute vec2 position;void main(){gl_Position=vec4(position,0.0,1.0);}`;
const fragment=`precision highp float;
${schwarzschildLookupGlsl}
uniform sampler2D rayEscape,thermal,sky;
uniform vec2 resolution;
uniform vec3 forward,cameraRight,cameraUp,toHole,discNormal;
uniform float tangentHalfFov,temperatureScale,exposure,backgroundExposure,skyLoaded,bolometric,artistic;
const float pi=3.141592653589793;
float fluxShape(float r){
  float x=sqrt(2.0*r),x0=sqrt(6.0),s=sqrt(3.0);
  float integral=x-x0-s*.5*log((x-s)*(x0+s)/((x+s)*(x0-s)));
  return max(0.0,integral)/(pow(x,5.0)*(x*x-3.0));
}
vec3 spectrum(float temperature){
  float x=(clamp((log(max(100.0,temperature))/log(10.0)-2.0)/5.0,0.0,1.0)*1023.0+.5)/1024.0;
  return exp2(vec3(unpack16(texture2D(thermal,vec2(x,1.0/6.0))),unpack16(texture2D(thermal,vec2(x,.5))),unpack16(texture2D(thermal,vec2(x,5.0/6.0))))*160.0-80.0);
}
vec3 showRadiance(vec3 radiance){return pow(vec3(1.0)-exp(-radiance*exp2(exposure)),vec3(1.0/2.2));}
float grain(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){
  vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
  return mix(mix(grain(i),grain(i+vec2(1.0,0.0)),f.x),mix(grain(i+vec2(0.0,1.0)),grain(i+vec2(1.0,1.0)),f.x),f.y);
}
vec3 paintedDisc(vec3 point,float r,float g,float total){
  // Artwork lives on the disc, so the same ray tracing bends its filaments.
  float azimuth=atan(point.y,point.x),spiral=azimuth+1.8*log(r);
  vec2 flow=vec2(cos(spiral),sin(spiral))*r;
  float clouds=.58*noise(flow*.8)+.28*noise(flow*2.1)+.14*noise(flow*5.7);
  float strands=pow(.5+.5*sin(r*7.5+clouds*9.0+2.0*sin(3.0*azimuth)),3.0);
  float structure=(.32+1.15*clouds)*(.6+.85*strands);
  float heat=clamp(pow(fluxShape(r)/fluxShape(5.0),.25)*g,0.0,1.5);
  vec3 amber=mix(vec3(1.0,.09,.012),vec3(1.0,.48,.10),smoothstep(.25,1.0,heat));
  vec3 tint=mix(amber,vec3(1.0,.84,.54),smoothstep(1.02,1.5,heat));
  return tint*total*structure*3.8;
}
void main(){
  vec2 p=gl_FragCoord.xy/resolution*2.0-1.0;
  vec3 direction=normalize(forward+cameraRight*p.x*tangentHalfFov+cameraUp*p.y*tangentHalfFov*resolution.y/resolution.x);
  float cosine=dot(direction,toHole);if(cosine<=0.0)discard;
  vec3 offset=direction-toHole*cosine;
  float sine=length(offset),b=relativisticRadius*sine/sqrt(1.0-1.0/relativisticRadius);
  if(b>=64.0)discard;
  vec3 axis=sine>1e-7?offset/sine:cameraRight;
  vec3 radial=-toHole;
  float phi=atan(-dot(discNormal,radial),dot(discNormal,axis));
  if(phi<=0.0)phi+=pi;
  // Photon angular momentum has the opposite sign to the backward-traced ray.
  float lambda=-b*dot(cross(radial,axis),discNormal);
  vec3 colour=vec3(0.0);float transmission=1.0;
  for(int crossing=0;crossing<3;crossing++){
    float angle=phi+float(crossing)*pi;
    float r=orbitRadius(b,angle);
    float opacity=discOpacity(r);
    if(transmission>0.0 && opacity>0.0){
      float omega=1.0/sqrt(2.0*r*r*r);
      float g=sqrt(1.0-1.5/r)/(sqrt(1.0-1.0/relativisticRadius)*(1.0-omega*lambda));
      float temperature=temperatureScale*pow(fluxShape(r),.25);
      // I_nu/nu^3 is invariant: a redshifted blackbody is Planck at g*T.
      vec3 optical=spectrum(g*temperature);
      vec3 radiance;
      float total=5.670374419e-8*pow(g*temperature,4.0)/pi/1e10;
      if(artistic>.5){
        vec3 point=(radial*cos(angle)+axis*sin(angle))*r;
        radiance=paintedDisc(point,r,g,total);
      }else if(bolometric>.5){
        // Bolometric intensity is sigma (gT)^4 / pi; colour encodes thermal hue.
        vec3 hue=optical/max(max(optical.r,optical.g),max(optical.b,1e-20));
        radiance=hue*total;
      }else radiance=optical;
      colour+=transmission*opacity*pow(showRadiance(radiance),vec3(2.2));
      transmission*=1.0-opacity;
    }
  }
  if(transmission>0.0){
    vec4 escaped=texture2D(rayEscape,vec2((orbitColumn(b)+.5)/1024.0,.5));
    if(escaped.b>.99&&skyLoaded>.5){
      float angle=unpack16(escaped)*3.0*pi;
      vec3 farDirection=radial*cos(angle)+axis*sin(angle);
      vec2 uv=vec2(atan(farDirection.y,farDirection.x)/(2.0*pi)+.5,.5-asin(clamp(farDirection.z,-1.0,1.0))/pi);
      colour+=transmission*min(vec3(1.0),pow(texture2D(sky,uv).rgb,vec3(2.2))*exp2(backgroundExposure));
    }
  }
  gl_FragColor=vec4(pow(clamp(colour,0.0,1.0),vec3(1.0/2.2)),1.0);
}`;

export interface CompactGpuRenderer {
  setSky(pixels:Uint8ClampedArray,width:number,height:number):void;
  render(object:CompactObject|undefined,observer:Vector3,camera:ViewCamera,width:number,height:number,exposure:number,eddingtonRatio:number,bolometric:boolean,artistic:boolean,backgroundExposure:number):boolean;
  dispose():void;
}
export function nearestResolvedCompact(objects:readonly CompactObject[],observer:Vector3,camera:ViewCamera,width:number,height:number) {
  return objects.filter(object=>{
    const lens=lensView(object,observer);if(!lens)return false;
    const radius=2/lens.strength;
    const p=projectDirectionPerspective(lens.direction,camera,width,height);
    return radius>=65 && radius<1e6 && p.forwardCosine>0 &&
      Math.tan(lens.shadowAngle)*width/(2*Math.tan(camera.horizontalFieldOfViewDegrees*Math.PI/360))>=1;
  }).sort((a,b)=>lensView(b,observer)!.strength-lensView(a,observer)!.strength)[0];
}
export function createCompactGpuRenderer(canvas:HTMLCanvasElement):CompactGpuRenderer|null {
  const gl=canvas.getContext('webgl',{alpha:true,antialias:false,premultipliedAlpha:true});if(!gl)return null;
  const compile=(type:number,source:string)=>{const shader=gl.createShader(type)!;gl.shaderSource(shader,source);gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){console.error('Relativistic renderer:',gl.getShaderInfoLog(shader));gl.deleteShader(shader);return null;}return shader;};
  const vs=compile(gl.VERTEX_SHADER,vertex),fs=compile(gl.FRAGMENT_SHADER,fragment);if(!vs||!fs)return null;
  const program=gl.createProgram()!;gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS)){gl.deleteProgram(program);return null;}
  gl.useProgram(program);
  const buffer=gl.createBuffer()!;gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
  const attribute=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(attribute);gl.vertexAttribPointer(attribute,2,gl.FLOAT,false,0,0);
  const uniforms=Object.fromEntries(['rayOrbits','rayInverse','rayEscape','thermal','sky','resolution','forward','cameraRight','cameraUp','toHole','discNormal','tangentHalfFov','relativisticRadius','temperatureScale','exposure','backgroundExposure','skyLoaded','bolometric','artistic','discEdgeFade'].map(name=>[name,gl.getUniformLocation(program,name)]));
  const textures=['rayOrbits','rayInverse','rayEscape','thermal','sky'].map((name,index)=>{
    const texture=gl.createTexture()!;gl.activeTexture(gl.TEXTURE0+index);gl.bindTexture(gl.TEXTURE_2D,texture);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.uniform1i(uniforms[name],index);return texture;
  });
  const upload=(unit:number,width:number,height:number,pixels:Uint8Array|Uint8ClampedArray)=>{gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,textures[unit]);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,width,height,0,gl.RGBA,gl.UNSIGNED_BYTE,pixels);};
  upload(3,1024,3,thermalSpectrumTexture());upload(4,1,1,new Uint8Array([0,0,0,255]));
  let lastTable:SchwarzschildRayTable|undefined,skyLoaded=false;
  return {
    setSky(pixels,width,height){upload(4,width,height,pixels);skyLoaded=true;},
    render(object,observer,camera,width,height,exposure,eddingtonRatio,bolometric,artistic,backgroundExposure){
      if(gl.isContextLost())return false;
      if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
      gl.viewport(0,0,width,height);gl.useProgram(program);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
      if(!object)return false;
      const lens=lensView(object,observer)!;
      const table=schwarzschildRayTable(2/lens.strength);
      if(lastTable!==table){upload(0,1024,512,table.pixels);upload(1,1024,1,table.inverse);upload(2,1024,1,table.escapePixels);lastTable=table;}
      const basis=createCameraBasis(camera);
      for(const [name,v] of [['forward',basis.forward],['cameraRight',basis.right],['cameraUp',basis.up],['toHole',lens.direction],['discNormal',{x:0,y:0,z:1}]] as const)gl.uniform3f(uniforms[name],v.x,v.y,v.z);
      gl.uniform1f(uniforms.bolometric,bolometric?1:0);
      gl.uniform1f(uniforms.artistic,artistic?1:0);gl.uniform1f(uniforms.discEdgeFade,artistic?1:0);
      gl.uniform1f(uniforms.backgroundExposure,backgroundExposure);
      gl.uniform2f(uniforms.resolution,width,height);gl.uniform1f(uniforms.tangentHalfFov,Math.tan(camera.horizontalFieldOfViewDegrees*Math.PI/360));
      gl.uniform1f(uniforms.relativisticRadius,table.observerRadius);gl.uniform1f(uniforms.exposure,exposure);gl.uniform1f(uniforms.skyLoaded,skyLoaded?1:0);
      const r=10,x=Math.sqrt(2*r),x0=Math.sqrt(6),s=Math.sqrt(3),shape=(x-x0-s/2*Math.log((x-s)*(x0+s)/((x+s)*(x0-s))))/(x**5*(x*x-3));
      gl.uniform1f(uniforms.temperatureScale,thinDiscTemperature(r,object.massSolar,eddingtonRatio)/shape**.25);
      gl.drawArrays(gl.TRIANGLES,0,6);return true;
    },
    dispose(){for(const texture of textures)gl.deleteTexture(texture);gl.deleteBuffer(buffer);gl.deleteProgram(program);}
  };
}
