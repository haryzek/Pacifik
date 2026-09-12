#!/usr/bin/env node
// Kontaktní arch pro vizuální kontrolu fotek: node scripts/contact-sheet.js [--ids a,b,c | --last N | --source commons-geo] -> _screeny/contact.jpg
"use strict";
const fs = require("fs"), path = require("path"), sharp = require("sharp");
const ROOT = path.join(__dirname, "..");
const places = JSON.parse(fs.readFileSync(path.join(ROOT, "data/places.json"), "utf8"));
const meta = JSON.parse(fs.readFileSync(path.join(ROOT, "data/photos.json"), "utf8"));
const args = process.argv.slice(2); const arg = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
let ids = Object.keys(meta);
if (arg("--ids")) ids = arg("--ids").split(",");
if (arg("--source")) ids = ids.filter((id) => (meta[id].source || "").startsWith(arg("--source")));
if (arg("--last")) ids = ids.slice(-+arg("--last"));
if (arg("--skip")) ids = ids.slice(+arg("--skip"));
ids = ids.filter((id) => fs.existsSync(path.join(ROOT, "photos", id + ".jpg"))).slice(0, 48);
const W = 240, H = 180, COLS = 6, ROWS = Math.ceil(ids.length / COLS);
(async () => {
  const tiles = [];
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i]; const p = places.find((x) => x.id === id) || { name: id };
    const label = Buffer.from(`<svg width="${W}" height="${H}"><rect y="${H - 34}" width="${W}" height="34" fill="rgba(0,0,0,.65)"/><text x="4" y="${H - 20}" font-size="11" fill="#fff" font-family="sans-serif">${p.name.replace(/&/g, "&amp;").replace(/</g, "&lt;").slice(0, 38)}</text><text x="4" y="${H - 6}" font-size="10" fill="#D9A441" font-family="monospace">${id} ${(meta[id].source || "").slice(0, 22)}</text></svg>`);
    const img = await sharp(path.join(ROOT, "photos", id + ".jpg")).resize(W, H, { fit: "cover" }).composite([{ input: label }]).toBuffer();
    tiles.push({ input: img, left: (i % COLS) * W, top: Math.floor(i / COLS) * H });
  }
  fs.mkdirSync(path.join(ROOT, "_screeny"), { recursive: true });
  const out = path.join(ROOT, "_screeny", "contact.jpg");
  await sharp({ create: { width: W * COLS, height: H * ROWS, channels: 3, background: "#111" } }).composite(tiles).jpeg({ quality: 80 }).toFile(out);
  console.log(out, ids.length);
})();
