/** Remove the photographic sky pedestal and blend the full rectangular footprint
 * gradually. This is display processing, not a new astronomical radiance model. */
export function blendDeepSkyPhoto(pixels:Uint8ClampedArray,width:number,height:number,grade:"observational"|"immersive"="observational"):Uint8ClampedArray {
  const borders:number[][]=[[],[],[]];
  const stride=Math.max(1,Math.floor(Math.sqrt(width*height/6000)));
  for(let y=0;y<height;y+=stride)for(let x=0;x<width;x+=stride){
    if(x>width*.08&&x<width*.92&&y>height*.08&&y<height*.92)continue;
    const offset=(y*width+x)*4;
    for(let channel=0;channel<3;channel++)borders[channel].push(pixels[offset+channel]);
  }
  const background=borders.map(values=>{values.sort((a,b)=>a-b);return values[Math.floor(values.length*.25)]??0;});
  const smooth=(value:number)=>{const t=Math.max(0,Math.min(1,value));return t*t*(3-2*t);};
  const result=new Uint8ClampedArray(pixels.length);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const offset=(y*width+x)*4;
    const horizontal=smooth(Math.min(x,width-1-x)/(width*.18));
    const vertical=smooth(Math.min(y,height-1-y)/(height*.18));
    let peak=0;
    for(let channel=0;channel<3;channel++){
      const value=Math.max(0,pixels[offset+channel]-background[channel]*.88);
      result[offset+channel]=value;peak=Math.max(peak,value);
    }
    // Fixed display response, cached once per asset. Do not recolour by location.
    // Preserve linear luminance while reducing the saturation of processed photos.
    const linear=[result[offset],result[offset+1],result[offset+2]].map(value=>(value/255)**2.2);
    const luminance=.2126*linear[0]+.7152*linear[1]+.0722*linear[2];
    const saturation=grade==="observational"?.55:1;
    for(let channel=0;channel<3;channel++)result[offset+channel]=255*(luminance+(linear[channel]-luminance)*saturation)**(1/2.2);
    result[offset+3]=pixels[offset+3]*horizontal*vertical*smooth(peak/22);
  }
  return result;
}
