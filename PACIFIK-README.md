# Pacifik — technická dokumentace (živá)

Offline PWA pro Bobův road trip Seattle → San Diego (16. 9. – 10. 10. 2026). Zadání: `PACIFIK-SPEC.md`.
Live: **https://haryzek.github.io/Pacifik/** (GitHub Pages z `main`, žádný build step).

## Stav (2026-09-12, session 2)
| Část | Stav |
|---|---|
| Data merge (`scripts/merge.js`) | ✅ 832 POI (550 research + 282 rychlé mapování), 20 loops |
| Kolem mě + filtry + dosah (30/100/300/500/vše S→J) + hledání + 🎲 | ✅ |
| Detail (fotka, koupání, 2026, Naviguj, plán, navštíveno, poznámka, 🚫 fotka) | ✅ |
| Poloha (GPS / poslední / simulovaná) + západ slunce (PT) | ✅ |
| Odbočky (20 loopů, Naviguj celou smyčku) | ✅ |
| Mapa (Leaflet, noční OSM, markery dle kategorie, loopy) | ✅ online podklad, offline jen z cache |
| Plán / Deník (.md export) / Útrata (4 300 $, 21 Kč) / Záloha (JSON export-import) | ✅ |
| Papíry (lety, Sixt, ESTA, praktikum, vlastní poznámky) | ✅ |
| Fotky (`scripts/photos.js`) | ✅ 787/832, 17,6 MB, v SW cache |
| PWA (manifest, ikony, sw.js, instalace, „Offline připraveno ✓") | ✅ |
| Verify pass (hodiny/ceny 2026 u rank 1) | ⏳ |
| Ruční kontrola fotek (reject list) | ⏳ průběžně — ~10 % je mimo |

## Struktura
```
index.html            celá appka (vanilla, single file)
sw.js                 service worker (generuje seznam fotek + verzi: scripts/sw-build.js)
manifest.webmanifest, icons/
data/raw/*.json       deep research (R1–R9b, bonus, loops) — NEEDITOVAT
data/gaps/*.json      rychlé mapování (name, lat, lng, category, why, swim, url)
data/fixes.json       ruční přepisy podle id (+ _merge_pairs)
data/extra.json       ručně přidaná místa (added_by_claude)
data/gaps-import.json VÝSTUP gaps-import.js
data/places.json      VÝSTUP merge — appka čte tohle
data/loops.json       VÝSTUP merge
data/photos.json      credit/licence/zdroj fotek; data/photo-reject.json = zamítnuté; data/missing-photos.txt
photos/{id}.jpg       ~480 px JPEG; photos/manual/{id}.jpg = ruční (vyhrává)
scripts/              merge.js, gaps-import.js, gaps-review.js, gap-prompts.js, photos.js, contact-sheet.js, sw-build.js, icons.js
prompts/              prompty pro research; prompts/gaps/ = rychlé mapování
```

## Build (po každé změně dat)
```
node scripts/gaps-import.js   # jen když přibyly data/gaps/*.json
node scripts/merge.js         # -> data/places.json, loops.json (+ photo_local)
node scripts/photos.js        # idempotentní; --only id,id --force pro konkrétní; reject list se aplikuje sám
node scripts/sw-build.js      # PHOTOS + CACHE_V do sw.js
git add -A && git commit && git push
```
Fotky: kontrola `node scripts/contact-sheet.js --skip N` → `_screeny/contact.jpg`. Špatná fotka → id do `data/photo-reject.json` (`[]` = zkusit jinou, `"none"` = bez fotky) a znovu photos.js. Wikimedia limit: 2 workery, 200 ms, 429 → backoff; chyby se necachují.

## Data pipeline
`node scripts/merge.js` → načte raw (opraví rozbité JSONy R6–R8: CRLF, `\xe1`, `\,`, neukončené stringy, próza za polem),
bonus ids → `gem-NNN`, aplikuje `fixes.json`, přidá `extra.json`, validuje, dedupe (Jaccard názvů ≥ 0.6 && < 1,5 km, nebo `_merge_pairs`),
`spineIndex` = 49.5 − lat, loops `stop_ids` (match názvu + do 60 km od waypointu). Vytiskne report.

**Jak přidat / opravit místo:** nový → `data/extra.json`; oprava existujícího → `data/fixes.json` pod jeho id (přepíše jen uvedená pole). Pak merge + commit.

**Známé vlastnosti raw dat:** research (ChatGPT deep research) kolabuje kolem 20–35 záznamů — R6–R9b jsou kratší a texty ke konci horší (přepsáno ve fixes). Různým místům v jednom parku dává stejné souřadnice → dedupe jde podle názvu. `photo` URL u 143 míst neověřené.

## Appka
- Stav v `S`, úložiště `localStorage['pacifik.v1']` = `{plan[], visited{id:date}, notes{id}, lastPos, sim, range}`.
- Poloha: `watchPosition` → při chybě poslední známá → jinak Seattle sim. Tap na GPS v hlavičce = ruční/simulovaná poloha (25 měst po trase nebo `lat, lng`).
- Filtry jsou OR; 💧 = kategorie lake_river/waterfall/hot_spring NEBO `swim.possible && legal ∈ {allowed, tolerated}`.
- Jízda: km/70 km/h, ne-asfalt ×1.6. „Jen dál po trase" = lat < moje lat + 0.05.
- Fotky: `p.photo_local` (nastaví photos.js) → `photos/{id}.jpg`, jinak gradient dle kategorie.
- Kontrola po změně: `node -e "new Function(src)"` na obsah `<script>`, párování `<div>`.

## Lokální běh
`npx serve -l 8765 .` (nebo `.claude/launch.json` → preview „pacifik").

## Instalace na mobil (až bude sw.js)
Chrome → otevřít URL → menu → Přidat na plochu → otevřít z plochy ONLINE → počkat na „Offline připraveno ✓".
