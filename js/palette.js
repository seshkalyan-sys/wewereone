const paletteStops = [
  { t: 0.00, p: [40, 90, 130],   m: [80, 160, 210],  l: [160, 220, 245], deep: [6, 18, 32] },
  { t: 0.28, p: [60, 180, 200],  m: [120, 220, 230], l: [190, 240, 245], deep: [10, 40, 55] },
  { t: 0.55, p: [90, 230, 190],  m: [150, 245, 215], l: [210, 250, 235], deep: [15, 55, 50] },
  { t: 0.80, p: [200, 240, 220], m: [225, 248, 230], l: [240, 252, 240], deep: [45, 70, 60] },
  { t: 1.00, p: [250, 245, 220], m: [253, 250, 235], l: [255, 253, 245], deep: [70, 70, 55] }
];

export function paletteAt(awareness){
  const a = Math.max(0, Math.min(1, awareness));
  let lo = paletteStops[0], hi = paletteStops[paletteStops.length-1];
  for(let i = 0; i < paletteStops.length - 1; i++){
    if(a >= paletteStops[i].t && a <= paletteStops[i+1].t){ lo = paletteStops[i]; hi = paletteStops[i+1]; break; }
  }
  const range = hi.t - lo.t;
  const f = range > 0 ? (a - lo.t) / range : 0;
  const lerp = (aa, bb) => aa.map((v, i) => Math.round(v + (bb[i] - v) * f));
  return { p: lerp(lo.p, hi.p), m: lerp(lo.m, hi.m), l: lerp(lo.l, hi.l), deep: lerp(lo.deep, hi.deep) };
}

const scales = {
  low:  ['C3','Eb3','G3','Bb3','C4','Eb4','G4','Bb4','C5','Eb5'],
  mid:  ['C3','D3','F3','G3','A3','C4','D4','F4','A4','C5'],
  high: ['C3','E3','G3','B3','C4','E4','G4','B4','C5','E5']
};
export function currentScale(a){
  if(a < 0.4) return scales.low;
  if(a < 0.75) return scales.mid;
  return scales.high;
}
