#!/usr/bin/env node
// Sloučí data/gaps/*.json, označí duplicity proti data/places.json a vypíše přehled k ručnímu posouzení.
// node scripts/gaps-review.js > scratch.txt
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const places = JSON.parse(fs.readFileSync(path.join(ROOT, "data/places.json"), "utf8"));
const R = 6371;
const hav = (a, b) => { const dLat = ((b.lat - a.lat) * Math.PI) / 180, dLng = ((b.lng - a.lng) * Math.PI) / 180; const x = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
const STOP = new Set(["state", "park", "national", "the", "and", "county", "beach", "trail"]);
const tokens = (s) => new Set(s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((t) => t.length > 2 && !STOP.has(t)));
const jac = (a, b) => { const A = tokens(a), B = tokens(b); let n = 0; for (const t of A) if (B.has(t)) n++; return n / (A.size + B.size - n || 1); };

const all = [];
for (const f of fs.readdirSync(path.join(ROOT, "data/gaps")).sort()) {
  const region = f.replace(/_gaps\.json$/, "");
  for (const g of JSON.parse(fs.readFileSync(path.join(ROOT, "data/gaps", f), "utf8"))) all.push({ ...g, region, file: f });
}
// dedupe uvnitř gaps
const seen = [];
for (const g of all) {
  const twin = seen.find((s) => hav(s, g) < 1 && jac(s.name, g.name) >= 0.5);
  if (twin) { g.dupOf = "gaps:" + twin.name; continue; }
  seen.push(g);
  let best = null;
  for (const p of places) {
    const d = hav(p, g); if (d > 3) continue;
    const j = jac(p.name, g.name);
    if (j >= 0.4 && (!best || j > best.j)) best = { p, d, j };
    if (d < 0.06 && j < 0.4) g.sameCoords = `${p.id} ${p.name}`;
  }
  if (best) g.dupOf = `${best.p.id} ${best.p.name} (${best.d.toFixed(2)} km, j=${best.j.toFixed(2)})`;
}
const dups = all.filter((g) => g.dupOf).length;
console.log(`# gaps: ${all.length}, duplicity: ${dups}, nové: ${all.length - dups}\n`);
for (const g of all) console.log(`${g.dupOf ? "DUP " : "NEW "}[${g.region}] ${g.name} | ${g.category} | swim=${g.swim} | ${g.lat},${g.lng}${g.dupOf ? "\n     = " + g.dupOf : ""}${g.sameCoords ? "\n     !! stejné souřadnice jako " + g.sameCoords : ""}\n     ${g.why}`);
if (process.argv.includes("--json")) fs.writeFileSync(path.join(ROOT, "data/gaps-merged.json"), JSON.stringify(all.filter((g) => !g.dupOf), null, 1));
