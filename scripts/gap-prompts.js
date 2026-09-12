#!/usr/bin/env node
// Vygeneruje prompts/gaps/<region>.md — "rychlé mapování" bez deep researche.
// Každý prompt obsahuje seznam míst, která už máme, aby je Karolínka nevypisovala.
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const places = JSON.parse(fs.readFileSync(path.join(ROOT, "data/places.json"), "utf8"));
const OUT = path.join(ROOT, "prompts/gaps");
fs.mkdirSync(OUT, { recursive: true });

const REGIONS = {
  R1: { title: "Olympic Peninsula, Puget Sound, North Cascades & Seattle (WA)", scope: "Seattle city (record stores, live blues/soul venues, diners, bookstores, Hopper-esque motels), North Bend/Snoqualmie (Twin Peaks), Olympic NP (Hoh, Sol Duc, Hurricane Ridge, Rialto, Ruby Beach, Lake Crescent, Quinault), Cape Flattery/Neah Bay, Port Townsend, Whidbey/Deception Pass, North Cascades Hwy (Diablo, Washington Pass), Mt. Rainier as optional, Long Beach peninsula, Columbia mouth (Cape Disappointment)" },
  R2: { title: "Columbia Gorge, Portland & North Oregon Coast", scope: "Astoria, Cannon Beach/Ecola, Manzanita/Neahkahnie, Three Capes (Meares, Lookout, Kiwanda), Tillamook, Lincoln City to Newport (Yaquina Head, Devil's Punchbowl), Columbia Gorge (Vista House, waterfalls, Hood River, Rowena), Mt. Hood loop (Trillium, Timberline — The Shining exterior!), Portland (Powell's, Music Millennium, live music, food carts)" },
  R3: { title: "Central & South Oregon Coast (Newport → Brookings)", scope: "Cape Perpetua/Thor's Well, Heceta Head, Sea Lion Caves, Florence & Oregon Dunes, Umpqua lighthouse, Coos Bay/Shore Acres/Cape Arago, Bandon (Face Rock), Cape Blanco, Port Orford, Humbug Mtn, Prehistoric Gardens, Rogue River mouth/Gold Beach, Samuel H. Boardman corridor (Natural Bridges, Secret Beach, Arch Rock), Brookings/Harris Beach, coastal lakes for swimming (Cleawox, Woahink, Tenmile, Floras)" },
  R4: { title: "South Oregon inland: Umpqua, Rogue, Crater Lake, Bend/Smith Rock, Lava Beds", scope: "Umpqua Hot Springs & waterfalls (Toketee, Watson), Crater Lake (rim, Cleetwood Cove swim, Pinnacles, Watchman), Rogue Gorge/Natural Bridge (NO swimming), Rogue River swimming holes (Union Creek, Illinois River), Oregon Caves, Ashland, Jacksonville, Bend/Smith Rock/Painted Hills, Lava Beds NM & Tule Lake, Klamath, Newberry crater (Paulina Lake, obsidian flow), hot springs (Summer Lake, Crystal Crane if reachable)" },
  R5: { title: "Redwoods & Lost Coast (Crescent City → Leggett, incl. Trinity/Shasta side)", scope: "Jedediah Smith (Stout Grove, Howland Hill Rd, Smith River swimming), Del Norte, Prairie Creek (Fern Canyon, Gold Bluffs), Trinidad/Patrick's Point, Arcata/Eureka (Old Town, bookstores, live music), Ferndale, Lost Coast (Mattole Rd, Black Sands Beach, Shelter Cove), Avenue of the Giants, Eel River swimming holes, Trinity River/Weaverville, Mt. Shasta/Castle Crags/McCloud Falls, Lassen if ≤ 500 km" },
  R6: { title: "Mendocino → Sonoma → Marin (Leggett → Golden Gate)", scope: "Fort Bragg (Glass Beach, Skunk Train), Mendocino, Anderson Valley/Navarro (Hendy Woods, Navarro River swim), Point Arena, Sea Ranch, Salt Point, Fort Ross, Jenner/Russian River (swimming holes: Johnson's Beach, Steelhead, Monte Rio), Bodega Bay (The Birds), Tomales Bay/Point Reyes (all), Bolinas, Mt. Tam, Muir Woods/Beach, Marin Headlands, Sausalito, Clear Lake side if ≤ 200 km" },
  R7: { title: "San Francisco, Peninsula, Santa Cruz, Monterey, Big Sur → San Luis Obispo", scope: "SF (record stores, live blues/soul/rock, bookstores, Sutro, Fort Point, Twin Peaks, Mission murals, dive bars, diners), Pacifica/Devil's Slide, Pescadero/Pigeon Point/Año Nuevo, Santa Cruz, Monterey/Pacific Grove/Carmel (Tor House!), Point Lobos, Big Sur all (Bixby, Pfeiffer, McWay, Nepenthe, Henry Miller, Esalen, Limekiln, Sand Dollar, Ragged Point), San Simeon/Cambria, Morro Bay, SLO (Madonna Inn!), Salinas (Steinbeck), Pinnacles, Carrizo Plain, Paso Robles oak country, Pismo" },
  R8a: { title: "Santa Barbara County & Santa Ynez (Point Sal → Ventura, inland ≤ 120 km)", scope: "Guadalupe Dunes, Lompoc, Jalama, Gaviota/Refugio/El Capitan, Santa Barbara (all), Figueroa Mountain oak savanna, Santa Ynez Valley, Los Padres (Camino Cielo, Santa Ynez River swims), Cachuma, Ojai, Ventura, Channel Islands (boat only? evaluate), Carpinteria, Rincon" },
  R8: { title: "Los Angeles & Orange County (Ventura → San Clemente)", scope: "Malibu (all beaches, Point Dume, El Matador, Zuma, Topanga, Solstice, Malibu Creek), LA (Griffith, Getty, Getty Villa, Last Bookstore, Amoeba, Troubadour, Whisky, Hollywood Forever, Bradbury, Union Station, Museum of Jurassic Technology, Watts Towers, Echo Park, Silver Lake, Venice canals, Santa Monica pier, Laurel Canyon music history (Canyon Country Store), Mulholland, Vasquez Rocks, diners like Norms/Canter's/Pann's, dive bars, record stores), Long Beach, Palos Verdes (Wayfarers Chapel, Abalone Cove), Crystal Cove, Laguna, San Clemente" },
  R8b: { title: "San Diego County (San Clemente → Mexican border, inland ≤ 150 km)", scope: "San Onofre/Trestles, Oceanside, Encinitas/Swami's, Torrey Pines, La Jolla (Cove, Shores, Black's, Sunny Jim), Salk Institute, Pacific Beach/Crystal Pier, Ocean Beach, Sunset Cliffs, Point Loma/Cabrillo, Coronado/Silver Strand, Balboa Park, Chicano Park, Barrio Logan, North Park, live music (Casbah, Belly Up, Soda Bar), Convoy/El Cajon food, Julian, Cuyamaca, Mt. Laguna, Palomar, Border Field" },
  R9: { title: "SoCal Deserts: Joshua Tree, Mojave, Route 66, Salton Sea, Anza-Borrego, Death Valley, Palm Springs (loops from LA/SD ≤ 500 km)", scope: "Joshua Tree NP (all), Pioneertown, Landers (Integratron, Giant Rock), 29 Palms, Yucca Valley, Mojave NP (Kelso, Cima, Lava Tube, Hole-in-the-Wall), Route 66 (Amboy, Ludlow, Bagdad Cafe, Goffs, Needles), Trona Pinnacles, Randsburg, Red Rock Canyon, Death Valley (all major), Rhyolite, Salton Sea (Bombay Beach, Salvation Mtn, Slab City, East Jesus, mud pots), Anza-Borrego (all), Palm Springs (mid-century, Indian Canyons, tram), Idyllwild, Big Bear" },
};

const HEAD = (r, c) => `# Rychlé mapování — ${r}: ${c.title}

You are helping curate places for ONE traveler's offline road-trip app. This is a QUICK GAP SCAN, not deep research — use what you know plus a fast web check; do not verify hours or prices (that is done separately). Goal: **find good places we are MISSING.**

## The traveler (short)
Czech man, 54, psychotherapist, solo road trip Seattle → San Diego, Sept 16 – Oct 9 2026, midsize sedan (no 4x4), cheap motels, 200–400 km/day. Loves: deserts, canyons, rock formations, big empty space; ocean cliffs, sea stacks, wild empty beaches, lighthouses, fog, wind; redwoods & pines; mountain lakes and rivers to SWIM in (cold-water swimmer, 4–16 °C is fine, swims nude when alone); waterfalls; golden oak savanna with lichen; volcanic landscapes; observatories and dark skies; Edward Hopper (neon motels, diners, gas stations at dusk); Twin Peaks; Cormac McCarthy; Steinbeck; Henry Miller; 60s–70s psychedelic rock, soul, blues (live venues, record stores); independent bookstores; authentic roadside Americana, ghost towns, outsider art, oddities; serious film locations (Kubrick, Lynch, Villeneuve, Antonioni). Food: simple, one good meal a day — Lebanese/Arab, Indian, Asian, or a diner with soul. Hates: crowds, tourist traps, theme parks, luxury, wineries as wineries, shopping, guided tours.

## Region scope
${c.scope}

## What we ALREADY HAVE in this region (do NOT repeat these or obvious variants of them)
`;

const TAIL = (r) => `
## What to return
20–40 places we are missing. Prioritize: (1) swimming spots (rivers, lakes, coves) with honest access; (2) viewpoints / geology / empty beaches off the main road; (3) motels with real neon or mid-century soul, diners and bars with character, live blues/soul/rock venues, record stores, indie bookstores; (4) oddities, ghost towns, outsider art, film locations; (5) scenic back roads. Skip anything merely "nice". Ask of every place: "Would he leave the highway for this?"

Coordinates must be real (Wikipedia / OpenStreetMap / official site) — the app navigates by them; use the trailhead/parking/viewpoint/swim access point.

Return ONLY one JSON array in one code block, nothing before or after, UTF-8 (no \\uXXXX escapes), valid JSON. One object per place, exactly these fields:

\`\`\`json
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
\`\`\`

Region code for these entries: "${r}".
`;

for (const [r, c] of Object.entries(REGIONS)) {
  const have = places.filter((p) => p.region === r || (p.aliases || []).some((a) => a.startsWith(r.toLowerCase() + "-")))
    .map((p) => p.name).sort((a, b) => a.localeCompare(b));
  // R9 zahrnuje i R9b, R8a je vlastní; bonus (gem) rozhodit podle lat/lng do regionu podle nejbližšího místa
  const gems = places.filter((p) => p.id.startsWith("gem-") && !have.includes(p.name));
  for (const g of gems) { const near = places.find((p) => p.region === r && Math.abs(p.lat - g.lat) < 0.5 && Math.abs(p.lng - g.lng) < 0.5); if (near) have.push(g.name); }
  const extraRegions = r === "R9" ? ["R9b"] : [];
  for (const er of extraRegions) for (const p of places.filter((p) => p.region === er)) have.push(p.name);
  const uniq = [...new Set(have)].sort((a, b) => a.localeCompare(b));
  const md = HEAD(r, c) + uniq.map((n) => `- ${n}`).join("\n") + "\n" + TAIL(r);
  fs.writeFileSync(path.join(OUT, `${r}.md`), md);
  console.log(`${r}: ${uniq.length} existing places -> prompts/gaps/${r}.md`);
}
