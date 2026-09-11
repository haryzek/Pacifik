# Pacifik — technická dokumentace (živá)

Offline PWA pro Bobův road trip Seattle → San Diego (16. 9. – 10. 10. 2026). Zadání: `PACIFIK-SPEC.md`.
Live: **https://haryzek.github.io/Pacifik/** (GitHub Pages z `main`, žádný build step).

## Stav (2026-09-11, session 1)
| Část | Stav |
|---|---|
| Data merge (`scripts/merge.js`) | ✅ 550 POI, 20 loops |
| Kolem mě + filtry + dosah + detail | ✅ |
| Poloha (GPS / poslední / simulovaná) | ✅ |
| Plán / navštíveno / poznámky (localStorage) | ✅ základ v detailu, bez vlastní obrazovky |
| Odbočky, Mapa, Plán&Deník&Útrata, Papíry | ⏳ placeholder |
| Fotky (`scripts/photos.js`), `sw.js`, manifest, ikony | ⏳ |
| Verify pass (ověření hodin/cen 2026 u rank 1) | ⏳ |

## Struktura
```
index.html          celá appka (vanilla, single file)
data/raw/*.json     výstupy deep researche (R1–R9b, bonus, loops) — NEEDITOVAT ručně
data/fixes.json     ruční přepisy raw záznamů podle id (+ _merge_pairs)
data/extra.json     ručně přidaná místa (tag added_by_claude, "NEOVĚŘENO")
data/places.json    VÝSTUP merge — appka čte tohle
data/loops.json     VÝSTUP merge (loops + stop_ids)
scripts/merge.js    node scripts/merge.js
prompts/            prompty pro deep research
```

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
