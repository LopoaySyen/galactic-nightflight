import records from '../../public/data/nearby-stars.json' with { type: 'json' };
import type { PointSourceSample } from './contracts.ts';
import { equatorialDirectionToGalactic } from './observed-star-catalog.ts';
import { integrateVisualExtinctionMagnitude } from './galaxy-radiance.ts';

const sun = { x: -8277, y: 0, z: 0 };
const sunVelocity = { x: 11.1, y: 244.24, z: 7.25 };

export const nearbyStars: PointSourceSample[] = records.map(record => {
  const distance = 1000 / record.parallax;
  const radial = equatorialDirectionToGalactic(record.ra, record.dec);
  const raTangent = equatorialDirectionToGalactic(record.ra + 90, 0);
  const decTangent = equatorialDirectionToGalactic(record.ra, record.dec + 90);
  const positionParsec = { x: sun.x + distance * radial.x, y: distance * radial.y, z: distance * radial.z };
  // SIMBAD pmra already includes cos(dec); do not apply that factor twice.
  const scale = .00474047 * distance;
  const velocity = (axis: 'x' | 'y' | 'z') => sunVelocity[axis] + record.radialVelocity * radial[axis]
    + scale * (record.pmra * raTangent[axis] + record.pmdec * decTangent[axis]);
  const colour = Math.min(2.1, Math.max(-.4, record.b - record.v));
  return {
    id: record.id,
    displayName: record.en,
    positionParsec,
    velocityKilometresPerSecond: { x: velocity('x'), y: velocity('y'), z: velocity('z') },
    absoluteVisualMagnitude: record.v - 5 * Math.log10(distance / 10),
    effectiveTemperatureKelvin: Math.min(40000, Math.max(2400, 4600 * (1 / (.92 * colour + 1.7) + 1 / (.92 * colour + .62)))),
    role: 'observed-bright-star',
    sourceCatalog: 'SIMBAD nearby stellar supplement',
    referenceVisualExtinctionMagnitude: integrateVisualExtinctionMagnitude(sun, positionParsec, 8),
    observedData: {
      catalog: 'nearby-simbad',
      catalogueIdentifier: record.hip,
      henryDraperIdentifier: record.hd,
      rightAscensionDegrees: record.ra,
      declinationDegrees: record.dec,
      referenceDistanceParsec: distance,
      referenceApparentMagnitude: record.v,
      spectralType: record.spectralType,
      temperatureMethod: 'colour-estimate',
      measuredVelocity: true,
      sourceUrl: `https://simbad.cds.unistra.fr/simbad/sim-id?Ident=${encodeURIComponent(record.simbadId)}`,
    },
  };
});

const replacedIds = new Set(records.flatMap(record => [record.id, ...(record.replacesGaiaId ? [record.replacesGaiaId] : [])]));

/** Share one merged catalogue between rendering, lookup and selection. */
export function includeNearbyStars(stars: readonly PointSourceSample[]): PointSourceSample[] {
  return [...stars.filter(star => !replacedIds.has(star.id)), ...nearbyStars];
}
