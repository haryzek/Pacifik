#!/usr/bin/env node
// Vloží seznam photos/*.jpg do sw.js (PHOTOS) a bumpne CACHE_V na hash obsahu dat + fotek.
// Spouštět po merge.js a photos.js: node scripts/sw-build.js
"use strict";
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const ROOT = path.join(__dirname, "..");
const photos = fs.existsSync(path.join(ROOT, "photos")) ? fs.readdirSync(path.join(ROOT, "photos")).filter((f) => f.endsWith(".jpg")).sort() : [];
const h = crypto.createHash("md5");
for (const f of ["index.html", "data/places.json", "data/loops.json", "manifest.webmanifest"]) h.update(fs.readFileSync(path.join(ROOT, f)));
h.update(photos.join(","));
const v = "pacifik-" + h.digest("hex").slice(0, 8);
let sw = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");
sw = sw.replace(/const CACHE_V = '[^']*';/, `const CACHE_V = '${v}';`);
sw = sw.replace(/const PHOTOS = \[[^\]]*\];[^\n]*/, `const PHOTOS = ${JSON.stringify(photos.map((f) => "./photos/" + f))}; // generuje sw-build.js`);
fs.writeFileSync(path.join(ROOT, "sw.js"), sw);
const bytes = photos.reduce((a, f) => a + fs.statSync(path.join(ROOT, "photos", f)).size, 0);
console.log(`sw.js: CACHE_V=${v}, fotek ${photos.length} (${(bytes / 1048576).toFixed(1)} MB)`);
