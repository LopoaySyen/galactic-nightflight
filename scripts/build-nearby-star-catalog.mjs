import { readFile, writeFile } from 'node:fs/promises';

// Input: SIMBAD TAP JSON from the query recorded in nearby-stars-source.json.
const raw = JSON.parse((await readFile(process.argv[2], 'utf8')).replace(/^\uFEFF/, ''));
const rows = raw.data.map(row => Object.fromEntries(raw.metadata.map((column, i) => [column.name, row[i]])));
const yale = await readFile('public/data/yale-bright-stars.csv', 'utf8');
const existingHip = new Set(yale.trim().split(/\r?\n/).slice(1).filter(row => {
  const distance = Number(row.split(',')[7]);
  return distance > 0 && distance <= 10000;
}).map(row => row.split(',')[6].trim()));
const bytes = await readFile('public/data/gaia-dr3-bright-6d.bin');
const gaia = Array.from({ length: bytes.readUInt32LE(8) }, (_, i) => {
  const values = Array.from({ length: 9 }, (_, j) => bytes.readFloatLE(16 + (i * 9 + j) * 4));
  return { id: `gaia-dr3-bright-${i + 1}`, position: values.slice(0, 3), magnitude: values[6] + 5 * Math.log10(Math.hypot(values[0] + 8277, values[1], values[2]) / 10) };
});
const preferred = {
  'NAME Proxima Centauri': ['比邻星', 'Proxima Centauri', '比鄰星', '半人马座αC', 'Alpha Centauri C', '南门二C'],
  "NAME Barnard's star": ['巴纳德星', "Barnard's Star", '巴納德星', 'Barnard Star'],
  'Wolf 359': ['沃尔夫359', 'Wolf 359'],
  'HD 95735': ['拉兰德21185', 'Lalande 21185'],
  'CD-23 14742': ['罗斯154', 'Ross 154'],
  'Ross 128': ['罗斯128', 'Ross 128'],
  'HD 217987': ['拉卡伊9352', 'Lacaille 9352'],
  'HD 33793': ['卡普坦星', "Kapteyn's Star", 'Kapteyn Star'],
  'BD+05 1668': ['鲁坦星', "Luyten's Star", 'Luyten Star'],
  "NAME Teegarden's Star": ['蒂加登星', "Teegarden's Star", 'Teegarden Star'],
  'Wolf 28': ['范马南星', "Van Maanen's Star", 'Van Maanen 2'],
  '* alf CMa B': ['天狼星B', 'Sirius B'],
};
const compact = text => text.replace(/\s+/g, ' ').trim();
const rotation = [[-.0548755604,-.8734370902,-.4838350155],[.4941094279,-.44482963,.7469822445],[-.867666149,-.1980763734,.4559837762]];
const stars = [];
for (const row of rows) {
  // Resolved stellar entries with optical colour and measured 6D motion only.
  // Keep unresolved systems and incomplete records out of this supplement.
  if (['**', 'SB*', 'Pl', 'Pl?'].includes(row.otype) || !['ra', 'dec', 'plx_value', 'pmra', 'pmdec', 'rvz_radvel', 'V', 'B'].every(key => Number.isFinite(row[key]))) continue;
  const identifiers = row.ids.split('|').map(compact);
  const hip = identifiers.find(id => /^HIP \d+$/.test(id))?.slice(4);
  if (hip && existingHip.has(hip)) continue;
  const hd = identifiers.find(id => /^HD \d+$/.test(id))?.slice(3);
  const primary = compact(row.main_id);
  const named = preferred[primary];
  const en = named?.[1] ?? primary.replace(/^(NAME |V\* |\* )/, '');
  const zh = named?.[0] ?? en.replace(/^Wolf /, '沃尔夫').replace(/^Ross /, '罗斯');
  const aliases = [...new Set([zh, en, ...(named?.slice(2) ?? []), primary, ...identifiers.filter(id => /^(HIP |HD |GJ |LHS |Ross |Wolf |Gaia DR3 |NAME )/.test(id)).map(id => id.replace(/^NAME /, ''))])];
  const star = { id: hip ? `hip-${hip}` : `simbad-${row.oid}`, zh, en, aliases, simbadId: row.main_id, hip, hd,
    ra: row.ra, dec: row.dec, parallax: row.plx_value, pmra: row.pmra, pmdec: row.pmdec, radialVelocity: row.rvz_radvel,
    v: row.V, b: row.B, spectralType: row.sp_type };
  const ra = row.ra * Math.PI / 180, dec = row.dec * Math.PI / 180, distance = 1000 / row.plx_value;
  const direction = [Math.cos(ra) * Math.cos(dec), Math.sin(ra) * Math.cos(dec), Math.sin(dec)];
  const position = rotation.map((axis, i) => distance * axis.reduce((sum, value, j) => sum + value * direction[j], 0) + (i === 0 ? -8277 : 0));
  // Match the bundled Gaia sample by 3D position AND its original G magnitude.
  // 0.003 pc accommodates its float32 positions and J2016 versus J2000 motion.
  const matches = Number.isFinite(row.G) ? gaia.filter(other => Math.abs(other.magnitude - row.G) < .01 && Math.hypot(...other.position.map((value, i) => value - position[i])) < .003) : [];
  if (matches.length > 1) throw new Error(`Ambiguous Gaia match: ${primary}`);
  if (matches.length) star.replacesGaiaId = matches[0].id;
  stars.push(star);
}
if (new Set(stars.map(star => star.id)).size !== stars.length) throw new Error('Duplicate nearby star identifier');
await writeFile('public/data/nearby-stars.json', JSON.stringify(stars, null, 2) + '\n');
console.log(`${stars.length} nearby entries; ${stars.filter(star => star.replacesGaiaId).length} existing Gaia entries enriched.`);
