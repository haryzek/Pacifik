// Sdílená geometrie: páteř trasy, vzdálenost bodu od lomené čáry, projekce na trasu.
"use strict";
const R = 6371;
const hav = (a, b) => { const dLat = ((b.lat - a.lat) * Math.PI) / 180, dLng = ((b.lng - a.lng) * Math.PI) / 180; const x = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };

// Páteř: US-101 / CA-1 Seattle → San Diego (hrubě, stačí na "co je vnitrozemí")
const SPINE = [
  [47.6062, -122.3321], [47.7980, -122.4970], [48.1170, -122.7600], [48.1181, -123.4307], [48.0600, -123.8000], [47.9503, -124.3854], [47.6100, -124.3760], [47.4600, -123.8500], [46.9754, -123.8157], [46.1879, -123.8313], [45.8918, -123.9615], [45.4570, -123.8430], [44.9958, -124.0086],
  [44.6368, -124.0535], [44.3107, -124.1010], [43.9826, -124.0998], [43.3665, -124.2179], [43.1190, -124.4084], [42.7402, -124.4990], [42.4057, -124.4218],
  [42.0526, -124.2840], [41.7558, -124.2026], [41.0587, -124.1430], [40.8021, -124.1637], [40.5762, -124.2637], [40.2210, -123.9300], [39.8670, -123.7160],
  [39.4457, -123.8053], [39.3070, -123.7990], [38.9550, -123.7140], [38.4500, -123.1200], [38.3100, -123.0500], [37.9000, -122.6800], [37.7749, -122.4194],
  [37.5000, -122.4900], [37.1800, -122.3900], [36.9741, -122.0308], [36.6002, -121.8947], [36.2704, -121.8081], [35.8600, -121.4100], [35.5700, -121.1000],
  [35.2828, -120.6596], [35.0000, -120.5500], [34.6100, -120.1900], [34.4208, -119.6982], [34.2805, -119.2945], [34.0400, -118.7000], [34.0195, -118.4912],
  [33.7701, -118.1937], [33.5427, -117.7854], [33.4270, -117.6120], [33.1959, -117.3795], [32.8328, -117.2713], [32.7157, -117.1611],
].map(([lat, lng]) => ({ lat, lng }));
const SPINE_KM = 25;     // dál od páteře = vnitrozemí
const CORRIDOR_KM = 15;  // místo je "po cestě" odbočky, když je do 15 km od její trasy

// vzdálenost bodu od úsečky (equirectangular aproximace, na 15 km stačí)
function distToSegment(p, a, b) {
  const kx = Math.cos((p.lat * Math.PI) / 180) * 111.32, ky = 110.57;
  const ax = (a.lng - p.lng) * kx, ay = (a.lat - p.lat) * ky, bx = (b.lng - p.lng) * kx, by = (b.lat - p.lat) * ky;
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  let t = l2 ? -(ax * dx + ay * dy) / l2 : 0; t = Math.max(0, Math.min(1, t));
  const x = ax + t * dx, y = ay + t * dy;
  return { d: Math.sqrt(x * x + y * y), t };
}
function distToPolyline(p, line) { let best = Infinity; for (let i = 0; i + 1 < line.length; i++) best = Math.min(best, distToSegment(p, line[i], line[i + 1]).d); return best; }
// pozice bodu podél trasy (0..1) — pro řazení "po cestě"
function alongPolyline(p, line) {
  const segs = []; let total = 0;
  for (let i = 0; i + 1 < line.length; i++) { const L = hav(line[i], line[i + 1]); segs.push({ i, L, start: total }); total += L; }
  let best = { d: Infinity, pos: 0 };
  for (const s of segs) { const r = distToSegment(p, line[s.i], line[s.i + 1]); if (r.d < best.d) best = { d: r.d, pos: (s.start + r.t * s.L) / (total || 1) }; }
  return best.pos;
}
module.exports = { R, hav, SPINE, SPINE_KM, CORRIDOR_KM, distToSegment, distToPolyline, alongPolyline };
