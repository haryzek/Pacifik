# Rychlé mapování — R8a: Santa Barbara County & Santa Ynez (Point Sal → Ventura, inland ≤ 120 km)

You are helping curate places for ONE traveler's offline road-trip app. This is a QUICK GAP SCAN, not deep research — use what you know plus a fast web check; do not verify hours or prices (that is done separately). Goal: **find good places we are MISSING.**

## The traveler (short)
Czech man, 54, psychotherapist, solo road trip Seattle → San Diego, Sept 16 – Oct 9 2026, midsize sedan (no 4x4), cheap motels, 200–400 km/day. Loves: deserts, canyons, rock formations, big empty space; ocean cliffs, sea stacks, wild empty beaches, lighthouses, fog, wind; redwoods & pines; mountain lakes and rivers to SWIM in (cold-water swimmer, 4–16 °C is fine, swims nude when alone); waterfalls; golden oak savanna with lichen; volcanic landscapes; observatories and dark skies; Edward Hopper (neon motels, diners, gas stations at dusk); Twin Peaks; Cormac McCarthy; Steinbeck; Henry Miller; 60s–70s psychedelic rock, soul, blues (live venues, record stores); independent bookstores; authentic roadside Americana, ghost towns, outsider art, oddities; serious film locations (Kubrick, Lynch, Villeneuve, Antonioni). Food: simple, one good meal a day — Lebanese/Arab, Indian, Asian, or a diner with soul. Hates: crowds, tourist traps, theme parks, luxury, wineries as wineries, shopping, guided tours.

## Region scope
Guadalupe Dunes, Lompoc, Jalama, Gaviota/Refugio/El Capitan, Santa Barbara (all), Figueroa Mountain oak savanna, Santa Ynez Valley, Los Padres (Camino Cielo, Santa Ynez River swims), Cachuma, Ojai, Ventura, Channel Islands (boat only? evaluate), Carpinteria, Rincon

## What we ALREADY HAVE in this region (do NOT repeat these or obvious variants of them)
- Boo Boo Records
- Cachuma Lake
- Carpinteria Bluffs Nature Preserve
- Cold Spring Tavern
- Douglas Family Preserve
- Figueroa Mountain Road — dubová savana
- Gaviota Peak
- Guadalupe-Nipomo Dunes Center — Lost City of DeMille
- Hendry's Beach (Arroyo Burro Beach)
- Knapp's Castle
- La Purísima Mission
- Lobero Theatre
- Los Olivos
- Nojoqui Falls Park
- Oso Flaco Lake
- Painted Cave State Historic Park
- Point Sal State Beach
- Rancho Guadalupe Dunes Preserve
- Red Rock — Santa Ynez River (koupání)
- Refugio State Beach
- Santa Barbara County Courthouse
- Shoreline Park (Santa Barbara)
- Stearns Wharf & Funk Zone (Santa Barbara)

## What to return
20–40 places we are missing. Prioritize: (1) swimming spots (rivers, lakes, coves) with honest access; (2) viewpoints / geology / empty beaches off the main road; (3) motels with real neon or mid-century soul, diners and bars with character, live blues/soul/rock venues, record stores, indie bookstores; (4) oddities, ghost towns, outsider art, film locations; (5) scenic back roads. Skip anything merely "nice". Ask of every place: "Would he leave the highway for this?"

Coordinates must be real (Wikipedia / OpenStreetMap / official site) — the app navigates by them; use the trailhead/parking/viewpoint/swim access point.

Return ONLY one JSON array in one code block, nothing before or after, UTF-8 (no \uXXXX escapes), valid JSON. One object per place, exactly these fields:

```json
[
  {
    "name": "Place name (English)",
    "lat": 41.1234,
    "lng": -124.1234,
    "category": "coast | forest | desert | mountain | lake_river | waterfall | geology | scenic_drive | town | motel_gem | food_gem | culture | oddity | dark_sky | hot_spring",
    "why": "One Czech sentence: what it is and why HE would stop (concrete, no adjectives-only fluff).",
    "swim": "no | ocean | river | lake | hot_spring",
    "url": "official or Wikipedia URL, or null"
  }
]
```

Region code for these entries: "R8a".
