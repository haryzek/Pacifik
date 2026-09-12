#!/usr/bin/env node
// Vygeneruje icons/icon-192.png, icon-512.png, maskable-512.png z jednoduchého SVG (kokos na noční obloze).
"use strict";
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const OUT = path.join(__dirname, "..", "icons");
fs.mkdirSync(OUT, { recursive: true });

const svg = (pad) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${pad ? 0 : 96}" fill="#0f1419"/>
  <circle cx="256" cy="248" r="${pad ? 150 : 172}" fill="#D9A441"/>
  <circle cx="256" cy="248" r="${pad ? 112 : 128}" fill="#0f1419"/>
  <circle cx="256" cy="248" r="${pad ? 96 : 110}" fill="#e8e2d6"/>
  <circle cx="226" cy="212" r="11" fill="#0f1419"/><circle cx="286" cy="212" r="11" fill="#0f1419"/><circle cx="256" cy="262" r="11" fill="#0f1419"/>
  <path d="M96 ${pad ? 416 : 430} q80 -40 160 0 t160 0" stroke="#4fc3c9" stroke-width="14" fill="none" stroke-linecap="round"/>
</svg>`;

(async () => {
  await sharp(Buffer.from(svg(false))).resize(192, 192).png().toFile(path.join(OUT, "icon-192.png"));
  await sharp(Buffer.from(svg(false))).resize(512, 512).png().toFile(path.join(OUT, "icon-512.png"));
  await sharp(Buffer.from(svg(true))).resize(512, 512).png().toFile(path.join(OUT, "maskable-512.png"));
  console.log("icons ok");
})();
