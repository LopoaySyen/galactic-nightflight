import {kerrRayGlsl} from '../physics/kerr.ts';
export const kerrVertex=`#version 300 es
in vec2 position;out vec2 uv;void main(){uv=position*.5+.5;gl_Position=vec4(position,0.0,1.0);}`;
export const kerrGeometryFragment=`#version 300 es
precision highp float;
in vec2 uv;
layout(location=0)out vec4 hit0;layout(location=1)out vec4 hit1;layout(location=2)out vec4 hit2;layout(location=3)out vec4 escapeRay;
uniform vec3 forward,cameraRight,cameraUp,observer;
uniform vec2 tangentFov;
uniform float spin,innerRadius;
${kerrRayGlsl}
void main(){
  hit0=vec4(0.0);hit1=vec4(0.0);hit2=vec4(0.0);escapeRay=vec4(0.0);
  vec2 p=uv*2.0-1.0;vec3 direction=normalize(forward+cameraRight*p.x*tangentFov.x+cameraUp*p.y*tangentFov.y);
  float a=spin,r=length(observer),z=observer.z/r,phi=atan(observer.y,observer.x),sine=sqrt(max(1e-12,1.0-z*z));
  vec3 radial=observer/r,thetaBasis=vec3(z*cos(phi),z*sin(phi),-sine),phiBasis=vec3(-sin(phi),cos(phi),0.0);
  float nr=dot(direction,radial),nt=dot(direction,thetaBasis),np=dot(direction,phiBasis);
  float delta=r*r-2.0*r+a*a,sigma=r*r+a*a*z*z,A=pow(r*r+a*a,2.0)-a*a*delta*sine*sine;
  float lapse=sqrt(sigma*delta/A),drag=2.0*a*r/A,Lraw=-sqrt(A/sigma)*sine*np,E=lapse+drag*Lraw;
  float L=Lraw/E,pt=-nt*sqrt(sigma)/E,Q=pt*pt+z*z*(L*L/(sine*sine)-a*a),B=sqrt(max(.01,Q+L*L+a*a));
  vec4 y=vec4(1.0/r,-nr*sqrt(delta*sigma)/(E*r*r*B),z,-sine*nt*sqrt(sigma)/(E*B));
  float horizon=1.0+sqrt(1.0-a*a),escapeU=1.0/max(2000.0,r*2.0);int hits=0;
  for(int i=0;i<900;i++){
    if(y.x>=.999/horizon)break;
    if(y.x<escapeU&&y.y<0.0){
      // Cartesian tangent at the far boundary, not the boundary's radial direction.
      float s=sqrt(max(1e-9,1.0-y.z*y.z)),dr=-y.y/(y.x*y.x),dz=y.w/y.x-y.z*y.y/(y.x*y.x);
      float dxy=dr*s-y.z*y.w/(y.x*s),dphi=-(L/max(1e-12,1.0-y.z*y.z)+a*(2.0*y.x-a*L*y.x*y.x)/max(1e-9,1.0-2.0*y.x+a*a*y.x*y.x))/B,rho=s/y.x;
      vec3 far=normalize(vec3(dxy*cos(phi)-rho*sin(phi)*dphi,dxy*sin(phi)+rho*cos(phi)*dphi,dz));
      escapeRay=vec4(far,1.0);break;
    }
    float h=min(.025,.08*max(y.x,.0003)/max(abs(y.y),1e-9)),oldPhi=phi;vec4 old=y;
    advanceRay(y,phi,h,a,L,Q,B);
    if(old.z*y.z<0.0&&hits<3){
      float f=old.z/(old.z-y.z),radius=1.0/mix(old.x,y.x,f);
      if(radius>innerRadius&&radius<80.0){
        float r32=pow(radius,1.5),omega=1.0/(r32+a),ut=(1.0+a/r32)/sqrt(1.0-3.0/radius+2.0*a/r32);
        vec4 hit=vec4(radius,mix(oldPhi,phi,f),1.0/(E*ut*(1.0-omega*L)),1.0);
        if(hits==0)hit0=hit;else if(hits==1)hit1=hit;else hit2=hit;hits++;
      }
    }
  }
}`;
export const kerrDisplayFragment=`#version 300 es
precision highp float;
in vec2 uv;out vec4 colour;
uniform sampler2D hit0,hit1,hit2,escapeRay,discTemperature,thermal,sky,stars;
uniform float innerRadius,spin,phase,exposure,backgroundExposure,bolometric,artistic;
float unpack16(vec4 v){return (v.r*256.0+v.g)/257.0;}
vec3 spectrum(float temperature){
  float x=(clamp((log(max(100.0,temperature))/log(10.0)-2.0)/5.0,0.0,1.0)*1023.0+.5)/1024.0;
  return exp2(vec3(unpack16(texture(thermal,vec2(x,1.0/6.0))),unpack16(texture(thermal,vec2(x,.5))),unpack16(texture(thermal,vec2(x,5.0/6.0))))*160.0-80.0);
}
float grain(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(grain(i),grain(i+vec2(1.0,0.0)),f.x),mix(grain(i+vec2(0.0,1.0)),grain(i+vec2(1.0,1.0)),f.x),f.y);}
void main(){
  vec4 escaped=texture(escapeRay,uv);vec3 result=vec3(0.0);float transmission=1.0;
  for(int i=0;i<3;i++){
    vec4 hit=i==0?texture(hit0,uv):i==1?texture(hit1,uv):texture(hit2,uv);
    if(hit.w<.5)continue;
    float r=hit.x,g=hit.z,opacity=artistic>.5?1.0-smoothstep(44.0,80.0,r):1.0;
    float T=texture(discTemperature,vec2((clamp((r-innerRadius)/(80.0-innerRadius),0.0,1.0)*1023.0+.5)/1024.0,.5)).r;
    vec3 optical=spectrum(g*T),radiance;
    float total=5.670374419e-8*pow(g*T,4.0)/3.141592653589793/1e10;
    if(artistic>.5){
      // Differential Kerr circular frequency. Phase is display time in GM/c³ units.
      float azimuth=hit.y-phase/(pow(r,1.5)+spin),rs=r*.5,spiral=azimuth+1.8*log(rs);
      vec2 flow=vec2(cos(spiral),sin(spiral))*rs;
      float clouds=.58*noise(flow*.8)+.28*noise(flow*2.1)+.14*noise(flow*5.7);
      float strands=pow(.5+.5*sin(rs*7.5+clouds*9.0+2.0*sin(3.0*azimuth)),3.0);
      float structure=(.32+1.15*clouds)*(.6+.85*strands);
      vec3 amber=mix(vec3(1.0,.09,.012),vec3(1.0,.48,.10),clamp(g*T/90000.0,0.0,1.0));
      vec3 tint=mix(amber,vec3(1.0,.84,.54),smoothstep(1.05,1.5,g));
      radiance=tint*total*structure*3.8;
    }else radiance=bolometric>.5?optical/max(max(optical.r,optical.g),max(optical.b,1e-20))*total:optical;
    result+=transmission*opacity*(vec3(1.0)-exp(-radiance*exp2(exposure)));transmission*=1.0-opacity;
  }
  if(escaped.w>.5&&transmission>0.0){
    vec3 ray=normalize(escaped.xyz);vec2 skyUv=vec2(atan(ray.y,ray.x)/6.283185307179586+.5,.5-asin(clamp(ray.z,-1.0,1.0))/3.141592653589793);
    vec3 background=pow(texture(sky,skyUv).rgb,vec3(2.2))*exp2(backgroundExposure);
    background+=pow(texture(stars,skyUv).rgb,vec3(2.2));result+=transmission*background;
  }
  colour=vec4(pow(clamp(result,0.0,1.0),vec3(1.0/2.2)),1.0);
}`;
