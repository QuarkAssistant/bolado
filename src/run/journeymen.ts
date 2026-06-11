/**
 * Journeymen — the starter XI of várzea heroes (spec §3.1 step 1).
 *
 * Every run begins with 11 deterministically-generated placeholder players at
 * fixed low ratings. They are charming on purpose: the player's job is to
 * replace them one dice roll at a time, and watching "Tonho Frangueiro" hold
 * the fort until matchday 4 is part of the humor.
 *
 * Determinism: generateJourneymen(seed, formation) is pure — the same seed
 * always produces the same names, eras and stats (replay foundation).
 */

import { hashSeed } from "../engine/random";
import type { NationPlayer } from "../types";
import type { Position } from "../engine/types";
import { FORMATIONS, type FormationId } from "./types";

// ---------------------------------------------------------------------------
// Name pools — 8 per position pool, pt-BR várzea flavor
// ---------------------------------------------------------------------------

type PoolKey = "GOL" | "LAT" | "ZAG" | "VOL" | "MEI" | "PON" | "ATA";

export const JOURNEYMAN_NAMES: Record<PoolKey, readonly string[]> = {
  GOL: [
    "Zé Luva",
    "Tonho Frangueiro",
    "Mãozinha Santa",
    "Careca do Gol",
    "Seu Osvaldo",
    "Pipoca",
    "Grandão da Vila",
    "Bigode Elástico",
  ],
  LAT: [
    "Juninho Foguete",
    "Beto Beirada",
    "Lalá da Linha",
    "Vavá Vapt-Vupt",
    "Pernalonga",
    "Tico Trombada",
    "Zequinha Cruzador",
    "Cris Corredor",
  ],
  ZAG: [
    "Zé da Várzea",
    "Brutos Carrasco",
    "Paredinha",
    "Mestre Carrinho",
    "Dudu Travessão",
    "Canela de Aço",
    "Seu Firmino",
    "Tanque do Bairro",
  ],
  VOL: [
    "Raça Pura",
    "Cascão Marcador",
    "Bidu Cão de Guarda",
    "Nego Trator",
    "Pitbull da Vila",
    "Sombra",
    "Roque Rachador",
    "Marreta",
  ],
  MEI: [
    "Dez da Pelada",
    "Poeta da Bola",
    "Chico Caneta",
    "Maestrinho",
    "Lampião do Meio",
    "Visão de Águia",
    "Gildo Garçom",
    "Pezinho de Anjo",
  ],
  PON: [
    "Foguinho",
    "Bala da Quebrada",
    "Driblão",
    "Vento Norte",
    "Zigue-Zague",
    "Catatau Veloz",
    "Pingo Ligeiro",
    "Rabisco",
  ],
  ATA: [
    "Artilheiro de Domingo",
    "Cabeção Matador",
    "Faro de Gol",
    "Nenê Chutão",
    "Pé de Ferro",
    "Oportunista da Área",
    "Bombardeiro",
    "Gordo Goleador",
  ],
};

const POOL_FOR_POSITION: Record<Position, PoolKey> = {
  GOL: "GOL",
  LD: "LAT",
  LE: "LAT",
  ZAG: "ZAG",
  VOL: "VOL",
  MEI: "MEI",
  MD: "PON",
  ME: "PON",
  PD: "PON",
  PE: "PON",
  CA: "ATA",
};

const ERAS = ["50s-60s", "70s-80s", "90s-00s", "00s-10s", "10s-20s"] as const;

// Fixed low ratings: primary stat 60-66, the rest trail far behind.
const PRIMARY_BASE = 60;
const PRIMARY_SPREAD = 7;
const SECONDARY_GAP = 12;
const TERTIARY_GAP = 22;

function slug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
}

type StatTriple = { attack: number; midfield: number; defense: number };

function statsFor(position: Position, primary: number): StatTriple {
  const secondary = primary - SECONDARY_GAP;
  const tertiary = primary - TERTIARY_GAP;
  switch (POOL_FOR_POSITION[position]) {
    case "GOL":
    case "ZAG":
    case "LAT":
      return { defense: primary, midfield: secondary, attack: tertiary };
    case "VOL":
      return { midfield: primary, defense: secondary, attack: tertiary };
    case "MEI":
      return { midfield: primary, attack: secondary, defense: tertiary };
    default: // PON, ATA
      return { attack: primary, midfield: secondary, defense: tertiary };
  }
}

/**
 * Generate the starter XI for a run: slotId → journeyman.
 * Pure & deterministic in (seed, formation). Names are drawn without
 * replacement per position pool, so an XI never fields two "Zé da Várzea".
 */
export function generateJourneymen(
  seed: string,
  formation: FormationId,
): Map<string, NationPlayer> {
  const slots = FORMATIONS[formation];
  const remaining: Record<PoolKey, string[]> = {
    GOL: [...JOURNEYMAN_NAMES.GOL],
    LAT: [...JOURNEYMAN_NAMES.LAT],
    ZAG: [...JOURNEYMAN_NAMES.ZAG],
    VOL: [...JOURNEYMAN_NAMES.VOL],
    MEI: [...JOURNEYMAN_NAMES.MEI],
    PON: [...JOURNEYMAN_NAMES.PON],
    ATA: [...JOURNEYMAN_NAMES.ATA],
  };

  const squad = new Map<string, NationPlayer>();

  for (const slot of slots) {
    const pool = remaining[POOL_FOR_POSITION[slot.position]];
    const nameIndex = hashSeed(`${seed}:jm-name:${slot.slotId}`) % pool.length;
    const name = pool.splice(nameIndex, 1)[0]!;

    const primary = PRIMARY_BASE + (hashSeed(`${seed}:jm-stat:${slot.slotId}`) % PRIMARY_SPREAD);
    const era = ERAS[hashSeed(`${seed}:jm-era:${slot.slotId}`) % ERAS.length]!;

    squad.set(slot.slotId, {
      id: `jm-${slug(name)}`,
      displayName: name,
      nation: "Várzea FC",
      positions: [slot.position],
      eraBand: era,
      ...statsFor(slot.position, primary),
      costTier: 1,
      bioHook: "Cria da várzea — segura a bronca até chegar reforço.",
    });
  }

  return squad;
}

/** True when a player id belongs to a generated journeyman. */
export function isJourneyman(playerId: string): boolean {
  return playerId.startsWith("jm-");
}
