# Pacifik — technická dokumentace (živá)

Offline PWA pro Bobův road trip Seattle → San Diego (16. 9. – 10. 10. 2026). Zadání: `PACIFIK-SPEC.md`.
Live: **https://haryzek.github.io/Pacifik/** (GitHub Pages z `main`, žádný build step).

## Stav (2026-09-14, před odletem)
| Část | Stav |
|---|---|
| Páteř (`data/spine.json` → merge → `spine-out.json`) | ✅ 21 dní, 130 MUST, p.spine {day,km,must}; Plán → 🧭 Páteř, mapa dne A→B, chip 🧭 dnes |
| Trasy po silnicích (`scripts/route-geom.js`, OSRM) | ✅ `data/route-geom.json`; `ferries: [i]` = úsek i→i+1 rovně; km/h z OSRM |
| Data merge (`scripts/merge.js`) | ✅ 833 POI (550 research + 282 rychlé mapování + extra), 41 odboček (20 research + 21 vlastních v `data/loops-extra.json`), koridor 15 km → `near_ids`, vnitrozemí pokryto 268/274 |
| Kolem mě + filtry + dosah (30/100/300/500/vše S→J) + hledání + 🎲 | ✅ |
| Detail (fotka, koupání, 2026, Naviguj, plán, navštíveno, poznámka, 🚫 fotka) | ✅ |
| Poloha (GPS / poslední / simulovaná) + západ slunce (PT) | ✅ |
| Odbočky (41, „po cestě“ automaticky z koridoru, Naviguj celou smyčku, místo zná své odbočky, Plán → trasa) | ✅ |
| Mapa (Leaflet, noční OSM, markercluster přepínatelný, loopy, 📌 fix polohy, ovládání u palce) | ✅ online podklad, offline jen z cache |
| Mapa dne (číslované zastávky v pořadí jízdy, ostruhy, A/B, panel zastávek, ➕ do trasy) | ✅ 19. 9. 2026 |
| Ubytko do 50 km u každé destinace (🛏 ve výpisu i v detailu) | ✅ 19. 9. 2026, `data/ubytko.json` 177 lokalit |
| Poloha — zaseknutý FIX, zastaralá fixace, retry, re-arm po probuzení | ✅ opraveno 19. 9. 2026 |
| Plán / Deník (.md export) / Útrata (4 300 $, 21 Kč) / Záloha (JSON export-import) | ✅ |
| Papíry (lety, Sixt, ESTA, praktikum, vlastní poznámky) | ✅ |
| Fotky (`scripts/photos.js`) | ✅ 784/833, 17,5 MB, v SW cache; reject list |
| PWA (manifest, ikony, sw.js, instalace, „Offline připraveno ✓") | ✅ |
| Verify pass (uzávěry, permity, hodiny/ceny u 80 ⭐ podniků, mrtvé odkazy) | ✅ 12. 9. 2026 — „[ověřeno 12. 9. 2026]“ v season_note; uzávěry v `data/alerts.json` (Papíry → 🚧) |
| Ruční kontrola fotek | ⏳ průběžně z cesty (🚫 v detailu → Záloha → id) |

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
data/alerts.json      uzávěry silnic (Papíry → 🚧), ručně; data/loops-extra.json = vlastní odbočky
data/ubytko.json      177 ubytovacích lokalit podél trasy (price $/$$/$$$, usd rozpětí, type, why); generátor scripts/beds.js
scripts/              merge.js, geo.js (páteř, koridor), loops-cover.js (pokrytí vnitrozemí), gaps-import.js, gaps-review.js, gap-prompts.js, photos.js, contact-sheet.js, verify-links.js, sw-build.js, icons.js
prompts/              prompty pro research; prompts/gaps/ = rychlé mapování
```

## Build (po každé změně dat)
```
node scripts/gaps-import.js   # jen když přibyly data/gaps/*.json
node scripts/merge.js         # -> data/places.json, loops.json (+ photo_local)
node scripts/photos.js        # idempotentní; --only id,id --force pro konkrétní; reject list se aplikuje sám
node scripts/route-geom.js    # jen když se změnily waypointy páteře/odboček (OSRM, ~1 min)
node scripts/sw-build.js      # PHOTOS + CACHE_V do sw.js
git add -A && git commit && git push
```
Fotky: kontrola `node scripts/contact-sheet.js --skip N` → `_screeny/contact.jpg`. Špatná fotka → id do `data/photo-reject.json` (`[]` = zkusit jinou, `"none"` = bez fotky) a znovu photos.js. Wikimedia limit: 2 workery, 200 ms, 429 → backoff; chyby se necachují.

## Data pipeline
`node scripts/merge.js` → načte raw (opraví rozbité JSONy R6–R8: CRLF, `\xe1`, `\,`, neukončené stringy, próza za polem),
bonus ids → `gem-NNN`, aplikuje `fixes.json`, přidá `extra.json`, validuje, dedupe (Jaccard názvů ≥ 0.6 && < 1,5 km, nebo `_merge_pairs`),
`spineIndex` = 49.5 − lat, loops `stop_ids` (match názvu + do 60 km od waypointu). Vytiskne report.

**Jak změnit páteř (z motelu):** uprav den v `data/spine.json` (wp, must názvy, sleep, note) → `node scripts/route-geom.js && node scripts/merge.js && node scripts/sw-build.js` → push. Bob obnoví tahem dolů.

**Past:** po *každé* změně `index.html` (i jen CSS) spustit `node scripts/sw-build.js` — jinak zůstane starý `CACHE_V` a telefon nový index nechytí. A cokoli fixed u spodního okraje mapy (Leaflet `.leaflet-bottom`: měřítko, attribution) musí být posunuté nad nav lištu (`--sab` + 60 px), jinak je schované pod taby.

**Mapa dne a ubytko (19. 9. 2026).**
- `projectOn(pts, p)` promítne místo na silniční geometrii dne → postup v km po trase + odchylka od ní. `dayStops(d)` z toho staví zastávky (MUST + ručně přidané z `store.dayAdd[day]`), řadí podle postupu a nocleh (`motel_gem`) posouvá na konec. **Řadit podle `lat` nejde** — D3 jede na západ a zpátky, D17 zahýbá do Monterey.
- `bedFocus(id)` = režim ubytek: destinace ve středu, kruh 50 km, JEN ubytka v něm (`drawMarkers` se v tom režimu hned vrací, páteř i loopy se shodí). `dayFocus` a `bedFocus` se navzájem ruší; `#daybanX` zavírá ten aktivní. `#daylist` je společný spodní panel pro oba režimy.
- `data/ubytko.json` je **ruční obsah, ne build z jiných dat** — mění se editací `scripts/beds.js` a spuštěním `node scripts/beds.js`. Cenové hladiny jsou odhad z charakteru trhu pro konec září / začátek října 2026, appka to v panelu říká. Spine `sleep_opts` v `data/spine.json` drží navíc den-specifické „proč to navazuje na ráno" a zůstává oddělené.
- Pokrytí: 829 z 833 destinací má ubytko do 50 km; 4 zbylé (Ubehebe Crater, Carrizo Plain, Hole-in-the-Wall, Mitchell Caverns) dostanou hlášku „tady je pustina" s nejbližšími třemi.
- **Past:** nové JSONy patří i do `DATA` v `sw.js`, jinak offline nejsou.

**Poloha — co bylo špatně (19. 9. 2026).** `startGPS()` při nastaveném `store.sim` watch vůbec nezaložil, takže jeden tap na 📌 zamkl appku na ruční fix natrvalo. `fallbackPos()` se navíc vždy vracel, když `posMode==='gps'`, takže výpadek GPS za jízdy nikdo nepoznal. Teď: `S.posT` + `posStale()` (2 min) → badge `GPS?`, `retryGPS()` s backoffem 20 s → 5 min, `visibilitychange` obnoví watch, `useGPS()` je jediná cesta z fixu a startovní toast na fix upozorní.

**Jak přidat odbočku:** objekt do `data/loops-extra.json` (waypoints = souřadnice po silnici, stačí každých 20–40 km) → merge spočítá `near_ids` (místa do 15 km od trasy). `node scripts/loops-cover.js` ukáže nepokryté vnitrozemí.

**Jak přidat / opravit místo:** nový → `data/extra.json`; oprava existujícího → `data/fixes.json` pod jeho id (přepíše jen uvedená pole). Pak merge + commit.

**Známé vlastnosti raw dat:** research (ChatGPT deep research) kolabuje kolem 20–35 záznamů — R6–R9b jsou kratší a texty ke konci horší (přepsáno ve fixes). Různým místům v jednom parku dává stejné souřadnice → dedupe jde podle názvu. `photo` URL u 143 míst neověřené.

## Appka
- Stav v `S`, úložiště `localStorage['pacifik.v1']` = `{plan[], visited{id:date}, notes{id}, lastPos, sim, range}`.
- Poloha: `watchPosition` → při chybě poslední známá → jinak Seattle sim. Tap na GPS v hlavičce = ruční/simulovaná poloha (25 měst po trase nebo `lat, lng`).
- Filtry jsou OR; 💧 = kategorie lake_river/waterfall/hot_spring NEBO `swim.possible && legal ∈ {allowed, tolerated}`.
- Jízda: km/70 km/h, ne-asfalt ×1.6. „Jen dál po trase" = lat < moje lat + 0.05.
- Fotky: `p.photo_local` (nastaví photos.js) → `photos/{id}.jpg`, jinak gradient dle kategorie.
- Kontrola po změně: `node -e "new Function(src)"` na obsah `<script>`, párování `<div>`.

## Testy (headless)
`npm i --no-save jsdom`, pak `node _scratch/test_gps.js` (26 kontrol polohy), `test_ui.js` (17 — render tabů, karta dne, panel zastávek), `test_bed.js` (22 — ubytko; má vlastní Leaflet stub, který si pamatuje, co se přidalo na mapu). Bar: nula FAIL, `window errors: none`. `_scratch/` je mimo git.

**Past:** `S` je lexikální `const`, ne property `window` → na stav se v jsdom sahá přes `window.eval('S.posMode')`, ne `window.S`. A `pkill -f test_x.js` sestřelí i vlastní shell, protože se matchne na svůj příkazový řádek.

## Lokální běh
`npx serve -l 8765 .` (nebo `.claude/launch.json` → preview „pacifik").

## Pro Boba — instalace a provoz
1. Chrome na mobilu → https://haryzek.github.io/Pacifik/ → **⬇ Instalovat appku** (nebo menu ⋮ → Přidat na plochu / Instalovat).
2. Otevři z plochy **online** a počkej na toast **„Offline připraveno ✓"** (stahuje ~18 MB fotek, 1–3 min na wifi).
3. Test: letadlový režim → Kolem mě, detail s fotkou, Odbočky, Papíry musí jet. Mapa offline = jen tečky + kusy podkladu z paměti.
4. Nová verze: appka ji zkontroluje při každém otevření → toast „Nová verze — tapni". Ručně: GPS/FIX vpravo nahoře → 🔄. Když se to zasekne, otevři adresu v normálním Chromu a obnov (sdílí cache).
5. **Každý večer Plán → 💾 Záloha → Export JSON** a pošli si ho mailem. Chrome „Vymazat data" smaže plán, deník i útratu.
6. Špatná fotka → v detailu 🚫 → seznam id v Záloze → pošli Kokosákovi.
7. Chybí místo / je zavřené / cokoli → napiš, doplním z motelu; po pushi ti stačí obnovit.
8. Poloha: GPS je default. 📌 Jsem tu (detail) nebo 📌 na mapě = FIX. Zpět na GPS: GPS/FIX → 📡 Použít GPS.

Doplnit před odletem: ČSOB asistenční linka (Papíry → poznámky).
