#!/usr/bin/env node
// photos.js — stáhne 1 fotku na POI do photos/{id}.jpg (≈480 px, JPEG q70) a zapíše data/photos.json {id:{credit,license,source,src}}.
// Kaskáda: manual > raw photo.url (Commons/NPS) > Wikipedia článek > Wikipedia geosearch > Commons geosearch > Commons search.
// Idempotentní: existující photos/{id}.jpg přeskočí (pokud není --force). API odpovědi cachuje v data/photo-cache.json.
// node scripts/photos.js [--limit N] [--only id,id] [--force] [--rank1]
"use strict";
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.join(__dirname, "..");
const PH = path.join(ROOT, "photos");
const MAN = path.join(PH, "manual");
fs.mkdirSync(MAN, { recursive: true });
const places = JSON.parse(fs.readFileSync(path.join(ROOT, "data/places.json"), "utf8"));
const OUTJ = path.join(ROOT, "data/photos.json");
const CACHEJ = path.join(ROOT, "data/photo-cache.json");
const meta = fs.existsSync(OUTJ) ? JSON.parse(fs.readFileSync(OUTJ, "utf8")) : {};
const cache = fs.existsSync(CACHEJ) ? JSON.parse(fs.readFileSync(CACHEJ, "utf8")) : {};
const REJECT = fs.existsSync(path.join(ROOT, "data/photo-reject.json")) ? JSON.parse(fs.readFileSync(path.join(ROOT, "data/photo-reject.json"), "utf8")) : {};
const args = process.argv.slice(2);
const arg = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const FORCE = args.includes("--force"), LIMIT = +arg("--limit") || Infinity, ONLY = arg("--only")?.split(","), RANK1 = args.includes("--rank1");
const UA = "PacifikRoadTripApp/1.0 (personal offline travel app; bob.rericha@gmail.com)";
const SIZE = 480;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const BAD_RE = /\b(map|maps|mapa|logo|seal|flag|diagram|plan|sign|signs|svg|icon|chart|banner|coat of arms|locator|karte|schild|plaque|marker|graph|table|route|topo|satellite|poster|brochure|screenshot|drawing|sketch|painting|portrait|selfie)\b/i;
const BAD = { test: (s) => BAD_RE.test(String(s).replace(/[_\-.]/g, " ")) }; // podtržítka v názvech souborů
const GOODCAT = /(lakes?|beaches|waterfalls?|mountains?|coasts?|cliffs?|landscapes?|views? (of|from)|panoram|rivers?|canyons?|deserts?|rock formations|dunes|lighthouses?|forests?|trees|nature|geology|volcan|hot springs|bays?|islands?|sunsets?|piers?|bridges?|buildings?|motels?|diners?|neon|theat|architecture|murals?)/i;
const BADCAT = /\b(maps?|people|portraits?|signs?|men|women|persons?|groups? of|rangers?|staff|vehicles?|cars?|trucks?|buses|logos?|flags?|documents?|texts?|posters?|paintings?|drawings?|diagrams?|screenshots?|plaques?|licence plates|food|selfies?|interiors? of vehicles|taxidermy|employees|uniforms|hats|weddings?|events?|festivals?|crowds?|spiders?|insects?|arachnid|arthropod|crustacea|crabs?|beetles?|bugs?|moths?|butterflies|macro|satellite|from space|iss|aerial|earth observ|dredg|ships?|boats?|aquari|fish|interiors?)\b/i;

async function api(url) {
  if (cache[url]) return cache[url];
  for (let attempt = 0; attempt < 5; attempt++) {
    await sleep(200);
    const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
    if (r.status === 429 || r.status >= 500) { await sleep(4000 * (attempt + 1)); continue; }
    const j = r.ok ? await r.json() : { _err: r.status };
    if (r.ok) cache[url] = j; // chyby necachovat
    return j;
  }
  return { _err: 429 };
}
const STOP = new Set(["state", "park", "national", "the", "and", "county", "beach", "trail", "area", "point", "creek", "river", "lake", "falls", "road", "mount", "mountain"]);
const toks = (s) => new Set(String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((t) => t.length > 2 && !STOP.has(t)));
const sim = (a, b) => { const A = toks(a), B = toks(b); if (!A.size || !B.size) return 0; let n = 0; for (const t of A) if (B.has(t)) n++; return n / Math.min(A.size, B.size); };

// ---------- zdroje ----------
async function fromRawUrl(p) {
  const u = p.photo && p.photo.url; if (!u || !/^https?:/.test(u)) return null;
  if (!/upload\.wikimedia\.org|nps\.gov|fs\.usda\.gov|blm\.gov|parks\.ca\.gov|oregon\.gov|wa\.gov/i.test(u)) return null;
  if (BAD.test(u)) return null;
  return { url: u, credit: p.photo.credit || "", license: p.photo.license || "", source: "raw" };
}
async function fromWikiArticle(p) {
  const w = p.links && p.links.wiki; if (!w) return null;
  const m = w.match(/wikipedia\.org\/wiki\/([^#?]+)/); if (!m) return null;
  const j = await api(`https://en.wikipedia.org/api/rest_v1/page/summary/${m[1]}`);
  const src = j.originalimage?.source || j.thumbnail?.source; if (!src || BAD.test(src) || /\.svg/i.test(src)) return null;
  return await commonsMetaFromUrl(src, "wiki");
}
async function fromWikiGeo(p) {
  const j = await api(`https://en.wikipedia.org/w/api.php?action=query&generator=geosearch&ggscoord=${p.lat}|${p.lng}&ggsradius=2000&ggslimit=8&prop=pageimages&piprop=original&format=json`);
  const pages = Object.values(j.query?.pages || {}).filter((x) => x.original && !BAD.test(x.original.source) && !/\.svg/i.test(x.original.source));
  const best = pages.map((x) => ({ x, s: sim(x.title, p.name) })).sort((a, b) => b.s - a.s)[0];
  if (!best || best.s < 0.34) return null;
  return await commonsMetaFromUrl(best.x.original.source, "wiki-geo:" + best.x.title);
}
async function fromCommonsGeo(p) {
  const shop = ["culture", "food_gem", "motel_gem", "town"].includes(p.category);
  const j = await api(`https://commons.wikimedia.org/w/api.php?action=query&list=geosearch&gscoord=${p.lat}|${p.lng}&gsradius=1500&gsnamespace=6&gslimit=40&format=json`);
  const list = (j.query?.geosearch || []).filter((x) => /\.(jpe?g|png)$/i.test(x.title) && !BAD.test(x.title));
  if (!list.length) return null;
  // preferuj shodu názvu, jinak nejbližší
  list.forEach((x) => { x.s = sim(x.title.replace(/^File:/, ""), p.name); });
  list.sort((a, b) => b.s - a.s || a.dist - b.dist);
  if (shop && list[0].s < 0.34) return null; // obchod/bar: náhodná fotka ze sousedství není on
  const rej = REJECT[p.id] || [];
  const scored = [];
  for (const x of list.slice(0, 8)) {
    if (rej.includes(x.title)) continue;
    const r = await commonsInfo(x.title, "commons-geo"); if (!r) continue;
    if (x.s < 0.34 && !GOODCAT.test(r.cats)) continue; // bez shody jména chceme pozitivní důkaz (krajina, pláž…)
    r.score = x.s * 2 + (GOODCAT.test(r.cats) ? 1 : 0) + (r.w >= 1600 ? 0.3 : 0) - x.dist / 3000;
    scored.push(r);
  }
  scored.sort((a, b) => b.score - a.score);
  return scored[0] || null;
}
async function fromCommonsSearch(p) {
  const q = encodeURIComponent(`${p.name.replace(/[—–(].*$/, "").trim()} ${(p.nearest_town || "").split(",")[0]}`);
  const j = await api(`https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${q}&srnamespace=6&srlimit=15&format=json`);
  const list = (j.query?.search || []).filter((x) => /\.(jpe?g|png)$/i.test(x.title) && !BAD.test(x.title));
  const best = list.map((x) => ({ x, s: sim(x.title.replace(/^File:/, ""), p.name) })).sort((a, b) => b.s - a.s)[0];
  if (!best || best.s < 0.67) return null;
  return await commonsInfo(best.x.title, "commons-search");
}
async function commonsInfo(title, source) {
  const j = await api(`https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=800&format=json`);
  const pg = Object.values(j.query?.pages || {})[0]; const ii = pg?.imageinfo?.[0]; if (!ii) return null;
  if (ii.width < 300 || !/jpeg|png/.test(ii.mime)) return null;
  const em = ii.extmetadata || {};
  const cats = String(em.Categories?.value || "").replace(/[_|]/g, " ");
  if (BADCAT.test(cats)) return null;
  if (/png/.test(ii.mime) && !/photograph/i.test(cats)) return null;
  if (ii.height > ii.width * 1.25) return null; // na výšku = často lidi/cedule
  const strip = (h) => String(h || "").replace(/<[^>]+>/g, "").trim().slice(0, 80);
  return { url: ii.thumburl || ii.url, credit: strip(em.Artist?.value), license: strip(em.LicenseShortName?.value), source, page: ii.descriptionurl, cats, w: ii.width, title };
}
async function commonsMetaFromUrl(src, source) {
  // z upload URL vytáhni File:name a dotáhni licenci; když se nepovede, použij URL bez creditu
  const m = decodeURIComponent(src).match(/\/([^\/]+\.(?:jpe?g|png))(?:\/|$)/i);
  if (m) { const info = await commonsInfo("File:" + m[1].replace(/^\d+px-/, ""), source); if (info) return info; }
  return { url: src, credit: "", license: "", source };
}

// ---------- stažení ----------
async function download(url) {
  await sleep(60);
  let r = await fetch(url, { headers: { "User-Agent": UA } });
  if (r.status === 429) { await sleep(5000); r = await fetch(url, { headers: { "User-Agent": UA } }); }
  if (!r.ok) throw new Error("HTTP " + r.status);
  return Buffer.from(await r.arrayBuffer());
}
async function saveJpg(buf, out) {
  const img = sharp(buf).rotate();
  const m = await img.metadata(); if ((m.width || 0) < 200) throw new Error("too small");
  await img.resize({ width: SIZE, height: SIZE, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 70, mozjpeg: true }).toFile(out);
}

// ---------- hlavní smyčka ----------
(async () => {
  // reject list: zamítnuté fotky smazat, jejich Commons title zapamatovat, aby se nevybraly znovu
  delete REJECT._comment;
  for (const id of Object.keys(REJECT)) {
    const f = path.join(PH, id + ".jpg");
    if (REJECT[id] === "none") { if (fs.existsSync(f)) { fs.unlinkSync(f); delete meta[id]; } continue; }
    if (fs.existsSync(f)) {
      const t = meta[id] && meta[id].title; if (t && !REJECT[id].includes(t)) REJECT[id].push(t);
      fs.unlinkSync(f); delete meta[id]; console.log("reject:", id, t || "");
    }
  }
  fs.writeFileSync(path.join(ROOT, "data/photo-reject.json"), JSON.stringify(REJECT, null, 1));
  let todo = places.filter((p) => REJECT[p.id] !== "none").filter((p) => !ONLY || ONLY.includes(p.id)).filter((p) => !RANK1 || p.rank === 1);
  let n = 0, ok = 0, fail = 0, skip = 0;
  const missing = [];
  const WORKERS = 2; let idx = 0;
  async function worker() { while (idx < todo.length && n < LIMIT) { const p = todo[idx++]; await one(p); } }
  async function one(p) {
    const out = path.join(PH, p.id + ".jpg"), man = path.join(MAN, p.id + ".jpg");
    if (fs.existsSync(man)) { await saveJpg(fs.readFileSync(man), out); meta[p.id] = { credit: "Bob", license: "", source: "manual" }; ok++; return; }
    if (fs.existsSync(out) && !FORCE) { skip++; return; }
    n++;
    let got = null;
    for (const fn of [fromRawUrl, fromWikiArticle, fromWikiGeo, fromCommonsGeo, fromCommonsSearch]) {
      try { got = await fn(p); } catch (e) { got = null; }
      if (!got) continue;
      try { await saveJpg(await download(got.url), out); break; } catch (e) { got = null; }
    }
    if (got) { meta[p.id] = { credit: got.credit, license: got.license, source: got.source, page: got.page || null, title: got.title || null }; ok++; process.stdout.write(`✓ ${p.id} ${p.name.slice(0, 40)} [${got.source}]\n`); }
    else { fail++; missing.push(`${p.id}\t${p.name}\t${p.lat},${p.lng}`); process.stdout.write(`✗ ${p.id} ${p.name.slice(0, 40)}\n`); }
    if (n % 20 === 0) { fs.writeFileSync(OUTJ, JSON.stringify(meta, null, 1)); fs.writeFileSync(CACHEJ, JSON.stringify(cache)); }
  }
  await Promise.all(Array.from({ length: WORKERS }, worker));
  fs.writeFileSync(OUTJ, JSON.stringify(meta, null, 1));
  fs.writeFileSync(CACHEJ, JSON.stringify(cache));
  const all = fs.readdirSync(PH).filter((f) => f.endsWith(".jpg"));
  const bytes = all.reduce((a, f) => a + fs.statSync(path.join(PH, f)).size, 0);
  const noPhoto = places.filter((p) => !fs.existsSync(path.join(PH, p.id + ".jpg")));
  fs.writeFileSync(path.join(ROOT, "data/missing-photos.txt"), noPhoto.map((p) => `${p.id}\t${p.rank}\t${p.name}\t${p.lat},${p.lng}\t${p.links.wiki || ""}`).join("\n"));
  console.log(`\nhotovo: nové ${ok}, chyby ${fail}, přeskočeno ${skip} | fotek celkem ${all.length}/${places.length} (${(bytes / 1048576).toFixed(1)} MB) | bez fotky: data/missing-photos.txt`);
})();
