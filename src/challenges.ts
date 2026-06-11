/**
 * Bolado — Authored challenge calendar, week 1 (challenges #1-#8).
 *
 * Challenge #1 = 2026-06-11. Each calendar day adds 1.
 * LEGAL: player names + factual data only. No likenesses or federation crests.
 * See spec §10 for legal posture.
 */

import type { DailyChallenge, NationPlayer } from "./types";
import { mexicoPool } from "./data/nations/mexico";
import { southAfricaPool } from "./data/nations/south-africa";
import { canadaPool } from "./data/nations/canada";
import { brazilPool } from "./data/nations/brazil";
import { moroccoPool } from "./data/nations/morocco";
import { netherlandsPool } from "./data/nations/netherlands";
import { japanPool } from "./data/nations/japan";
import { spainPool } from "./data/nations/spain";
import { francePool } from "./data/nations/france";
import { senegalPool } from "./data/nations/senegal";
import { argentinaPool } from "./data/nations/argentina";
import { colombiaPool } from "./data/nations/colombia";
import { wildcardsPool } from "./data/nations/wildcards";
import { challengeNumberForDate } from "./dailyId";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fromPool(pool: NationPlayer[], id: string): NationPlayer {
  const p = pool.find((x) => x.id === id);
  if (!p) throw new Error(`Player "${id}" not found in pool`);
  return p;
}

function wc(id: string): NationPlayer {
  const p = wildcardsPool.find((x) => x.id === id);
  if (!p) throw new Error(`Wildcard "${id}" not found`);
  return p;
}

const mx = (id: string) => fromPool(mexicoPool, id);
const za = (id: string) => fromPool(southAfricaPool, id);
const ca = (id: string) => fromPool(canadaPool, id);
const br = (id: string) => fromPool(brazilPool, id);
const ma = (id: string) => fromPool(moroccoPool, id);
const nl = (id: string) => fromPool(netherlandsPool, id);
const jp = (id: string) => fromPool(japanPool, id);
const es = (id: string) => fromPool(spainPool, id);
const fr = (id: string) => fromPool(francePool, id);
const sn = (id: string) => fromPool(senegalPool, id);
const ar = (id: string) => fromPool(argentinaPool, id);
const co = (id: string) => fromPool(colombiaPool, id);

// ---------------------------------------------------------------------------
// Challenge #1 — 2026-06-11 · México 🇲🇽 × África do Sul 🇿🇦
//
// Formation 4-3-3: GOL | LD ZAG ZAG LE | VOL MEI MEI | PD CA PE
// Pre-placed (6): Mexico defense spine + key attackers
//   LE=Arce, ZAG=Rafa Márquez, ZAG=Claudio Suárez, VOL=Torrado, MEI=Blanco, CA=Hugo Sánchez
// Open (5): GOL, LD, MEI(#2), PD, PE
// Condition: Azteca altitude — 70s-80s era legends +3
// ---------------------------------------------------------------------------
const challenge1: DailyChallenge = {
  id: 1,
  date: "2026-06-11",
  themeLabel: "Dia de México × África do Sul",
  flags: "🇲🇽×🇿🇦",
  prePlaced: [
    { slotId: "s-le",   position: "LE",  player: mx("mx-arce") },
    { slotId: "s-zag1", position: "ZAG", player: mx("mx-rafa-marquez") },
    { slotId: "s-zag2", position: "ZAG", player: mx("mx-claudio-suarez") },
    { slotId: "s-vol",  position: "VOL", player: mx("mx-torrado") },
    { slotId: "s-mei1", position: "MEI", player: mx("mx-blanco") },
    { slotId: "s-ca",   position: "CA",  player: mx("mx-hugo-sanchez") },
  ],
  openSlots: [
    { slotId: "s-gol",  position: "GOL" },
    { slotId: "s-ld",   position: "LD" },
    { slotId: "s-mei2", position: "MEI" },
    { slotId: "s-pd",   position: "PD" },
    { slotId: "s-pe",   position: "PE" },
  ],
  candidates: [
    // GOL (need ≥2 candidates for GOL slot)
    mx("mx-campos"),       // Jorge Campos GOL tier-4 (4⭐ — temptation, era icon but pricey)
    mx("mx-ochoa"),        // Ochoa GOL tier-2
    mx("mx-corona"),       // Jesús Corona GOL tier-1
    // GOL/LD candidates
    sn("sn-coly"),         // Ferdinand Coly LD tier-3 (covers LD!)
    mx("mx-lavolpe"),      // Ricardo La Volpe GOL tier-1 (70s-80s era bonus — budget GOL!)
    // MEI candidates
    mx("mx-morales"),      // Ramón Ramírez MEI/PE tier-3 (covers MEI and PE!)
    mx("mx-aguirre"),      // Javier Aguirre VOL/MEI tier-2
    za("za-tshabalala"),   // Tshabalala PE/MEI tier-3 (covers MEI and PE!)
    // PD candidates
    mx("mx-negro-de-la-torre"), // Luis García CA/PE tier-3 — positions CA/PE, covers PE slot not PD
    za("za-parker"),       // Sibusiso Zuma PD/CA tier-1 (covers PD!)
    // PE candidates
    mx("mx-dos-santos"),   // Giovani dos Santos PE/CA tier-2 (covers PE and CA)
    za("za-modise"),       // Modise PE/CA tier-3 (covers PE)
    // Extra quality / budget temptations
    wc("wc-charlton"),     // Bobby Charlton MEI tier-5 (5⭐ — covers MEI slot, era 50s-60s)
    za("za-pienaar"),      // Pienaar MEI/PE tier-4 (4⭐ — covers MEI and PE!)
    mx("mx-guardado"),     // Guardado MEI/LE tier-2 (covers MEI!)
  ],
  condition: {
    id: "altitud-azteca",
    label: {
      pt: "Altitude do Azteca: ídolos da era 70s-80s ganham +3",
      en: "Azteca Altitude: 70s-80s era legends get +3",
      es: "Altitud del Azteca: ídolos de los 70s-80s ganan +3",
    },
    appliesTo: (p) => p.eraBand === "70s-80s",
    bonus: 3,
  },
  benchmark: { name: "Seleção do Mundo", rating: 85 },
  budget: 12,
};

// ---------------------------------------------------------------------------
// Challenge #2 — 2026-06-12 · Canadá 🇨🇦 × Bósnia 🇧🇦
//
// Formation 4-3-3
// Pre-placed (6): Canada modern core (GK + modern attack)
//   GOL=Borjan, LE=Davies, PD=Buchanan, CA=Jonathan David, MEI=Eustáquio, VOL=Osorio
// Open (5): LD, ZAG(×2), VOL(#2), PE
// Condition: attack ≥ 80 bonus (host momentum)
// ---------------------------------------------------------------------------
const challenge2: DailyChallenge = {
  id: 2,
  date: "2026-06-12",
  themeLabel: "Dia de Canadá × Bósnia",
  flags: "🇨🇦×🇧🇦",
  prePlaced: [
    { slotId: "s-gol",  position: "GOL", player: ca("ca-borjan") },
    { slotId: "s-le",   position: "LE",  player: ca("ca-davies") },
    { slotId: "s-pd",   position: "PD",  player: ca("ca-buchanan") },
    { slotId: "s-ca",   position: "CA",  player: ca("ca-david") },
    { slotId: "s-mei",  position: "MEI", player: ca("ca-eustaquio") },
    { slotId: "s-vol1", position: "VOL", player: ca("ca-osorio") },
  ],
  openSlots: [
    { slotId: "s-ld",   position: "LD" },
    { slotId: "s-zag1", position: "ZAG" },
    { slotId: "s-zag2", position: "ZAG" },
    { slotId: "s-vol2", position: "VOL" },
    { slotId: "s-pe",   position: "PE" },
  ],
  candidates: [
    // LD candidates (need ≥1)
    ca("ca-corbo"),          // Alistair Johnston LD tier-1
    // ZAG candidates (need ≥2 — no ZAG in Canada pool, use other pools)
    nl("nl-frank-de-boer"),  // Frank de Boer ZAG/LD tier-1 (covers ZAG and LD!)
    nl("nl-blind"),          // Daley Blind ZAG/LE/VOL tier-1 (very versatile!)
    nl("nl-stam"),           // Jaap Stam ZAG tier-2 (reliable ZAG)
    wc("wc-baresi"),         // Baresi ZAG/VOL tier-4 (4⭐ Italian icon — temptation!)
    wc("wc-maldini"),        // Maldini LE/ZAG tier-5 (5⭐ also covers LE — huge temptation!)
    wc("wc-beckenbauer"),    // Beckenbauer ZAG/VOL tier-5 (5⭐ also covers VOL)
    // VOL candidates (need ≥1 more)
    ca("ca-hutchinson"),     // Hutchinson VOL tier-2
    ca("ca-ricketts"),       // Julian de Guzman MEI/VOL tier-1
    wc("wc-matthaeus"),      // Matthäus VOL/MEI tier-4 (4⭐ — also covers VOL/MEI)
    // PE candidates (need ≥1)
    wc("wc-bale"),           // Bale PE/PD/CA tier-4 (4⭐ — covers PE!)
    wc("wc-giggs"),          // Ryan Giggs PE/MEI tier-3 (covers PE and MEI-adjacent)
    wc("wc-blokhin"),        // Blokhin CA/PE tier-3 (covers PE)
    wc("wc-nedved"),         // Nedvěd MEI/PE tier-4 (covers PE and MEI — 4⭐)
    // Extra option
    wc("wc-larsson"),        // Henrik Larsson CA/PE tier-3 (covers PE!)
  ],
  condition: {
    id: "velocidade-hosts",
    label: {
      pt: "Anfitrião em campo: jogadores com ataque ≥ 80 ganham +2",
      en: "Host pitch: players with attack ≥ 80 get +2",
      es: "Anfitrión en cancha: jugadores con ataque ≥ 80 ganan +2",
    },
    appliesTo: (p) => p.attack >= 80,
    bonus: 2,
  },
  benchmark: { name: "Seleção do Mundo", rating: 84 },
  budget: 12,
};

// ---------------------------------------------------------------------------
// Challenge #3 — 2026-06-13 · Brasil 🇧🇷 × Marrocos 🇲🇦  ← THE audience day
//
// Formation 4-3-3
// Pre-placed (6): Brazil golden attack + midfield spine
//   LE=Roberto Carlos, MEI=Zico, MEI=Ronaldinho, CA=Ronaldo, PD=Garrincha, ZAG=Mauro
// Open (5): GOL, LD, ZAG(#2), VOL, PE
// Condition: jogo de rua — attack ≥ 90 gets +3
// ---------------------------------------------------------------------------
const challenge3: DailyChallenge = {
  id: 3,
  date: "2026-06-13",
  themeLabel: "Dia de Brasil × Marrocos",
  flags: "🇧🇷×🇲🇦",
  prePlaced: [
    { slotId: "s-le",   position: "LE",  player: br("br-roberto-carlos") },
    { slotId: "s-mei1", position: "MEI", player: br("br-zico") },
    { slotId: "s-mei2", position: "MEI", player: br("br-ronaldinho") },
    { slotId: "s-ca",   position: "CA",  player: br("br-ronaldo") },
    { slotId: "s-pd",   position: "PD",  player: br("br-garrincha") },
    { slotId: "s-zag1", position: "ZAG", player: br("br-mauro") },
  ],
  openSlots: [
    { slotId: "s-gol",  position: "GOL" },
    { slotId: "s-ld",   position: "LD" },
    { slotId: "s-zag2", position: "ZAG" },
    { slotId: "s-vol",  position: "VOL" },
    { slotId: "s-pe",   position: "PE" },
  ],
  candidates: [
    // GOL (need ≥2)
    br("br-taffarel"),       // Taffarel GOL tier-2
    br("br-gilmar"),         // Gilmar GOL tier-2 (50s-60s icon)
    br("br-rogerio-ceni"),   // Rogério Ceni GOL tier-1
    ma("ma-badou-zaki"),     // Badou Zaki GOL tier-3 (African Footballer of the Year 1986)
    // LD (need ≥1)
    br("br-cafu"),           // Cafu LD tier-3
    br("br-djalma-santos"),  // Djalma Santos LD tier-1
    ma("ma-hakimi"),         // Hakimi LD/PD tier-5 (5⭐ — covers LD! huge temptation)
    // ZAG (need ≥1 more for open slot)
    br("br-piazza"),         // Piazza VOL/ZAG tier-1 (covers ZAG and VOL!)
    ma("ma-benali"),         // Nayef Aguerd ZAG tier-2
    ma("ma-naybet"),         // Naybet ZAG/VOL tier-2 (covers ZAG and VOL!)
    wc("wc-maldini"),        // Maldini LE/ZAG tier-5 (5⭐ covers ZAG)
    // VOL (need ≥1)
    br("br-falcao"),         // Falcão MEI/VOL tier-4 (4⭐ — BIG temptation!)
    ma("ma-amrabat"),        // Amrabat VOL tier-3
    // PE (need ≥1)
    br("br-neymar"),         // Neymar PE/CA tier-4 (4⭐ — covers PE!)
    ma("ma-ait-zriouil"),    // El Hadrioui LE/PE tier-1 (budget PE option!)
  ],
  condition: {
    id: "jogo-de-rua",
    label: {
      pt: "Jogo de rua: atacantes com ataque ≥ 90 ganham +3",
      en: "Street game: players with attack ≥ 90 get +3",
      es: "Juego de calle: jugadores con ataque ≥ 90 ganan +3",
    },
    appliesTo: (p) => p.attack >= 90,
    bonus: 3,
  },
  benchmark: { name: "Seleção do Mundo", rating: 88 },
  budget: 12,
};

// ---------------------------------------------------------------------------
// Challenge #4 — 2026-06-14 · Holanda 🇳🇱 × Japão 🇯🇵
//
// Formation 4-3-3
// Pre-placed (6): Dutch Total Football icons
//   LD=Frank de Boer, LE=Van Bronckhorst, CA=Van Basten, PD=Robben, MEI=Cruyff, ZAG=Stam
// Open (5): GOL, ZAG(#2), VOL, MEI(#2), PE
// Condition: total football — attack+midfield ≥ 160 gets +2
// ---------------------------------------------------------------------------
const challenge4: DailyChallenge = {
  id: 4,
  date: "2026-06-14",
  themeLabel: "Dia de Holanda × Japão",
  flags: "🇳🇱×🇯🇵",
  prePlaced: [
    { slotId: "s-ld",   position: "LD",  player: nl("nl-frank-de-boer") },
    { slotId: "s-le",   position: "LE",  player: nl("nl-van-bronckhorst") },
    { slotId: "s-ca",   position: "CA",  player: nl("nl-van-basten") },
    { slotId: "s-pd",   position: "PD",  player: nl("nl-robben") },
    { slotId: "s-mei1", position: "MEI", player: nl("nl-cruyff") },
    { slotId: "s-zag1", position: "ZAG", player: nl("nl-stam") },
  ],
  openSlots: [
    { slotId: "s-gol",  position: "GOL" },
    { slotId: "s-zag2", position: "ZAG" },
    { slotId: "s-vol",  position: "VOL" },
    { slotId: "s-mei2", position: "MEI" },
    { slotId: "s-pe",   position: "PE" },
  ],
  candidates: [
    // GOL (need ≥2)
    nl("nl-van-der-sar"),    // Van der Sar GOL tier-3
    wc("wc-buffon"),         // Buffon GOL tier-4 (4⭐ temptation)
    wc("wc-yashin"),         // Lev Yashin GOL tier-5 (5⭐ iconic!)
    // ZAG (need ≥1)
    nl("nl-koeman"),         // Ronald Koeman ZAG/VOL tier-3 (also covers VOL)
    nl("nl-rijkaard"),       // Rijkaard VOL/ZAG tier-4 (4⭐ also covers VOL)
    jp("jp-hasebe"),         // Hasebe VOL/ZAG tier-3 (also covers VOL)
    jp("jp-nishino"),        // Yuichi Nishimura ZAG/LD tier-1
    nl("nl-blind"),          // Daley Blind ZAG/LE/VOL tier-1 (covers all three!)
    // VOL (need ≥1)
    nl("nl-davids"),         // Davids VOL/MEI tier-2 (also covers MEI)
    jp("jp-endo"),           // Wataru Endo VOL tier-3
    jp("jp-nakata"),         // Nakata MEI/VOL tier-5 (5⭐! covers VOL and MEI)
    // MEI (need ≥1)
    nl("nl-sneijder"),       // Sneijder MEI tier-4 (4⭐)
    nl("nl-bergkamp"),       // Bergkamp CA/MEI tier-3 (covers MEI)
    jp("jp-kagawa"),         // Kagawa MEI tier-4 (4⭐ Japanese legend)
    // PE (need ≥1)
    nl("nl-overmars"),       // Overmars PE/PD tier-1
  ],
  condition: {
    id: "futebol-total",
    label: {
      pt: "Futebol total: jogadores com ataque+meio-campo ≥ 160 ganham +2",
      en: "Total football: players with attack+midfield ≥ 160 get +2",
      es: "Fútbol total: jugadores con ataque+mediocampo ≥ 160 ganan +2",
    },
    appliesTo: (p) => p.attack + p.midfield >= 160,
    bonus: 2,
  },
  benchmark: { name: "Seleção do Mundo", rating: 86 },
  budget: 12,
};

// ---------------------------------------------------------------------------
// Challenge #5 — 2026-06-15 · Espanha 🇪🇸 × Cabo Verde 🇨🇻
//
// Formation 4-3-3 / tiki-taka shape
// Pre-placed (6): Spain golden generation midfield + spine
//   VOL=Xavi, MEI=Iniesta, VOL(#2)=Busquets, CA=Torres, PD=Pedro, ZAG=Puyol
// Open (5): GOL, LD, LE, ZAG(#2), PE
// Condition: tiki-taka era — 00s-10s or 10s-20s gets +2
// ---------------------------------------------------------------------------
const challenge5: DailyChallenge = {
  id: 5,
  date: "2026-06-15",
  themeLabel: "Dia de Espanha × Cabo Verde",
  flags: "🇪🇸×🇨🇻",
  prePlaced: [
    { slotId: "s-vol1", position: "VOL", player: es("es-xavi") },
    { slotId: "s-mei",  position: "MEI", player: es("es-iniesta") },
    { slotId: "s-vol2", position: "VOL", player: es("es-busquets") },
    { slotId: "s-ca",   position: "CA",  player: es("es-torres") },
    { slotId: "s-pd",   position: "PD",  player: es("es-pedro") },
    { slotId: "s-zag1", position: "ZAG", player: es("es-puyol") },
  ],
  openSlots: [
    { slotId: "s-gol",  position: "GOL" },
    { slotId: "s-ld",   position: "LD" },
    { slotId: "s-le",   position: "LE" },
    { slotId: "s-zag2", position: "ZAG" },
    { slotId: "s-pe",   position: "PE" },
  ],
  candidates: [
    // GOL (need ≥2)
    es("es-casillas"),       // Casillas GOL tier-3
    es("es-canizares"),      // Cañizares GOL tier-1
    wc("wc-buffon"),         // Buffon GOL tier-4 (4⭐ temptation)
    // LD (need ≥1)
    es("es-arbeloa"),        // Arbeloa LD tier-2
    fr("fr-sagnol"),         // Sagnol LD tier-1 (France pool — covers LD)
    fr("fr-thuram"),         // Thuram ZAG/LD tier-3 (covers LD and ZAG!)
    // LE (need ≥1)
    es("es-capdevila"),      // Capdevila LE tier-1
    wc("wc-maldini"),        // Maldini LE/ZAG tier-5 (5⭐ covers LE and ZAG!)
    fr("fr-lizarazu"),       // Lizarazu LE tier-2 (from France pool — wildcard usage)
    // ZAG (need ≥1)
    es("es-hierro"),         // Fernando Hierro ZAG/VOL tier-3
    es("es-albiol"),         // Albiol ZAG tier-2
    wc("wc-baresi"),         // Baresi ZAG/VOL tier-4 (4⭐)
    // PE (need ≥1)
    es("es-reyes"),          // Reyes PE/PD tier-1
    es("es-villa"),          // David Villa CA/PE tier-4 (4⭐ — covers PE!)
    wc("wc-giggs"),          // Giggs PE/MEI tier-3 (covers PE)
  ],
  condition: {
    id: "tiki-taka-era",
    label: {
      pt: "Era tiki-taka: jogadores da era 00s-10s ou 10s-20s ganham +2",
      en: "Tiki-taka era: 00s-10s and 10s-20s players get +2",
      es: "Era tiki-taka: jugadores de los 00s-10s y 10s-20s ganan +2",
    },
    appliesTo: (p) => p.eraBand === "00s-10s" || p.eraBand === "10s-20s",
    bonus: 2,
  },
  benchmark: { name: "Seleção do Mundo", rating: 87 },
  budget: 12,
};

// ---------------------------------------------------------------------------
// Challenge #6 — 2026-06-16 · França 🇫🇷 × Senegal 🇸🇳
//
// Formation 4-3-3
// Pre-placed (6): France '98 WC winners
//   LE=Lizarazu, LD=Thuram, MEI=Zidane, PE=Pirès, VOL=Vieira, ZAG=Desailly
// Open (5): GOL, ZAG(#2), VOL(#2), CA, PD
// Condition: aerial game — defense ≥ 80 gets +2
// ---------------------------------------------------------------------------
const challenge6: DailyChallenge = {
  id: 6,
  date: "2026-06-16",
  themeLabel: "Dia de França × Senegal",
  flags: "🇫🇷×🇸🇳",
  prePlaced: [
    { slotId: "s-le",   position: "LE",  player: fr("fr-lizarazu") },
    { slotId: "s-ld",   position: "LD",  player: fr("fr-thuram") },
    { slotId: "s-mei",  position: "MEI", player: fr("fr-zidane") },
    { slotId: "s-pe",   position: "PE",  player: fr("fr-pires") },
    { slotId: "s-vol1", position: "VOL", player: fr("fr-vieira") },
    { slotId: "s-zag1", position: "ZAG", player: fr("fr-desailly") },
  ],
  openSlots: [
    { slotId: "s-gol",  position: "GOL" },
    { slotId: "s-zag2", position: "ZAG" },
    { slotId: "s-vol2", position: "VOL" },
    { slotId: "s-ca",   position: "CA" },
    { slotId: "s-pd",   position: "PD" },
  ],
  candidates: [
    // GOL (need ≥2)
    fr("fr-barthez"),        // Barthez GOL tier-2
    wc("wc-yashin"),         // Lev Yashin GOL tier-5 (5⭐ — the greatest keeper, huge temptation!)
    // ZAG (need ≥1 more)
    fr("fr-blanc"),          // Laurent Blanc ZAG tier-2
    fr("fr-gallas"),         // Gallas ZAG/LD/LE tier-1
    sn("sn-boye"),           // Lamine Diatta ZAG tier-1
    // VOL (need ≥1 more)
    fr("fr-deschamps"),      // Deschamps VOL tier-2
    fr("fr-makelele"),       // Makelele VOL tier-1
    sn("sn-diallo"),         // Papa Bouba Diop VOL/MEI tier-3
    sn("sn-faye"),           // Aliou Cissé VOL tier-2
    // CA (need ≥1)
    sn("sn-mane"),           // Sadio Mané PE/CA tier-5 (5⭐ — covers CA! mega-temptation)
    fr("fr-henry"),          // Henry CA/PE tier-4 (4⭐ — iconic!)
    sn("sn-diouf"),          // El-Hadji Diouf CA/PD tier-4 (covers CA and PD!)
    fr("fr-trezeguet"),      // Trezeguet CA tier-2 (affordable CA option!)
    fr("fr-giroud"),         // Giroud CA tier-1 (budget CA pick)
    // PD (need ≥1) — extra PD:
    wc("wc-figo"),           // Figo PD/MEI tier-4 (covers PD!)
  ],
  condition: {
    id: "forca-aerea",
    label: {
      pt: "Força aérea: jogadores com defesa ≥ 80 ganham +2",
      en: "Aerial force: players with defense ≥ 80 get +2",
      es: "Fuerza aérea: jugadores con defensa ≥ 80 ganan +2",
    },
    appliesTo: (p) => p.defense >= 80,
    bonus: 2,
  },
  benchmark: { name: "Seleção do Mundo", rating: 86 },
  budget: 12,
};

// ---------------------------------------------------------------------------
// Challenge #7 — 2026-06-17 · Argentina 🇦🇷 × Argélia 🇩🇿
//
// Formation 4-3-3
// Pre-placed (6): Argentina Maradona era spine (without Maradona — he's in candidates!)
//   LE=Zanetti, ZAG=Passarella, ZAG(#2)=Ayala, VOL=Redondo, MEI=Riquelme, CA=Batistuta
// Open (5): GOL, LD, MEI(#2), PD, PE
// Condition: raízes sul-americanas — 70s-80s era +3
// ---------------------------------------------------------------------------
const challenge7: DailyChallenge = {
  id: 7,
  date: "2026-06-17",
  themeLabel: "Dia de Argentina × Argélia",
  flags: "🇦🇷×🇩🇿",
  prePlaced: [
    { slotId: "s-le",   position: "LE",  player: ar("ar-zanetti") },
    { slotId: "s-zag1", position: "ZAG", player: ar("ar-passarella") },
    { slotId: "s-zag2", position: "ZAG", player: ar("ar-ayala") },
    { slotId: "s-vol",  position: "VOL", player: ar("ar-redondo") },
    { slotId: "s-mei1", position: "MEI", player: ar("ar-riquelme") },
    { slotId: "s-ca",   position: "CA",  player: ar("ar-batistuta") },
  ],
  openSlots: [
    { slotId: "s-gol",  position: "GOL" },
    { slotId: "s-ld",   position: "LD" },
    { slotId: "s-mei2", position: "MEI" },
    { slotId: "s-pd",   position: "PD" },
    { slotId: "s-pe",   position: "PE" },
  ],
  candidates: [
    // GOL (need ≥2)
    ar("ar-fillol"),         // Fillol GOL tier-2
    ar("ar-goycochea"),      // Goycochea GOL tier-1
    wc("wc-buffon"),         // Buffon GOL tier-4 (4⭐ temptation)
    // LD (need ≥1)
    ar("ar-sensini"),        // Sensini ZAG/LD tier-1 (covers LD)
    nl("nl-frank-de-boer"),  // Frank de Boer ZAG/LD tier-1 (covers LD)
    // MEI (need ≥1)
    ar("ar-maradona"),       // Maradona MEI/CA tier-5 (5⭐ THE icon — also covers CA)
    ar("ar-ardiles"),        // Ardiles MEI/VOL tier-3
    ar("ar-burruchaga"),     // Burruchaga MEI tier-1
    ar("ar-veron"),          // Verón MEI tier-2
    // PD (need ≥1)
    ar("ar-caniggia"),       // Caniggia CA/PD tier-3 (covers PD)
    za("za-parker"),         // Sibusiso Zuma PD/CA tier-1 (cheap PD — enables Maradona picks!)
    wc("wc-figo"),           // Figo PD/MEI tier-4 (4⭐ covers PD and MEI!)
    // PE (need ≥1)
    wc("wc-bale"),           // Bale PE/PD/CA tier-4 (covers PE and PD!)
    wc("wc-giggs"),          // Giggs PE/MEI tier-3 (covers PE)
    ar("ar-ortega"),         // Ortega CA/MEI tier-2 (MEI coverage bonus, bait pick)
  ],
  condition: {
    id: "raizes-sul-americanas",
    label: {
      pt: "Raízes sul-americanas: jogadores da era 70s-80s ganham +3",
      en: "South American roots: 70s-80s era players get +3",
      es: "Raíces sudamericanas: jugadores de los 70s-80s ganan +3",
    },
    appliesTo: (p) => p.eraBand === "70s-80s",
    bonus: 3,
  },
  benchmark: { name: "Seleção do Mundo", rating: 87 },
  budget: 12,
};

// ---------------------------------------------------------------------------
// Challenge #8 — 2026-06-18 · Colômbia 🇨🇴 × Uzbequistão 🇺🇿
//
// Formation 4-3-3
// Pre-placed (6): Colombia golden spine — midfield and attack
//   VOL=Rincón, MEI=Valderrama, MEI(#2)=James, CA=Falcão García, PE=Asprilla, ZAG=Yerry Mina
// Open (5): GOL, LD, LE, ZAG(#2), PD
// Condition: magia crioula — midfield ≥ 85 gets +2
// ---------------------------------------------------------------------------
const challenge8: DailyChallenge = {
  id: 8,
  date: "2026-06-18",
  themeLabel: "Dia de Colômbia × Uzbequistão",
  flags: "🇨🇴×🇺🇿",
  prePlaced: [
    { slotId: "s-vol",  position: "VOL", player: co("co-rincon") },
    { slotId: "s-mei1", position: "MEI", player: co("co-valderrama") },
    { slotId: "s-mei2", position: "MEI", player: co("co-james") },
    { slotId: "s-ca",   position: "CA",  player: co("co-falcao") },
    { slotId: "s-pe",   position: "PE",  player: co("co-asprilla") },
    { slotId: "s-zag1", position: "ZAG", player: co("co-yerlan") },
  ],
  openSlots: [
    { slotId: "s-gol",  position: "GOL" },
    { slotId: "s-ld",   position: "LD" },
    { slotId: "s-le",   position: "LE" },
    { slotId: "s-zag2", position: "ZAG" },
    { slotId: "s-pd",   position: "PD" },
  ],
  candidates: [
    // GOL (need ≥2)
    co("co-higuita"),        // René Higuita GOL tier-3 (unique style!)
    co("co-ospina"),         // Ospina GOL tier-3
    wc("wc-buffon"),         // Buffon GOL tier-4 (4⭐ temptation)
    // LD (need ≥1)
    co("co-montoya"),        // Montoya LD tier-2
    co("co-moreno"),         // Harold Lozano LD/PE tier-1 — positions LD/PE, covers LD!
    // LE (need ≥1)
    wc("wc-maldini"),        // Maldini LE/ZAG tier-5 (5⭐ covers LE and ZAG — huge temptation!)
    fr("fr-lizarazu"),       // Lizarazu LE tier-2
    za("za-fortune"),        // Quinton Fortune LE/VOL tier-3 (affordable LE option!)
    // ZAG (need ≥1 more)
    co("co-garcia"),         // Iván Córdoba ZAG tier-2
    co("co-escobar"),        // Escobar ZAG tier-1
    co("co-sanchez"),        // Leonel Álvarez VOL/ZAG tier-3 (covers VOL and ZAG)
    wc("wc-baresi"),         // Baresi ZAG/VOL tier-4 (4⭐ covers ZAG)
    // PD (need ≥1)
    co("co-cuadrado"),       // Cuadrado PD/LD tier-3 (covers PD and LD!)
    co("co-gutierrez"),      // Gutiérrez PE/PD tier-2 (covers PD)
    wc("wc-figo"),           // Figo PD/MEI tier-4 (4⭐ covers PD!)
    // (wc-nedved removed to stay at 15 — add back if slot coverage needed)
  ],
  condition: {
    id: "magia-crioula",
    label: {
      pt: "Magia crioula: jogadores com médio-campo ≥ 85 ganham +2",
      en: "Criollo magic: players with midfield ≥ 85 get +2",
      es: "Magia criolla: jugadores con mediocampo ≥ 85 ganan +2",
    },
    appliesTo: (p) => p.midfield >= 85,
    bonus: 2,
  },
  benchmark: { name: "Seleção do Mundo", rating: 85 },
  budget: 12,
};

// ---------------------------------------------------------------------------
// Authoritative CHALLENGES map
// ---------------------------------------------------------------------------

/**
 * The authored challenge calendar. Keys are challenge numbers (1-based, week 1 only).
 * Returns null for numbers beyond the authored horizon.
 */
export const CHALLENGES: Map<number, DailyChallenge> = new Map([
  [1, challenge1],
  [2, challenge2],
  [3, challenge3],
  [4, challenge4],
  [5, challenge5],
  [6, challenge6],
  [7, challenge7],
  [8, challenge8],
]);

/**
 * Returns the authored DailyChallenge for the given number, or null if
 * no authored content exists for that number yet.
 */
export function getChallengeForNumber(n: number): DailyChallenge | null {
  return CHALLENGES.get(n) ?? null;
}

/**
 * Returns today's challenge (São Paulo time), or null if today is before
 * the epoch or beyond the authored horizon.
 */
export function getTodayChallenge(): DailyChallenge | null {
  const n = challengeNumberForDate(new Date());
  if (n < 1) return null;
  return getChallengeForNumber(n);
}
