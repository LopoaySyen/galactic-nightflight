// Resting refinement may add local dust contrast, but must not change the
// exposure or white balance established by the moving volume.
export const GALAXY_REFINEMENT_LOG_LIMIT = Math.log(1.12);
export const GALAXY_REFINEMENT_FADE_MS = 900;

function blur(values: Float32Array, width: number, height: number, radius: number, horizontal: boolean): Float32Array {
  const result = new Float32Array(values.length);
  const length = horizontal ? width : height, lines = horizontal ? height : width;
  const index = (line: number, offset: number) => horizontal
    ? line * width + (offset + width) % width
    : Math.max(0, Math.min(height - 1, offset)) * width + line;
  for (let line = 0; line < lines; line++) {
    let sum = 0;
    for (let offset = -radius; offset <= radius; offset++) sum += values[index(line, offset)];
    for (let offset = 0; offset < length; offset++) {
      result[index(line, offset)] = sum / (2 * radius + 1);
      sum += values[index(line, offset + radius + 1)] - values[index(line, offset - radius)];
    }
  }
  return result;
}

/** Encodes a signed, bounded luminance detail as R minus G. Neutral is exactly
 * zero, including after texture filtering; RGB colour always comes from the
 * cached volume. Low-frequency exposure drift is removed in angular space. */
export function createGalaxyRefinementDetail(
  refined: Uint8ClampedArray, coarse: Uint8ClampedArray, width: number, height: number,
): Uint8Array {
  const count = width * height;
  const changes = new Float32Array(count), weights = new Float32Array(count);
  const luminance = (pixels: Uint8ClampedArray, i: number) =>
    0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2];
  for (let i = 0; i < count; i++) {
    const base = luminance(coarse, i * 4), fine = luminance(refined, i * 4);
    // Quantisation near black should not turn into bright or coloured patches.
    const visibility = Math.max(0, Math.min(1, (base - 4) / 16));
    weights[i] = visibility * base;
    changes[i] = weights[i] * Math.log(Math.max(1, fine) / Math.max(1, base));
  }
  let smoothedChanges: Float32Array = changes, smoothedWeights: Float32Array = weights;
  const radius = Math.max(1, Math.min(width - 1, Math.round(width / 60)));
  // Two separable box passes give a smooth triangular kernel. Longitude wraps
  // at the panorama seam; latitude clamps at the poles.
  for (let pass = 0; pass < 2; pass++) {
    smoothedChanges = blur(blur(smoothedChanges, width, height, radius, true), width, height, radius, false);
    smoothedWeights = blur(blur(smoothedWeights, width, height, radius, true), width, height, radius, false);
  }
  const pixels = new Uint8Array(count * 4);
  for (let i = 0; i < count; i++) {
    const base = luminance(coarse, i * 4);
    const visibility = Math.max(0, Math.min(1, (base - 4) / 16));
    const raw = weights[i] > 0 ? changes[i] / weights[i] : 0;
    const broad = smoothedWeights[i] > 0 ? smoothedChanges[i] / smoothedWeights[i] : 0;
    const detail = visibility * Math.max(-1, Math.min(1, (raw - broad) / GALAXY_REFINEMENT_LOG_LIMIT));
    pixels[i * 4] = Math.round(Math.max(0, detail) * 255);
    pixels[i * 4 + 1] = Math.round(Math.max(0, -detail) * 255);
    pixels[i * 4 + 3] = 255;
  }
  return pixels;
}
