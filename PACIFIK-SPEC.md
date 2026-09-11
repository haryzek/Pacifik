# PACIFIK — zadání pro Claude Code (spec pro sebe sama)

> Kontext: Bob (kokosák, oslík) jede 16. 9. – 10. 10. 2026 sólo road trip Seattle → LA → San Diego, Nissan Sentra, jeden batoh, motely. Nechce mít cestu nastudovanou — chce **parknout na odpočívadle, vytáhnout mobil a vidět, co je kolem něj za krásu, kam by mohla vést odbočka.** Appka je nástroj pro anarchii, ne pro plán. Data jsou hotová (deep research, kurátorovaná na jeho profil). Odlet je za 5 dní → priorita: **funkční jádro v mobilu do 14. 9.**, ladit lze i z motelu (GitHub Pages = live update na refresh).

## 0. Způsob práce (Bobův standard)
- Cloud Claude Code, repo **Haryzek/Pacifik** (GitHub Pages z `main`). Commituju a merguju sám, malé změny bez review.
- Telegraficky, jedna otázka najednou, zbytek rozhodnout samostatně. Proaktivně hlásit edge-cases a rizika.
- **Žádný build step.** Vanilla HTML/CSS/JS. `index.html` jako hlavní soubor, data v `data/*.json`, fotky v `photos/`. Single-file logiku držet, dokud to jde; rozdělit až když je to nutné (a říct proč).
- Po každé změně: syntaxe JS přes `node -e "new Function(src)"`, kontrola párování tagů, `git diff --stat` před commitem.
- `PACIFIK-README.md` v rootu = živá technická dokumentace, aktualizovat na konci každé session.
- Osobní soubory (screenshoty, poznámky) v `_screeny/` apod.
- Bobův design systém (Habity): warm dark "coconut" `--accent:#D9A441`, Georgia serif obsah, system-ui UI, ui-monospace metadata, hustota nad whitespace, animace jen transform/opacity .12–.25s. **Pro Pacifik twist: Hopper** — tmavší modročerné pozadí (noc u motelu), teplý neon akcent (coconut zlatá) + jedna studená (pacifická tyrkys) pro vodu/koupání. Zatím návrh; Bob vizuál ještě finálně neposvětil → ukázat mu první screen a zeptat se jednou.

## 1. Vstupní data (v repu `data/raw/`)
- `R1.json` … `R9.json` — místa (POI), schéma níže, ~40–80 na region (R1 = 58).
- `loops.json` — 20 odboček jako trasy s waypoints.
- `bonus.json` — 40 "perel" (motely, dinery, bary, knihkupectví); **ids kolidují s R1 (`r1-001…`) → přečíslovat na `gem-001…`, region ponechat informativně.**
- `photo` je všude `null` → fotky řeší pipeline (§5).
- Regiony a jejich rozsah: R1 Olympic/Puget, R2 Columbia & N Oregon, R3 Central & S Oregon coast, R4 S Oregon inland (Umpqua/Rogue/Crater), R5 Redwoods & Lost Coast, R6 Mendocino–Sonoma–Marin, R7 SF–Big Sur–SLO, R8 Central Coast→LA→San Diego, R9 SoCal pouště.

### Schéma POI (co přichází z researche)
```
id, region, name, category, subcategory, lat, lng, nearest_town, distance_from_spine_km,
description (cz), why_bob (cz), time_needed, effort{type,distance_km,elevation_m,difficulty},
swim{possible,water,temp_c_sept_oct,legal,solitude,safety}, road_access, best_time,
season_note_2026, fee, links{maps,official,wiki}, photo{url,credit,license}|null, tags[], rank(1–3)
```
`category` ∈ coast | forest | desert | mountain | lake_river | waterfall | geology | scenic_drive | town | motel_gem | food_gem | culture | oddity | dark_sky | hot_spring
`road_access` ∈ paved | gravel_ok_sedan | rough_caution | ford | 4x4_only (4x4_only nikdy nezobrazovat jako doporučení)

### Schéma LOOP
```
id, name, from_spine, rejoin_spine, total_km, driving_hours, days, road_quality,
waypoints[{name,lat,lng}], stops[], story (cz), why_bob, overnight, season_note_2026, rank (=pořadí 1–20)
```

## 2. Build pipeline (`scripts/`, Node, spouštím já)
1. **`merge.js`** → `data/places.json` + `data/loops.json`:
   - sloučit R1–R9 + bonus; bonus ids → `gem-NNN`; kontrola unikátnosti id; validace povinných polí; souřadnice v bboxu (lat 32–49.5, lng -125…-114) jinak warning; `rank` do 1–3 (u loops nechat pořadí); trim textů.
   - vypočítat `spineIndex` (pozice podél páteře S→J, ≈ podle lat s korekcí — použít lat jako proxy, stačí) pro řazení "dál po trase".
   - vytisknout report: počty per region/category, kolik swim, kolik bez fotky.
2. **`photos.js`** (§5) → `photos/{id}.jpg` + doplní `photo` do `places.json`.
3. **`manifest`**: `manifest.webmanifest`, ikony (jednoduchá kokosová/oslí SVG → PNG 192/512), `sw.js`.
4. Výstup do rootu repa: `index.html`, `sw.js`, `manifest.webmanifest`, `data/`, `photos/`, `icons/`.

## 3. Aplikace — obrazovky (bottom tabs, mobile-first, funguje i na notebooku)

### 3.1 KOLEM MĚ (default)
- Získat GPS (`navigator.geolocation.watchPosition`, high accuracy, s fallbackem: pokud odmítne/nejde → ruční zadání "Kde jsem" výběrem z měst/waypointů nebo tap do mapy; poslední známá poloha v localStorage).
- Seznam POI seřazený podle **vzdálenosti** (haversine) s vypočítaným **směrem** (šipka/azimut) a hrubým časem jízdy (km/70 km/h, u gravel ×1.6).
- **Dosah** (chip): 30 / 100 / 300 / 500 km. Default 100.
- **Filtry** (chipy, multi): 🌊 Pobřeží, 🌲 Les, 🏜 Poušť/skály, 🏔 Hory, 💧 Koupání, 🛣 Silnice, 🏘 Města, 🛏 Motel, 🍽 Žrádlo, 🎸 Kultura, 👁 Oddity, 🌌 Noc. Plus přepínač **⭐ jen rank 1**.
- **Směr po trase**: přepínač "všechno / jen na jih ode mě (dál po trase)" — aby mu appka nenabízela věci 200 km zpátky.
- Každá položka: fotka thumbnail (nebo barevný placeholder kategorie), název, vzdálenost + směr, kategorie, rank ⭐, `why_bob` na jeden řádek, ikonky (💧 koupání, 🚗 gravel, ⚠ ford, $ fee).
- Rychlé akce nahoře: **⛽ Pumpa · 🛏 Motel · 🍽 Jídlo · 🏪 Obchod** → otevřou Google Maps search kolem aktuální polohy (`https://www.google.com/maps/search/gas+station/@lat,lng,13z`) — tohle záměrně NEkurátorujeme.

### 3.2 DETAIL MÍSTA (sheet/overlay)
- Fotka (větší), název, `nearest_town`, region, vzdálenost/směr/čas.
- `why_bob` výrazně (serif, kurzíva) → `description`.
- Meta řádky: čas na místě, effort (typ, km, převýšení, obtížnost), road_access s varováním pro `ford`/`rough_caution`, fee, best_time, **season_note_2026** (žlutý box).
- **Koupání** blok, když `swim.possible`: voda, teplota, legalita (allowed/tolerated/prohibited), samota, bezpečnost (červeně).
- Tlačítka: **Naviguj** (links.maps; když existuje `geo:` podpora, nabídnout i Apple/Google app), **Web** (official), **Wiki**, **➕ Do plánu**, **✓ Byl jsem tu** (log s datem), **📝 Poznámka**.
- Tags jako malé chipy.

### 3.3 ODBOČKY (loops)
- Seznam loopů seřazený podle vzdálenosti startu (`waypoints[0]`) od GPS, pak podle rank.
- Karta: název, km, hodiny, dny, road_quality (barevně), `why_bob`, rank.
- Detail: `story`, waypoints jako pořadí zastávek, `stops` propojené na POI (match podle názvu, case-insensitive; když match, kliknutelné), **Naviguj celou smyčku** = Google Maps directions URL s waypoints (`https://www.google.com/maps/dir/?api=1&origin=…&destination=…&waypoints=lat,lng|lat,lng` — max ~9 waypoints, jinak vzít prvních 9), season_note_2026.

### 3.4 MAPA
- Leaflet (CDN, cache v SW) + OSM dlaždice **online**; offline se dlaždice necachují (moc velké) → mapa ukazuje jen markery bez podkladu + text "offline: bez podkladové mapy". Markery barevně podle kategorie, cluster nad 200 bodů (leaflet.markercluster). Klik → detail. Tlačítko "kde jsem". Loops jako polyline při zapnutí.
- Fallback: když Leaflet nenačten (offline první start), skrýt tab a říct proč.

### 3.5 PLÁN & DENÍK
- **Plán**: seznam uložených POI (➕ Do plánu) seřazený podle spineIndex (S→J) — Bobova ručně poskládaná trasa; drag & drop není nutné, stačí posun ↑↓; odškrtnout hotové.
- **Deník**: den = karta (datum, kde spím, pár řádků textu, ✓ byl jsem tu automaticky přidané), jednoduchý editor (textarea), export do Markdown.
- **Útrata**: rychlé zadání (částka $, kategorie: nocleh/jídlo/benzín/vstupy/ostatní, poznámka) → součet per den a celkem, srovnání s rozpočtem (strop ~4 300 $ pozemní; ukázat "pod/nad plánem"). Kurz fixní 21 CZK, zobrazit obojí.
- Vše localStorage; **Export/Import JSON** (Bobova záchrana proti "Cookies and site data") + export deníku .md.

### 3.6 PAPÍRY (offline must)
- Statická karta z FINÁLNÍHO deníku: lety (Condor DE4410/DE2032 16. 9. 11:40→15:40, PNR XHHYY9; UA8900/UA9398 9. 10. 18:40→PRG 10. 10. 17:50, PNR N6J3J2), Sixt ID 9944431604 (SEA 17. 9. 9:00 → LAX 7. 10. 10:00, depozit $200), Expedia itinerary 73520795213002, AIG protection policy 1005999350 / itinerary 73520815879469, ESTA 2P0708W78P527J65, Motel 6 Sea-Tac 16. 9., Ocean Park Hotel 7.–9. 10., ČSOB asistenční linka (Bob doplní), Sixt tel. 0018887498227, Kiwi CZ +420 228 880 071, 911.
- **Praktikum** (zkrácené z deníku): mantra "No, thank you, I have my own coverage."; tankovací pravidlo (pod půlku = tankuj; plná: Forks, Grants Pass, Fort Bragg, Brookings); Golden Gate mýto online; sneaker waves; v autě nic viditelného; klíšťata Tomales; spropitné 18–20 % u stolu / 0 na stojáka; ZIP 99999 na pumpě.
- Odpočet: dny do odletu → na cestě "den N z 24" → dny do návratu.

## 4. Offline strategie
- `sw.js`: precache `index.html`, `data/places.json`, `data/loops.json`, `manifest`, ikony, Leaflet CSS/JS z CDN (cache-first), **všechny `photos/*.jpg`** (seznam vygenerovat do `sw.js` při buildu) — cílová velikost fotek < 60 MB (§5). Strategie: cache-first pro statiku, network-first s fallbackem pro `data/*.json` (aby update z motelu dorazil).
- Verze cache v konstantě `CACHE_V`; při změně dat bump + skipWaiting + clients.claim; v UI malý toast "Nová verze — obnovit".
- První spuštění musí být ONLINE (instalace na plochu z GitHub Pages). Do README napsat postup pro Boba: otevřít v Chrome na mobilu → menu → Přidat na plochu → otevřít jednou z plochy → počkat na "Offline připraveno ✓" (UI indikátor po dokončení precache).
- Google Maps deep-linky fungují jen online → v UI označit, že Naviguj potřebuje signál; offline ukázat souřadnice ke zkopírování.

## 5. Fotky (pipeline `scripts/photos.js`, Node 24, `sharp`)
Cíl: 1 fotka na POI, ~480 px na delší straně, JPEG q≈70, ≈40–80 kB → ~450 míst ≈ 25–35 MB. Loops: fotka prvního matchnutého POI ze `stops`.
1. Zdroj 1: `links.wiki` → Wikipedia REST `page/summary` → `originalimage.source` / `thumbnail.source`.
2. Zdroj 2: Wikipedia geosearch API (lat,lng, radius 2 km) → nejbližší článek → summary image.
3. Zdroj 3: Commons search API podle `name` (+ `nearest_town`) → první soubor typu bitmap, `imageinfo` → url + licence + autor.
4. Nic → `photo: null`, v UI placeholder (gradient dle kategorie + ikona). Vygenerovat `data/missing-photos.txt` pro ruční doplnění (Bob může přihodit vlastní fotky do `photos/manual/{id}.jpg`, pipeline je preferuje).
- Ukládat `credit` + `license` (zobrazit malým písmem v detailu — Commons licence to vyžadují).
- Rate-limit: 200 ms mezi requesty, User-Agent nastavit (Wikimedia to chce). Idempotentní: přeskočit existující soubory.
- Sanity: odmítnout obrázky < 200 px, SVG, mapy/loga (heuristika podle názvu souboru: `map`, `logo`, `seal`, `flag`).

## 6. Vzhled (návrh, potvrdit s Bobem jednou otázkou)
- Pozadí `#0f1419` (noční modročerná), karty `#171d24`, text `#e8e2d6` (teplá bílá), akcent coconut `#D9A441`, voda `#4fc3c9`, varování `#e0654a`, ok `#7bb661`.
- Typografie: nadpisy a `why_bob` Georgia serif; UI system-ui; metadata ui-monospace.
- Hustota: 2–3 položky na výšku obrazovky mobilu s thumbnailem 96 px. Žádné velké hero obrázky v seznamu.
- Bottom nav: Kolem mě · Odbočky · Mapa · Plán · Papíry. Header: vzdálenost dosahu + GPS stav (● zelená/šedá) + odpočet.
- Piňa-colada mikro-odměna 🍹 při "✓ Byl jsem tu" u rank 1 (Habity tradice, 1.5 s).

## 7. Edge cases (ošetřit od začátku)
- GPS odmítnuto / iOS Safari bez HTTPS (GitHub Pages je HTTPS → ok) / signál v lese (Olympic, Crater) → poslední známá poloha + ruční volba.
- Časové pásmo: vše lokálně dle zařízení; odpočet z data cesty (16. 9. → 10. 10.).
- Prázdný seznam při 30 km v poušti → automaticky nabídnout rozšíření dosahu.
- POI s `road_access: ford` → v seznamu ikona ⚠ a v detailu věta "koncem září mělké; rozhodni očima, jinak pěšky".
- `swim.legal == prohibited` → nezobrazovat jako koupání (💧 ikona jen pro allowed/tolerated).
- Velká data: 450 POI × render → virtualizace není nutná, ale renderovat max 100 položek + "zobrazit další".
- localStorage limit ~5 MB: deník text je malý; fotky nikdy do LS.
- Duplicity mezi bonus a regiony (např. Twede's je v R1 i bonus) → merge dedupe podle normalizovaného názvu + vzdálenost < 300 m; ponechat verzi s vyšším rank, sloučit tags.

## 8. Postup session (pořadí)
1. Repo init, struktura, `merge.js` + report (10 min) → commit.
2. `index.html` skeleton: nav, GPS, Kolem mě se seznamem + filtry + dosah, detail sheet (jádro) → commit → **Bob testuje na mobilu v Podolí** (GPS reálné, POI budou 8 000 km daleko → přidat "simulovaná poloha" v nastavení: dropdown měst na trase, default Seattle; hodí se i na test).
3. Odbočky + Papíry (statické) → commit.
4. `photos.js` běh (může trvat ~10 min) → commit fotky → SW precache → test offline (letadlový režim).
5. Plán/Deník/Útrata + export/import → commit.
6. Mapa (Leaflet) → commit.
7. README, ikony, manifest, jedna otázka na vizuál, doladění podle Bobovy zpětné vazby.
Cokoli po bodu 4 je "nice to have před odletem", zbytek lze dodělat z motelu.

## 9. Akceptační kritéria (než řeknu "hotovo")
- [ ] Na mobilu z plochy, v letadlovém režimu: otevře se, ukáže seznam podle simulované polohy, detail s fotkou, Odbočky, Papíry.
- [ ] Online: GPS funguje, Naviguj otevře Google Maps na správné souřadnice, mapa ukazuje markery.
- [ ] Filtry + dosah + "jen na jih" fungují a kombinují se.
- [ ] Žádný POI s `4x4_only`; `ford` má varování; prohibited koupání není nabízené jako koupání.
- [ ] Fotky ≥ 85 % POI; celková velikost `photos/` < 60 MB; licence zobrazená.
- [ ] Export/Import JSON deníku a plánu funguje round-trip.
- [ ] README s postupem instalace a údržby (jak přidat POI/fotku ručně, jak bumpnout cache).
