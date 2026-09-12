#!/usr/bin/env node
// data/gaps/*.json (rychlé mapování: name, lat, lng, category, why, swim, url) -> data/gaps-import.json (plné schéma).
// merge.js ho načte stejně jako extra.json. Opravy pak přes data/fixes.json podle id (g-<region>-NNN).
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

// ---- ruční zásahy ----
const RANK1 = new Set(["Timberline Lodge", "Tor House and Hawk Tower", "Fort Point National Historic Site", "Madonna Inn", "Bowling Ball Beach", "Crack-in-the-Ground", "Fort Rock State Natural Area", "Lava River Cave", "Paulina Lake — Little Crater Day Use Site", "Paulina Lake Hot Springs", "Mount Wilson Observatory", "Deep Creek Hot Springs", "Ubehebe Crater", "Zzyzx & Lake Tuendae", "North Shore Beach & Yacht Club", "Elmer's Bottle Tree Ranch", "Kiana Lodge", "Laura Palmer's House", "Middle McCloud Falls", "Castle Lake", "Steamboat Falls", "Six Mile Day Use Area — Illinois River", "Rooster Rock State Park — Clothing-Optional Beach", "Lost Lake", "Mississippi Records", "Mother Foucault's Bookshop", "The Fillmore", "Garden of Eden Swimming Hole", "Rocky Brook Falls", "Blue Lake Trail", "Colonial Creek — Diablo Lake shore", "Parkfield — Earthquake Capital of the World", "Pann's Restaurant", "2nd Street Tunnel", "D.G. Wills Books", "Agua Caliente County Park", "Ghost Mountain – Yaquitepec", "Salmon Creek Falls", "Point Sur Lightstation", "Jade Cove", "Sisters Rock State Park", "Golden and Silver Falls State Natural Area", "Summer Lake Hot Springs", "Hole-in-the-Ground", "Bayocean Peninsula Park", "The Palms Motel", "Scarecrow Video", "Hobuck Beach", "Navarro-by-the-Sea & Captain Fletcher's Inn", "Pacific Biological Laboratories — Ed Ricketts' Lab", "Wildrose Charcoal Kilns", "Devil's Punchbowl Natural Area", "Moe's Alley", "Ocean Park Motel", "Fortynine Palms Oasis", "Kwaaymii Point", "Carrizo Badlands Overlook", "Gaviota Hot Springs", "Lizard's Mouth", "More Mesa Beach", "Chicken Ranch Beach", "Limantour Beach", "Steelhead Beach Regional Park", "Johnson's Beach – Guerneville", "Hendy Woods State Park – Big Hendy Grove", "Sweet Creek Falls Trailhead", "Floras Lake — Boice Cope Park", "Lobster Creek Campground — Rogue River", "Fairholme — Lake Crescent west shore", "Freshwater Lagoon", "Lower McCloud Falls", "Hedge Creek Falls", "Bumpass Hell Trailhead"]);
const COORDS = { "Hall of Horrors": [34.0206, -116.1314] }; // research zkopíroval souřadnice Hidden Valley
const DROP = new Set(["The Slot Trailhead", "Doane Pond", "San Diego Automotive Museum"]); // duplicity/výplň
const ROAD = { "Deep Creek Hot Springs": "gravel_ok_sedan", "Crack-in-the-Ground": "gravel_ok_sedan", "Hole-in-the-Ground": "gravel_ok_sedan", "Fort Rock State Natural Area": "paved", "Ghost Mountain – Yaquitepec": "rough_caution", "Wildrose Charcoal Kilns": "gravel_ok_sedan", "Twenty Mule Team Canyon": "gravel_ok_sedan", "Calcite Mine Trailhead": "paved", "Blacklock Point": "paved", "Taylor Dunes Trailhead": "paved", "Steamboat Creek Road": "gravel_ok_sedan", "Flatiron Rock — Oregon Badlands Wilderness": "gravel_ok_sedan", "Lava Cast Forest": "gravel_ok_sedan", "Steiner Flat — Trinity River": "gravel_ok_sedan", "Hell Gate — South Fork Trinity River": "gravel_ok_sedan", "Castle Crags — Vista Point": "paved", "Whiskey Run Beach": "paved", "Mitchell Caverns & Providence Mountains": "paved", "Zzyzx & Lake Tuendae": "paved", "Bayocean Peninsula Park": "gravel_ok_sedan", "Pushawalla Canyon & Palms": "gravel_ok_sedan", "Thousand Palms Oasis Preserve": "paved", "Mission Creek Preserve": "gravel_ok_sedan", "Elmer's Bottle Tree Ranch": "paved", "Point Sal State Beach": "gravel_ok_sedan" };
const ANSWER = [[/\bmůžeš\b/g, "může"], [/\bdostaneš\b/g, "dostane"], [/\bbudeš\b/g, "bude"], [/\btvoje\b/g, "jeho"], [/\btvůj\b/g, "jeho"], [/\btvé\b/g, "jeho"], [/\btvým\b/g, "jeho"], [/\buvidíš\b/g, "uvidí"], [/\bpro tebe\b/g, "pro něj"], [/\bmáš\b/g, "má"], [/\bchceš\b/g, "chce"], [/\bvydáš\b/g, "vydá"], [/\btebou\b/g, "ním"], [/\bpod tebou\b/g, "pod ním"], [/\bsebe\b/g, "sebe"], [/\bobětuješ\b/g, "obětuje"], [/\bobětuje\b/g, "obětuje"], [/\btady\b/g, "tady"]];
const fixTone = (s) => ANSWER.reduce((t, [re, to]) => t.replace(re, to), s);

const out = [];
const counters = {};
const seen = [];
let dropped = 0;
for (const f of fs.readdirSync(path.join(ROOT, "data/gaps")).sort()) {
  const region = f.replace(/_gaps\.json$/, "");
  for (const g of JSON.parse(fs.readFileSync(path.join(ROOT, "data/gaps", f), "utf8"))) {
    if (DROP.has(g.name)) { dropped++; continue; }
    if (seen.find((s) => hav(s, g) < 1 && jac(s.name, g.name) >= 0.5)) { dropped++; continue; }
    if (places.find((p) => hav(p, g) < 3 && jac(p.name, g.name) >= 0.4)) { dropped++; continue; }
    if (places.find((p) => hav(p, g) < 2 && p.category === "hot_spring" && g.category === "hot_spring")) { dropped++; continue; }
    seen.push(g);
    const n = (counters[region] = (counters[region] || 0) + 1);
    const c = COORDS[g.name];
    const swimWater = g.swim && g.swim !== "no" ? g.swim : null;
    const swim = swimWater
      ? { possible: true, water: swimWater, temp_c_sept_oct: null, legal: "allowed", solitude: null, safety: swimWater === "ocean" ? "Pacifik — příboj a proudy, jen u břehu a s rozmyslem" : null }
      : { possible: false, water: null, temp_c_sept_oct: null, legal: null, solitude: null, safety: null };
    let rank = RANK1.has(g.name) ? 1 : (swimWater || ["motel_gem", "food_gem", "culture", "oddity", "hot_spring", "dark_sky"].includes(g.category)) ? 2 : 3;
    const cat = ["coast", "forest", "desert", "mountain", "lake_river", "waterfall", "geology", "scenic_drive", "town", "motel_gem", "food_gem", "culture", "oddity", "dark_sky", "hot_spring"].includes(g.category) ? g.category : "culture";
    const lat = c ? c[0] : g.lat, lng = c ? c[1] : g.lng;
    out.push({
      id: `g-${region.toLowerCase()}-${String(n).padStart(3, "0")}`, region: region === "R9" && lat < 33.5 && lng < -116 ? "R9" : region,
      name: g.name.replace(/\s+/g, " ").trim(), category: cat, subcategory: null, lat, lng, nearest_town: null, distance_from_spine_km: null,
      description: "", why_bob: fixTone(g.why.trim()), time_needed: null,
      effort: { type: null, distance_km: null, elevation_m: null, difficulty: null },
      swim, road_access: ROAD[g.name] || "paved", best_time: null,
      season_note_2026: "rychlé mapování — hodiny, ceny a stav cesty neověřené",
      fee: null,
      links: { maps: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`, official: g.url && !/wikipedia\.org/.test(g.url) ? g.url : null, wiki: g.url && /wikipedia\.org/.test(g.url) ? g.url : null },
      photo: null, tags: ["gap_scan", ...(swimWater ? ["swim_unverified"] : [])], rank,
    });
  }
}
fs.writeFileSync(path.join(ROOT, "data/gaps-import.json"), JSON.stringify(out, null, 1));
const byR = {}; for (const p of out) byR[p.region] = (byR[p.region] || 0) + 1;
console.log(`gaps-import: ${out.length} míst (${dropped} vyřazeno), rank1=${out.filter((p) => p.rank === 1).length}, swim=${out.filter((p) => p.swim.possible).length}`);
console.log(Object.entries(byR).map(([k, v]) => `${k}:${v}`).join("  "));
const missing = [...RANK1].filter((n) => !out.find((p) => p.name === n)); if (missing.length) console.log("RANK1 nenalezeno:", missing.join(" | "));
