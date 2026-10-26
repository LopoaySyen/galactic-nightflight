import { GALAXY_FIELD_CACHE as cache } from "./galaxy-field-cache.ts";
import { NUCLEAR_RADIANCE_SEGMENTS, RADIANCE_SEGMENTS, RAY_LENGTH_PARSEC } from "./galaxy-radiance.ts";

// The atlas stores a fixed Galactic volume, never a screenshot from a viewpoint.
// Keep transfer, ray steps and display response aligned with galaxy-radiance.ts.
export const galaxyVolumeShader = `
uniform sampler2D fieldAtlas;
uniform float fieldReady, observation, immersive;
uniform vec3 observerPosition;
const vec2 atlasSize = vec2(${cache.width.toFixed(1)}, ${cache.height.toFixed(1)});
const vec4 fieldLogRange = vec4(${cache.logRanges.map(value => value.toFixed(12)).join(",")});
const vec4 fieldScale = vec4(${cache.valueScales.map(value => value.toFixed(12)).join(",")});
vec4 atlasSlice(vec2 xy, float slice) {
  vec2 tile = vec2(mod(slice, ${cache.columns.toFixed(1)}), floor(slice / ${cache.columns.toFixed(1)}));
  return texture2D(fieldAtlas, (tile * ${cache.size.toFixed(1)} + 0.5 + xy * ${(cache.size - 1).toFixed(1)}) / atlasSize);
}
vec4 cachedField(vec3 p) {
  vec2 xy = clamp((p.xy / ${cache.extent.toFixed(1)} + 1.0) * 0.5, 0.0, 1.0);
  float z = clamp((sign(p.z) * log(1.0 + abs(p.z) / ${cache.zScale.toFixed(1)}) / ${cache.zLog.toFixed(12)} + 1.0) * 0.5, 0.0, 1.0) * ${(cache.depth - 1).toFixed(1)};
  float lo = min(floor(z), ${(cache.depth - 2).toFixed(1)});
  vec4 encoded = mix(atlasSlice(xy, lo), atlasSlice(xy, lo + 1.0), z - lo);
  return (exp(encoded * fieldLogRange) - 1.0) * fieldScale;
}
float rayAsinh(float value) {
  return sign(value) * log(abs(value) + sqrt(value * value + 1.0));
}
float discRayEnd(float index, float verticalWeight, float startQ, float endQ, float dz) {
  if (index >= ${RADIANCE_SEGMENTS.toFixed(1)}) return ${RAY_LENGTH_PARSEC.toFixed(1)};
  float u = (index + 1.0) / ${RADIANCE_SEGMENTS.toFixed(1)};
  float distanceEnd = ${RAY_LENGTH_PARSEC.toFixed(1)} * pow(u, 1.52);
  if (verticalWeight > 0.0) {
    float q = mix(startQ, endQ, u);
    float verticalDistance = (100.0 * (exp(q) - exp(-q)) - observerPosition.z) / dz;
    distanceEnd = mix(distanceEnd, verticalDistance, verticalWeight);
  }
  return distanceEnd;
}
float nuclearRayEnd(float index, bool visible, float closest, float scale, float startQ, float span) {
  if (!visible || index >= ${(NUCLEAR_RADIANCE_SEGMENTS - 1).toFixed(1)}) return ${RAY_LENGTH_PARSEC.toFixed(1)};
  float q = startQ + span * (index + 1.0) / ${NUCLEAR_RADIANCE_SEGMENTS.toFixed(1)};
  return clamp(closest + scale * 0.5 * (exp(q) - exp(-q)), 0.0, ${RAY_LENGTH_PARSEC.toFixed(1)});
}
vec3 cachedGalaxy(vec3 direction) {
  vec3 radiance = vec3(0.0), opticalDepth = vec3(0.0);
  vec3 absorption = observation > 2.5 ? vec3(0.16,0.26,0.43) : vec3(0.76,1.0,1.32);
  float previousDistance = 0.0;
  float verticalWeight=clamp((abs(direction.z)*32000.0-500.0)/1000.0,0.0,1.0);
  float startZ=observerPosition.z/200.0,endZ=(observerPosition.z+direction.z*32000.0)/200.0;
  float startQ=rayAsinh(startZ), endQ=rayAsinh(endZ);
  float closest = -dot(observerPosition, direction);
  float impact = length(observerPosition + closest * direction);
  float closestOffset = closest - clamp(closest, 0.0, ${RAY_LENGTH_PARSEC.toFixed(1)});
  bool nuclearVisible = length(vec2(impact, closestOffset)) < 1500.0;
  float nuclearScale = length(vec2(impact, 7.5));
  float nuclearStart = rayAsinh(-closest / nuclearScale);
  float nuclearSpan = rayAsinh((${RAY_LENGTH_PARSEC.toFixed(1)} - closest) / nuclearScale) - nuclearStart;
  float discIndex = 0.0, nuclearIndex = 0.0;
  float discEnd = discRayEnd(discIndex, verticalWeight, startQ, endQ, direction.z);
  float nuclearEnd = nuclearRayEnd(nuclearIndex, nuclearVisible, closest, nuclearScale, nuclearStart, nuclearSpan);
  for (int i = 0; i < ${RADIANCE_SEGMENTS + NUCLEAR_RADIANCE_SEGMENTS}; i++) {
    if (previousDistance >= ${RAY_LENGTH_PARSEC.toFixed(1)}) break;
    float distanceEnd = min(discEnd, nuclearEnd);
    if (discEnd <= distanceEnd) {
      discIndex += 1.0;
      discEnd = discRayEnd(discIndex, verticalWeight, startQ, endQ, direction.z);
    }
    if (nuclearEnd <= distanceEnd) {
      nuclearIndex += 1.0;
      nuclearEnd = nuclearRayEnd(nuclearIndex, nuclearVisible, closest, nuclearScale, nuclearStart, nuclearSpan);
    }
    float stepLength = distanceEnd - previousDistance;
    vec3 p = observerPosition + direction * (previousDistance + stepLength * 0.5);
    previousDistance = distanceEnd;
    float radius = length(p.xy);
    if (radius > 24000.0 || abs(p.z) > 8000.0) continue;
    vec4 field = cachedField(p);
    // Preserve the compact nucleus analytically, well below a volume cell size.
    float nuclear = 54.0 * exp(-radius / 210.0 - abs(p.z) / 43.0)
      + 1100.0 / pow(1.0 + dot(p,p) / 56.25, 1.35);
    vec3 emission = field.x * vec3(0.82,0.98,1.2)
      + field.y * vec3(1.12,0.96,0.72) + (field.z + nuclear) * vec3(1.14,0.98,0.76);
    vec3 opticalStep = field.w * (0.00072 / 1.085736) * stepLength * absorption;
    vec3 segmentMean = (1.0 - exp(-max(opticalStep,vec3(0.0001)))) / max(opticalStep,vec3(0.0001));
    radiance += emission * exp(-opticalDepth) * stepLength * segmentMean;
    opticalDepth += opticalStep;
  }
  float gain = observation > 2.5 ? 188.0 : observation > 1.5 ? 190.0 : observation > 0.5 ? 135.0 : 105.0;
  float exposureScale = observation > 2.5 ? 0.00007 : observation > 1.5 ? 0.000052 : observation > 0.5 ? 0.000028 : 0.000018;
  float blackPoint = observation > 2.5 ? 0.008 : observation > 1.5 ? 0.006 : observation > 0.5 ? 0.004 : 0.003;
  vec3 colour = clamp((1.0 - exp(-radiance * exposureScale) - blackPoint) / (1.0 - blackPoint), 0.0, 1.0);
  if (observation > 0.5 && observation < 1.5) {
    float luminance = dot(colour,vec3(0.24,0.66,0.1));
    colour = 0.08 * colour + 0.92 * luminance;
  }
  if (observation > 1.5 && observation < 2.5) {
    colour *= vec3(0.86,1.0,1.45);
    float luminance = dot(colour,vec3(0.24,0.66,0.1));
    float saturation = mix(0.58,1.12,immersive);
    colour = clamp(luminance + vec3(saturation,saturation-0.08,saturation+0.12)*(colour-luminance)
      + vec3(0.0,0.0,immersive*0.002*(1.0-luminance)),0.0,1.0);
  }
  if (observation > 2.5) {
    float luminance = dot(colour,vec3(0.5,0.34,0.16));
    colour = clamp(vec3(1.16,0.68,0.42)*luminance + colour*vec3(0.0,0.2,0.18),0.0,1.0);
  }
  vec3 baseNight = observation > 2.5 ? vec3(3.0,1.0,4.0) : observation > 1.5 ? vec3(0.0,1.0,3.0) : vec3(0.0,1.0,2.0);
  return (baseNight + gain * pow(colour,vec3(0.78))) / 255.0;
}
`;
