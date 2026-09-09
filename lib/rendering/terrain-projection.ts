import type { ViewCamera } from "./contracts.ts";
import { createCameraBasis } from "./projection.ts";
import { galacticToFrame, planetaryFrame, type LocalFrame } from "./local-frame.ts";

export interface GroundTextureRaster {
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
}

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

function positiveFraction(value: number): number {
  return value - Math.floor(value);
}

/**
 * Projects a square top-down texture onto a horizontal plane 1.65 metres below
 * the camera. Rays that point above the local horizon remain transparent.
 */
export function projectGroundTexturePixels(
  texture: GroundTextureRaster,
  camera: ViewCamera,
  outputWidth: number,
  outputHeight: number,
  daylightStrength: number,
): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(outputWidth * outputHeight * 4);
  const basis = createCameraBasis(camera);
  const tangentHorizontal = Math.tan(
    (camera.horizontalFieldOfViewDegrees * Math.PI) / 360,
  );
  const tangentVertical = tangentHorizontal * (outputHeight / outputWidth);
  const observerHeightMetres = 1.65;
  const textureRepeatMetres = 17;
  const maximumRenderedDistanceMetres = 240;
  const fullOpacityDistanceMetres = 72;
  const lightScale = 0.52 + 0.58 * clamp(daylightStrength, 0, 1);

  for (let y = 0; y < outputHeight; y += 1) {
    const normalizedY = 1 - (2 * (y + 0.5)) / outputHeight;
    const cameraY = normalizedY * tangentVertical;
    for (let x = 0; x < outputWidth; x += 1) {
      const normalizedX = (2 * (x + 0.5)) / outputWidth - 1;
      const cameraX = normalizedX * tangentHorizontal;
      const rayX =
        basis.forward.x + cameraX * basis.right.x + cameraY * basis.up.x;
      const rayY =
        basis.forward.y + cameraX * basis.right.y + cameraY * basis.up.y;
      const rayZ =
        basis.forward.z + cameraX * basis.right.z + cameraY * basis.up.z;
      if (rayZ >= -0.002) continue;

      const intersectionScale = observerHeightMetres / -rayZ;
      const groundXMetres = rayX * intersectionScale;
      const groundYMetres = rayY * intersectionScale;
      const planarDistanceMetres = Math.hypot(groundXMetres, groundYMetres);
      if (planarDistanceMetres >= maximumRenderedDistanceMetres) continue;

      const distanceOpacity = clamp(
        (maximumRenderedDistanceMetres - planarDistanceMetres) /
          (maximumRenderedDistanceMetres - fullOpacityDistanceMetres),
        0,
        1,
      );
      const horizonOpacity = clamp((-rayZ - 0.002) / 0.055, 0, 1);
      const opacity = 0.96 * distanceOpacity * horizonOpacity;
      if (opacity <= 0) continue;

      const textureX = Math.min(
        texture.width - 1,
        Math.floor(
          positiveFraction(groundXMetres / textureRepeatMetres + 0.173) *
            texture.width,
        ),
      );
      const textureY = Math.min(
        texture.height - 1,
        Math.floor(
          positiveFraction(groundYMetres / textureRepeatMetres + 0.417) *
            texture.height,
        ),
      );
      const textureOffset = (textureY * texture.width + textureX) * 4;
      const outputOffset = (y * outputWidth + x) * 4;
      const distanceDimming = 0.74 + 0.26 * distanceOpacity;
      pixels[outputOffset] = Math.round(
        texture.pixels[textureOffset] * lightScale * distanceDimming,
      );
      pixels[outputOffset + 1] = Math.round(
        texture.pixels[textureOffset + 1] * lightScale * distanceDimming,
      );
      pixels[outputOffset + 2] = Math.round(
        texture.pixels[textureOffset + 2] * lightScale * distanceDimming,
      );
      pixels[outputOffset + 3] = Math.round(255 * opacity);
    }
  }
  return pixels;
}

/** Exact spherical panorama projection plus a separate planar foreground.
 * This CPU implementation also provides a reference for the graphics shader. */
export function projectPlanetTerrainPixels(
  panorama: GroundTextureRaster, ground: GroundTextureRaster, camera: ViewCamera,
  width: number, height: number, inclinationDegrees: number, daylight: number,
  exposureStops = 0, frame:LocalFrame=planetaryFrame(inclinationDegrees),
): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(width * height * 4);
  const basis = createCameraBasis(camera);
  const tangent = Math.tan(camera.horizontalFieldOfViewDegrees * Math.PI / 360);
  const lighting = (0.09 + 0.86 * daylight) * 2 ** (exposureStops * 0.45);
  const smoothstep = (a: number, b: number, x: number) => {
    const t = clamp((x-a)/(b-a), 0, 1); return t*t*(3-2*t);
  };
  const sample = (texture: GroundTextureRaster, u: number, v: number, wrapY: boolean) => {
    const x = positiveFraction(u) * texture.width - 0.5;
    const y = (wrapY ? positiveFraction(v) : clamp(v, 0, 1)) * texture.height - 0.5;
    const floorX = Math.floor(x), floorY = Math.floor(y);
    const mixX = x-floorX, mixY = y-floorY;
    const at = (sx: number, sy: number, channel: number) => {
      const tx = ((sx % texture.width) + texture.width) % texture.width;
      const ty = wrapY ? ((sy % texture.height) + texture.height) % texture.height : clamp(sy, 0, texture.height-1);
      return texture.pixels[(ty * texture.width + tx)*4+channel] / 255;
    };
    return [0,1,2,3].map(channel =>
      (at(floorX,floorY,channel)*(1-mixX)+at(floorX+1,floorY,channel)*mixX)*(1-mixY)+
      (at(floorX,floorY+1,channel)*(1-mixX)+at(floorX+1,floorY+1,channel)*mixX)*mixY);
  };
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const cx = (2*(x+0.5)/width-1)*tangent;
    const cy = (1-2*(y+0.5)/height)*tangent*height/width;
    const length = Math.hypot(1,cx,cy);
    const ray = galacticToFrame({
      x: (basis.forward.x+cx*basis.right.x+cy*basis.up.x)/length,
      y: (basis.forward.y+cx*basis.right.y+cy*basis.up.y)/length,
      z: (basis.forward.z+cx*basis.right.z+cy*basis.up.z)/length,
    }, frame);
    const distant = sample(panorama, Math.atan2(ray.y,ray.x)/(2*Math.PI)+0.5,
      0.5-Math.asin(clamp(ray.z,-1,1))/Math.PI, false);
    const base = ray.z < 0 ? [0.002+0.078*daylight,0.004+0.091*daylight,0.007+0.103*daylight] : [0,0,0];
    const colour = base.map((channel,i) => channel*(1-distant[3])+distant[i]*lighting*distant[3]);
    let alpha = distant[3]+(ray.z<0 ? 1 : 0)*(1-distant[3]);
    if (ray.z < -0.002) {
      const hitX=ray.x*1.65/-ray.z, hitY=ray.y*1.65/-ray.z;
      const blend=(1-smoothstep(35,180,Math.hypot(hitX,hitY)))*smoothstep(0.002,0.035,-ray.z);
      if (blend > 0) {
        const near=sample(ground,hitX/17+0.173,hitY/17+0.417,true);
        for (let i=0;i<3;i++) colour[i]=colour[i]*(1-blend)+near[i]*lighting*blend;
        alpha=Math.max(alpha,blend);
      }
    }
    const offset=(y*width+x)*4;
    for (let i=0;i<3;i++) pixels[offset+i]=Math.round(clamp(colour[i],0,1)*255);
    pixels[offset+3]=Math.round(alpha*255);
  }
  return pixels;
}
