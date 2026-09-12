#!/usr/bin/env node
// Ověří links.official (HTTP status) u míst; výstup data/link-report.txt. node scripts/verify-links.js [--rank1] [--all]
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const places = JSON.parse(fs.readFileSync(path.join(ROOT, "data/places.json"), "utf8"));
const args = process.argv.slice(2);
let todo = places.filter((p) => p.links && p.links.official && /^https?:/.test(p.links.official));
if (!args.includes("--all")) todo = todo.filter((p) => p.rank === 1);
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) PacifikRoadTripApp/1.0";
async function check(url) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 12000);
  try {
    let r = await fetch(url, { method: "GET", redirect: "follow", signal: ctl.signal, headers: { "User-Agent": UA, Accept: "text/html,*/*" } });
    return { status: r.status, final: r.url };
  } catch (e) { return { status: 0, err: e.name === "AbortError" ? "timeout" : e.message.slice(0, 40) }; }
  finally { clearTimeout(t); }
}
(async () => {
  const out = []; let i = 0, bad = 0;
  const W = 6; let idx = 0;
  async function worker() { while (idx < todo.length) { const p = todo[idx++]; const r = await check(p.links.official); i++; if (r.status !== 200) { bad++; out.push(`${p.id}\t${r.status || r.err}\t${p.name}\t${p.links.official}${r.final && r.final !== p.links.official ? "\t-> " + r.final : ""}`); } if (i % 25 === 0) process.stdout.write(`${i}/${todo.length}\r`); } }
  await Promise.all(Array.from({ length: W }, worker));
  fs.writeFileSync(path.join(ROOT, "data/link-report.txt"), out.sort().join("\n"));
  console.log(`\nzkontrolováno ${todo.length}, problém ${bad} -> data/link-report.txt`);
})();
