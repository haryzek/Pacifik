#!/usr/bin/env node
// Spočítá reálnou silniční geometrii (OSRM demo server) pro dny páteře a odbočky -> data/route-geom.json {key: [[lat,lng],...]}
// Idempotentní (cache podle hashe waypointů). node scripts/route-geom.js [--force]
"use strict";
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const ROOT = path.join(__dirname, "..");
const OUTF = path.join(ROOT, "data/route-geom.json");
const cache = fs.existsSync(OUTF) ? JSON.parse(fs.readFileSync(OUTF, "utf8")) : {};
const FORCE = process.argv.includes("--force");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const key = (pts) => crypto.createHash("md5").update(JSON.stringify(pts)).digest("hex").slice(0, 10);

async function routeLegs(pts, ferries) {
  // ferries = indexy i, kde úsek pts[i]→pts[i+1] je trajekt (rovně, bez jízdy)
  const cuts=[0,...ferries.map(i=>i+1),pts.length]; const legs=[]; for(let k=0;k<cuts.length-1;k++) legs.push(pts.slice(cuts[k], k+1<cuts.length-1 ? cuts[k+1] : cuts[k+1]));
  let out=[],km=0,h=0;
  for(let k=0;k<legs.length;k++){ const leg=legs[k]; if(leg.length>=2){ const r=await route(leg); out.push(...(out.length?r.pts.slice(1):r.pts)); km+=r.km; h+=r.h; } else if(leg.length===1){ out.push(leg[0]); }
    if(k<legs.length-1){ h+=0.6; } }
  return { pts: out, km, h: Math.round(h*10)/10 };
}
async function route(pts) {
  // OSRM: max ~100 souřadnic na dotaz; posíláme po blocích a lepíme
  const out = []; let total = 0, dur = 0;
  for (let i = 0; i < pts.length - 1; i += 60) {
    const chunk = pts.slice(i, Math.min(pts.length, i + 61));
    const coords = chunk.map((p) => `${p[1]},${p[0]}`).join(";");
    const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=simplified&geometries=geojson&continue_straight=false`;
    const r = await fetch(url, { headers: { "User-Agent": "PacifikRoadTripApp/1.0" } });
    if (!r.ok) throw new Error("OSRM " + r.status);
    const j = await r.json(); if (j.code !== "Ok") throw new Error("OSRM " + j.code);
    const g = j.routes[0].geometry.coordinates.map(([lng, lat]) => [Math.round(lat * 1e5) / 1e5, Math.round(lng * 1e5) / 1e5]);
    out.push(...(out.length ? g.slice(1) : g)); total += j.routes[0].distance; dur += j.routes[0].duration;
    await sleep(400);
  }
  // zjednodušení: vynechat body blíž než ~60 m
  const simp = [out[0]]; for (const p of out) { const q = simp[simp.length - 1]; if (Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) > 0.0025) simp.push(p); } simp.push(out[out.length - 1]);
  return { pts: simp, km: Math.round(total / 1000), h: Math.round(dur / 360) / 10 };
}

(async () => {
  const jobs = [];
  const spine = JSON.parse(fs.readFileSync(path.join(ROOT, "data/spine.json"), "utf8"));
  for (const d of spine.days) jobs.push({ id: `spine-${d.day}`, pts: d.wp, ferries: d.ferries || [] });
  const loops = JSON.parse(fs.readFileSync(path.join(ROOT, "data/raw/loops.json"), "utf8")).concat(JSON.parse(fs.readFileSync(path.join(ROOT, "data/loops-extra.json"), "utf8")));
  for (const l of loops) jobs.push({ id: l.id, pts: (l.waypoints || []).filter((w) => typeof w.lat === "number").map((w) => [w.lat, w.lng]), ferries: l.ferries || [] });
  let done = 0, skip = 0, fail = 0;
  for (const j of jobs) {
    if (j.pts.length < 2) continue;
    const k = key([j.pts, j.ferries]);
    if (!FORCE && cache[j.id] && cache[j.id].key === k) { skip++; continue; }
    try { const r = await routeLegs(j.pts, j.ferries); cache[j.id] = { key: k, ...r }; done++; console.log(`✓ ${j.id} ${r.km} km ${r.h} h (${r.pts.length} bodů)`); }
    catch (e) { fail++; console.log(`✗ ${j.id} ${e.message}`); }
    fs.writeFileSync(OUTF, JSON.stringify(cache));
  }
  console.log(`hotovo: ${done} nových, ${skip} beze změny, ${fail} chyb -> data/route-geom.json (${(fs.statSync(OUTF).size / 1024).toFixed(0)} kB)`);
})();
