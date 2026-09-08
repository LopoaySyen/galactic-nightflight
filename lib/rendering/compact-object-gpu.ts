import type {CompactObject} from './compact-object-catalog.ts';
import type {Vector3} from '../physics/vector.ts';
import type {ViewCamera} from './contracts.ts';
import {createCameraBasis,projectDirectionPerspective} from './projection.ts';
import {lensView,SCHWARZSCHILD_PARSEC_PER_SOLAR_MASS} from '../physics/gravitational-lensing.ts';
import {thermalSpectrumTexture} from '../physics/schwarzschild.ts';
import {kerrDiscProfile,kerrIsco} from '../physics/kerr.ts';
import {kerrVertex,kerrGeometryFragment,kerrDisplayFragment} from './kerr-shaders.ts';

export interface CompactGpuRenderer {
  setSky(pixels:Uint8ClampedArray,width:number,height:number):void;
  setStars(canvas:HTMLCanvasElement):void;
  render(object:CompactObject|undefined,observer:Vector3,camera:ViewCamera,width:number,height:number,exposure:number,eddingtonRatio:number,bolometric:boolean,artistic:boolean,backgroundExposure:number,relativeOffset?:Vector3):boolean;
  animateDisc(seconds:number):void;
  sourceDirectionAtPixel(xFraction:number,yFraction:number):Vector3|null;
  dispose():void;
}
export function nearestResolvedCompact(objects:readonly CompactObject[],observer:Vector3,camera:ViewCamera,width:number,height:number){
  return objects.filter(object=>{
    const lens=lensView(object,observer);if(!lens)return false;
    const radius=2/lens.strength,p=projectDirectionPerspective(lens.direction,camera,width,height);
    return radius>=65&&radius<1e6&&p.forwardCosine>0&&Math.tan(lens.shadowAngle)*width/(2*Math.tan(camera.horizontalFieldOfViewDegrees*Math.PI/360))>=1;
  }).sort((a,b)=>lensView(b,observer)!.strength-lensView(a,observer)!.strength)[0];
}
export function createCompactGpuRenderer(canvas:HTMLCanvasElement):CompactGpuRenderer|null{
  const gl=canvas.getContext('webgl2',{alpha:true,antialias:false,premultipliedAlpha:false});
  if(!gl||!gl.getExtension('EXT_color_buffer_float'))return null;
  const program=(fragment:string)=>{
    const p=gl.createProgram()!;
    for(const [type,source] of [[gl.VERTEX_SHADER,kerrVertex],[gl.FRAGMENT_SHADER,fragment]] as const){
      const s=gl.createShader(type)!;gl.shaderSource(s,source);gl.compileShader(s);
      if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(`Kerr shader: ${gl.getShaderInfoLog(s)}`);
      gl.attachShader(p,s);gl.deleteShader(s);
    }
    gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(`Kerr program: ${gl.getProgramInfoLog(p)}`);return p;
  };
  const geometry=program(kerrGeometryFragment),display=program(kerrDisplayFragment);
  const buffer=gl.createBuffer()!;gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
  const use=(p:WebGLProgram)=>{gl.useProgram(p);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);const a=gl.getAttribLocation(p,'position');gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);};
  const gu=Object.fromEntries(['forward','cameraRight','cameraUp','observer','tangentFov','spin','innerRadius'].map(n=>[n,gl.getUniformLocation(geometry,n)]));
  const names=['hit0','hit1','hit2','escapeRay','discTemperature','thermal','sky','stars'];
  const du=Object.fromEntries([...names,'innerRadius','spin','phase','exposure','backgroundExposure','bolometric','artistic'].map(n=>[n,gl.getUniformLocation(display,n)]));
  const textures=names.map((_,i)=>{
    const texture=gl.createTexture()!;gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,texture);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    // Float ray records must never be blended across an image/occlusion boundary.
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,i<5?gl.NEAREST:gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,i<5?gl.NEAREST:gl.LINEAR);return texture;
  });
  const bind=(i:number)=>{gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,textures[i]);};
  const upload=(i:number,w:number,h:number,data:Uint8Array|Uint8ClampedArray)=>{bind(i);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,data);};
  upload(5,1024,3,thermalSpectrumTexture());upload(6,1,1,new Uint8Array([0,0,0,255]));upload(7,1,1,new Uint8Array([0,0,0,255]));
  const framebuffer=gl.createFramebuffer()!;
  let mapWidth=0,mapHeight=0,geometryKey='',profileKey='',phase=0,spin=.7,active=false,art=false;
  const draw=()=>{if(!active||gl.isContextLost())return;gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,canvas.width,canvas.height);use(display);gl.uniform1f(du.phase,phase);for(let i=0;i<8;i++){bind(i);gl.uniform1i(du[names[i]],i);}gl.drawArrays(gl.TRIANGLES,0,6);};
  return {
    setSky(pixels,width,height){upload(6,width,height,pixels);},
    setStars(source){
      bind(7);
      // Additive star colour already includes coverage. Unpremultiplying the
      // transparent canvas would turn every faint halo into an opaque blob.
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
    },
    render(object,observer,camera,width,height,exposure,ratio,bolometric,artistic,backgroundExposure,relativeOffset){
      if(gl.isContextLost())return false;
      if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
      active=!!object;art=artistic;
      if(!object){gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);return false;}
      spin=object.spin;
      const unit=SCHWARZSCHILD_PARSEC_PER_SOLAR_MASS*object.massSolar/2;
      const offset=relativeOffset??{x:observer.x-object.positionParsec.x,y:observer.y-object.positionParsec.y,z:observer.z-object.positionParsec.z};
      const relative={x:offset.x/unit,y:offset.y/unit,z:offset.z/unit};
      const basis=createCameraBasis(camera),mw=Math.min(width,1280),mh=Math.max(1,Math.round(mw*height/width));
      // Subpixel galactic coordinate roundoff must not retrace a stationary follow camera.
      const key=JSON.stringify([Object.values(relative).map(v=>v.toPrecision(7)),basis,camera.horizontalFieldOfViewDegrees,spin,mw,mh]);
      if(key!==geometryKey){
        gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);
        if(mw!==mapWidth||mh!==mapHeight){
          mapWidth=mw;mapHeight=mh;
          for(let i=0;i<4;i++){bind(i);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,mw,mh,0,gl.RGBA,gl.FLOAT,null);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0+i,gl.TEXTURE_2D,textures[i],0);}
          gl.drawBuffers([0,1,2,3].map(i=>gl.COLOR_ATTACHMENT0+i));
          if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error('Kerr ray framebuffer unavailable');
        }
        use(geometry);gl.viewport(0,0,mw,mh);
        for(const [name,v] of [['forward',basis.forward],['cameraRight',basis.right],['cameraUp',basis.up],['observer',relative]] as const)gl.uniform3f(gu[name],v.x,v.y,v.z);
        const tangent=Math.tan(camera.horizontalFieldOfViewDegrees*Math.PI/360);gl.uniform2f(gu.tangentFov,tangent,tangent*height/width);gl.uniform1f(gu.spin,spin);gl.uniform1f(gu.innerRadius,kerrIsco(spin));
        gl.drawArrays(gl.TRIANGLES,0,6);geometryKey=key;
      }
      const pk=[object.massSolar,spin,ratio].join('|');
      if(pk!==profileKey){const p=kerrDiscProfile(object.massSolar,spin,ratio);bind(4);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,1024,1,0,gl.RGBA,gl.FLOAT,p.temperatures);profileKey=pk;}
      use(display);gl.uniform1f(du.innerRadius,kerrIsco(spin));gl.uniform1f(du.spin,spin);gl.uniform1f(du.exposure,exposure);gl.uniform1f(du.backgroundExposure,backgroundExposure);gl.uniform1f(du.bolometric,bolometric?1:0);gl.uniform1f(du.artistic,artistic?1:0);draw();return true;
    },
    // One display orbit at 10 GM/c² takes 30 seconds; physical periods are shown in the UI.
    animateDisc(seconds){if(active&&art){phase+=seconds*2*Math.PI*(10**1.5+spin)/30;draw();}},
    sourceDirectionAtPixel(x,y){
      if(!active)return null;
      gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);
      const pixel=new Float32Array(4),px=Math.min(mapWidth-1,Math.max(0,Math.floor(x*mapWidth))),py=Math.min(mapHeight-1,Math.max(0,Math.floor((1-y)*mapHeight)));
      let transmission=1;
      for(let i=0;i<3;i++){gl.readBuffer(gl.COLOR_ATTACHMENT0+i);gl.readPixels(px,py,1,1,gl.RGBA,gl.FLOAT,pixel);if(pixel[3]>.5){const t=Math.max(0,Math.min(1,(pixel[0]-44)/36));transmission*=art?t*t*(3-2*t):0;}}
      gl.readBuffer(gl.COLOR_ATTACHMENT3);gl.readPixels(px,py,1,1,gl.RGBA,gl.FLOAT,pixel);gl.bindFramebuffer(gl.FRAMEBUFFER,null);
      return pixel[3]>.5&&transmission>.15?{x:pixel[0],y:pixel[1],z:pixel[2]}:null;
    },
    dispose(){textures.forEach(t=>gl.deleteTexture(t));gl.deleteBuffer(buffer);gl.deleteFramebuffer(framebuffer);gl.deleteProgram(geometry);gl.deleteProgram(display);}
  };
}
