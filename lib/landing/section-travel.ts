/** One position drives both natural scrolling and anchor-link navigation. */
export function sectionTravel(scrollY: number, stops: readonly number[]) {
  if (!stops.length || !Number.isFinite(scrollY)) return { progress: 0, active: 0 };
  let index = 0;
  while (index < stops.length - 1 && scrollY >= stops[index + 1]) index++;
  const span = Math.max(1, (stops[index + 1] ?? stops[index]) - stops[index]);
  const fraction = index === stops.length - 1 ? 0 : Math.max(0, Math.min(1, (scrollY - stops[index]) / span));
  const progress = index + fraction;
  return { progress, active: Math.min(stops.length - 1, Math.floor(progress + 0.5)) };
}

export function travelSpeed(delta: number, seconds: number) {
  return 0.35 + Math.min(30, Math.abs(delta) / Math.max(seconds, 1 / 120) * 11);
}
