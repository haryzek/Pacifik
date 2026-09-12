#!/usr/bin/env node
// merge.js — sloučí data/raw/*.json (+ fixes.json, extra.json) do data/places.json a data/loops.json
// Spuštění: node scripts/merge.js
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const RAW = path.join(ROOT, "data", "raw");
const OUT = path.join(ROOT, "data");

const CATEGORIES = ["coast", "forest", "desert", "mountain", "lake_river", "waterfall", "geology", "scenic_drive", "town", "motel_gem", "food_gem", "culture", "oddity", "dark_sky", "hot_spring"];
const CATEGORY_ALIAS = { viewpoint: "coast", nature: "coast" }; // fallback, konkrétní id se řeší ve fixes.json
const ROAD = ["paved", "gravel_ok_sedan", "rough_caution", "ford", "4x4_only"];
const BBOX = { latMin: 32, latMax: 49.5, lngMin: -125, lngMax: -114 };

const warn = [];
const W = (m) => warn.push(m);

// ---------- 1. Oprava rozbitých JSONů (R6–R8 od Karolínky) ----------
function repair(s) {
  s = s.replace(/\r\n?/g, "\n");
  s = s.replace(/\\x([0-9a-f]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16))); // \xe1 -> á
  s = s.replace(/\\(?![\\"\/bfnrtu])/g, "");                                            // \, -> ,
  s = s.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, " ");                                   // control chars
  s = s.replace(/^(\s*"[a-z_0-9]+":\s*"[^"\n]*)\n(?=\s*"[a-z_0-9]+":)/gm, '$1",\n');      // neukončený string
  const i = s.lastIndexOf("\n]");                                                        // próza za polem
  if (i > 0) s = s.slice(0, i + 2);
  return s;
}
function loadArray(file) {
  const raw = fs.readFileSync(file, "utf8");
  try { return JSON.parse(raw); } catch (e) { /* fallthrough */ }
  const s = repair(raw);
  try { const j = JSON.parse(s); W(`${path.basename(file)}: opraveno strojově`); return j; } catch (e) { /* fallthrough */ }
  // po objektech
  const out = [];
  for (let p of s.split(/\n  \{\s*\n\s*"id"/).slice(1)) {
    p = '{"id"' + p; p = p.slice(0, p.lastIndexOf("}") + 1);
    try { out.push(JSON.parse(p)); } catch (e) { W(`${path.basename(file)}: ZAHOZEN objekt ${(p.match(/"name":\s*"([^"]*)"/) || [])[1]} (${e.message.slice(0, 50)})`); }
  }
  W(`${path.basename(file)}: parsováno po objektech, ${out.length} ok`);
  return out;
}

// ---------- 2. Načtení ----------
const files = fs.readdirSync(RAW).filter((f) => /^R\d+[a-z]?\.json$/i.test(f)).sort();
let places = [];
for (const f of files) places.push(...loadArray(path.join(RAW, f)));

const bonus = loadArray(path.join(RAW, "bonus.json"));
bonus.forEach((p, i) => { p.id = `gem-${String(i + 1).padStart(3, "0")}`; p._bonus = true; });
places.push(...bonus);

for (const f of ["extra.json", "gaps-import.json"]) { const fp = path.join(OUT, f); if (fs.existsSync(fp)) places.push(...JSON.parse(fs.readFileSync(fp, "utf8"))); }

const fixesFile = path.join(OUT, "fixes.json");
const fixes = fs.existsSync(fixesFile) ? JSON.parse(fs.readFileSync(fixesFile, "utf8")) : {};
const MERGE_PAIRS = (fixes._merge_pairs || []).map((pr) => pr.join("|"));
delete fixes._comment; delete fixes._merge_pairs;

const loops = JSON.parse(fs.readFileSync(path.join(RAW, "loops.json"), "utf8"));
const loopsExtra = path.join(OUT, "loops-extra.json");
if (fs.existsSync(loopsExtra)) loops.push(...JSON.parse(fs.readFileSync(loopsExtra, "utf8")));
const geo = require("./geo.js");

// ---------- 3. Fixes + normalizace ----------
const trim = (v) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : v);
const fixedIds = new Set();
for (const p of places) {
  if (fixes[p.id]) { Object.assign(p, fixes[p.id]); fixedIds.add(p.id); }
  for (const k of ["name", "description", "why_bob", "time_needed", "best_time", "season_note_2026", "fee", "nearest_town", "subcategory"]) p[k] = trim(p[k]);
  if (p.season_note_2026 && /\$\{/.test(p.season_note_2026)) p.season_note_2026 = p.season_note_2026.replace(/,?\s*info na \[.*?\]\(\$\{.*?\}\)/, "");
  if (p.fee === "null" || p.fee === "undefined") p.fee = null;
  if (p.best_time === "undefined") p.best_time = null;
  if (!CATEGORIES.includes(p.category)) { const a = CATEGORY_ALIAS[p.category]; W(`${p.id} category '${p.category}' -> '${a || "culture"}'`); p.category = a || "culture"; }
  if (!ROAD.includes(p.road_access)) { W(`${p.id} road_access '${p.road_access}' -> paved`); p.road_access = "paved"; }
  p.rank = Math.min(3, Math.max(1, Number(p.rank) || 2));
  p.tags = Array.isArray(p.tags) ? [...new Set(p.tags.map(trim).filter(Boolean))] : [];
  p.links = p.links || {}; p.swim = p.swim || { possible: false }; p.effort = p.effort || {};
  if (!p.links.maps) p.links.maps = `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`;
  if (p.swim.possible && p.swim.legal === "prohibited") W(`${p.id} swim.possible ale prohibited -> zobrazí se bez 💧`);
}
for (const id of Object.keys(fixes)) if (!fixedIds.has(id)) W(`fixes.json: id ${id} nenalezeno`);

// ---------- 4. Validace ----------
const REQUIRED = ["id", "region", "name", "category", "lat", "lng", "why_bob"];
places = places.filter((p) => {
  const missing = REQUIRED.filter((k) => p[k] === undefined || p[k] === null || p[k] === "");
  if (missing.length) { W(`${p.id || "?"} ${p.name || ""}: chybí ${missing.join(",")} -> VYŘAZEN`); return false; }
  if (typeof p.lat !== "number" || typeof p.lng !== "number") { W(`${p.id}: souřadnice nejsou čísla -> VYŘAZEN`); return false; }
  if (p.lat < BBOX.latMin || p.lat > BBOX.latMax || p.lng < BBOX.lngMin || p.lng > BBOX.lngMax) W(`${p.id} ${p.name}: mimo bbox (${p.lat},${p.lng})`);
  if (p.road_access === "4x4_only") { W(`${p.id}: 4x4_only -> VYŘAZEN`); return false; }
  return true;
});

// ---------- 5. Dedupe (název + vzdálenost) ----------
const R = 6371;
const hav = (a, b) => { const dLat = ((b.lat - a.lat) * Math.PI) / 180, dLng = ((b.lng - a.lng) * Math.PI) / 180; const x = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
const STOP = new Set(["state", "park", "national", "the", "and", "county"]);
const tokens = (s, drop = new Set()) => new Set(s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((t) => t.length > 2 && !STOP.has(t) && !drop.has(t)));
// overlap názvů bez tokenů z nearest_town (aby "Mendocino X" a "Mendocino Y" nebyly dvojčata)
// Jaccard přes tokeny názvů (bez tokenů nearest_town). Research často dává různým místům v jednom parku
// stejné souřadnice, takže vzdálenost sama nestačí — radši skoro-duplikát než ztracené místo.
const overlap = (a, b, town = "") => { const drop = tokens(town); const A = tokens(a, drop), B = tokens(b, drop); if (!A.size || !B.size) return 0; let n = 0; for (const t of A) if (B.has(t)) n++; return n / (A.size + B.size - n); };
const isTwin = (p, q) => MERGE_PAIRS.includes(`${p.id}|${q.id}`) || MERGE_PAIRS.includes(`${q.id}|${p.id}`) || (hav(p, q) < 1.5 && overlap(p.name, q.name, `${p.nearest_town || ""} ${q.nearest_town || ""}`) >= 0.6);

const ids = new Set(); for (const p of places) { if (ids.has(p.id)) W(`duplicitní id ${p.id}`); ids.add(p.id); }
const merged = [];
const removed = [];
for (const p of places) {
  const twin = merged.find((q) => isTwin(p, q));
  if (!twin) { merged.push(p); continue; }
  // vítěz: nižší rank; při shodě delší why_bob; bonus (gem) prohrává jen když je horší
  const pBetter = p.rank < twin.rank || (p.rank === twin.rank && (p.why_bob || "").length > (twin.why_bob || "").length);
  const win = pBetter ? p : twin, lose = pBetter ? twin : p;
  win.tags = [...new Set([...(win.tags || []), ...(lose.tags || [])])];
  for (const k of ["official", "wiki"]) if (!win.links[k] && lose.links[k]) win.links[k] = lose.links[k];
  if (!win.photo && lose.photo) win.photo = lose.photo;
  if (!win.swim.possible && lose.swim.possible) win.swim = lose.swim;
  win.aliases = [...new Set([...(win.aliases || []), lose.id])];
  if (pBetter) merged[merged.indexOf(twin)] = p;
  removed.push(`${lose.id} (${lose.name}) -> ${win.id}`);
}
places = merged;

// ---------- 6. spineIndex (lat jako proxy, S→J) + lokální fotky ----------
const photoMeta = fs.existsSync(path.join(OUT, "photos.json")) ? JSON.parse(fs.readFileSync(path.join(OUT, "photos.json"), "utf8")) : {};
for (const p of places) {
  p.spineIndex = Math.round((49.5 - p.lat) * 100) / 100;
  const local = fs.existsSync(path.join(ROOT, "photos", p.id + ".jpg")) || (p.aliases || []).some((a) => fs.existsSync(path.join(ROOT, "photos", a + ".jpg")));
  if (local) {
    const id = fs.existsSync(path.join(ROOT, "photos", p.id + ".jpg")) ? p.id : (p.aliases || []).find((a) => fs.existsSync(path.join(ROOT, "photos", a + ".jpg")));
    const m = photoMeta[id] || {};
    p.photo_local = id; // photos/{photo_local}.jpg
    p.photo = { url: p.photo && p.photo.url || null, credit: m.credit || "", license: m.license || "", source: m.source || "", page: m.page || null };
  } else p.photo_local = null;
}
places.sort((a, b) => a.spineIndex - b.spineIndex);
for (const p of places) delete p._bonus;

// ---------- 7. Loops ----------
const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
const byName = new Map(places.map((p) => [norm(p.name), p.id]));
const byId = new Map(places.map((p) => [p.id, p]));
let stopHits = 0, stopMiss = 0;
for (const l of loops) {
  l.rank = Number(l.rank) || 99;
  l.stop_ids = (l.stops || []).map((s) => {
    const n = norm(s);
    let id = byName.get(n);
    if (!id && n.length >= 6) { // název POI začíná stopem nebo ho obsahuje jako frázi -> nejkratší kandidát
      const c = places.filter((p) => { const pn = norm(p.name); return pn.startsWith(n) || (s.trim().includes(" ") && pn.includes(n)); }).sort((a, b) => a.name.length - b.name.length)[0];
      id = c ? c.id : null;
    }
    if (!id) { const c = places.find((p) => overlap(p.name, s) >= 0.6); id = c ? c.id : null; }
    if (id) { const p = byId.get(id); if (!(l.waypoints || []).some((w) => hav(p, w) < 60)) id = null; } // musí ležet u trasy
    id ? stopHits++ : stopMiss++;
    return id;
  });
}
// "po cestě": všechna místa v koridoru trasy, seřazená podél ní
for (const l of loops) {
  const line = (l.waypoints || []).filter((w) => typeof w.lat === "number");
  if (line.length < 2) { l.near_ids = []; continue; }
  l.near_ids = places.filter((p) => geo.distToPolyline(p, line) <= geo.CORRIDOR_KM)
    .map((p) => ({ id: p.id, pos: geo.alongPolyline(p, line) })).sort((a, b) => a.pos - b.pos).map((x) => x.id);
  l.stop_ids = l.stop_ids || [];
}
for (const p of places) p.loop_ids = loops.filter((l) => l.near_ids.includes(p.id)).map((l) => l.id);
loops.sort((a, b) => a.rank - b.rank);

// ---------- 8. Výstup ----------
fs.writeFileSync(path.join(OUT, "places.json"), JSON.stringify(places, null, 0));
fs.writeFileSync(path.join(OUT, "loops.json"), JSON.stringify(loops, null, 0));

// ---------- 9. Report ----------
const count = (fn) => { const m = {}; for (const p of places) { const k = fn(p); m[k] = (m[k] || 0) + 1; } return m; };
const fmt = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join("  ");
console.log(`\n=== MERGE REPORT ===`);
console.log(`Soubory: ${files.join(", ")} + bonus.json + extra.json`);
console.log(`POI celkem: ${places.length}   (odstraněno duplicit: ${removed.length})`);
console.log(`Region:    ${fmt(count((p) => p.region))}`);
console.log(`Category:  ${fmt(count((p) => p.category))}`);
console.log(`Rank:      ${fmt(count((p) => p.rank))}`);
console.log(`Road:      ${fmt(count((p) => p.road_access))}`);
console.log(`Swim:      possible=${places.filter((p) => p.swim.possible).length}  nabízené (allowed/tolerated)=${places.filter((p) => p.swim.possible && ["allowed", "tolerated"].includes(p.swim.legal)).length}`);
console.log(`Photo:     lokální=${places.filter((p) => p.photo_local).length}  bez=${places.filter((p) => !p.photo_local).length}`);
console.log(`Wiki link: ${places.filter((p) => p.links.wiki).length}`);
console.log(`Fixes aplikováno: ${fixedIds.size}`);
console.log(`Loops: ${loops.length}, stops match ${stopHits}/${stopHits + stopMiss}, po cestě celkem ${loops.reduce((a, l) => a + l.near_ids.length, 0)}, vnitrozemí nepokryto: ${places.filter((p) => geo.distToPolyline(p, geo.SPINE) > geo.SPINE_KM && !p.loop_ids.length).length}`);
if (removed.length) console.log(`\nDuplicity:\n  ` + removed.join("\n  "));
if (warn.length) console.log(`\nWarnings (${warn.length}):\n  ` + warn.join("\n  "));
console.log(`\n-> data/places.json (${(fs.statSync(path.join(OUT, "places.json")).size / 1024).toFixed(0)} kB), data/loops.json`);
