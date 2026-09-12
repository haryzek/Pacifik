#!/usr/bin/env node
// Pokrytí vnitrozemí odbočkami: která místa > SPINE_KM od páteře nejsou v koridoru žádné odbočky.
// node scripts/loops-cover.js  (čte data/places.json + data/loops.json po merge)
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const places = JSON.parse(fs.readFileSync(path.join(ROOT, "data/places.json"), "utf8"));
const loops = JSON.parse(fs.readFileSync(path.join(ROOT, "data/loops.json"), "utf8"));
const { SPINE, distToPolyline, SPINE_KM, CORRIDOR_KM } = require("./geo.js");

const inland = places.filter((p) => distToPolyline(p, SPINE) > SPINE_KM);
const covered = new Set(); for (const l of loops) for (const id of l.near_ids || []) covered.add(id);
const un = inland.filter((p) => !covered.has(p.id));
console.log(`POI ${places.length}, vnitrozemí (> ${SPINE_KM} km od páteře): ${inland.length}, v koridoru odbočky (${CORRIDOR_KM} km): ${inland.length - un.length}, NEPOKRYTO: ${un.length}\n`);
const byR = {}; for (const p of un) (byR[p.region] ||= []).push(p);
for (const [r, list] of Object.entries(byR).sort()) {
  console.log(`## ${r} (${list.length})`);
  for (const p of list.sort((a, b) => b.lat - a.lat)) console.log(`  ${p.id.padEnd(10)} ★${p.rank} ${p.lat.toFixed(3)},${p.lng.toFixed(3)}  ${Math.round(distToPolyline(p, SPINE))} km  ${p.name} (${(p.nearest_town || "").split(",")[0]})`);
}
