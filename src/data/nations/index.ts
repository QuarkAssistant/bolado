/**
 * Nation player pools — Bolado daily puzzle (completa o time).
 *
 * LEGAL GUARDRAIL: This module contains player names and factual statistics only.
 * No player likenesses, photos, kit designs, or federation crests are used or implied.
 * See spec §10 (docs/new-game/2026-06-11-completa-o-time-spec.md) for full legal posture.
 */

export type EraBand = "50s-60s" | "70s-80s" | "90s-00s" | "00s-10s" | "10s-20s";

export type { NationPlayer } from "../../types";

import { brazilPool } from "./brazil";
import { argentinaPool } from "./argentina";
import { mexicoPool } from "./mexico";
import { usaPool } from "./usa";
import { spainPool } from "./spain";
import { francePool } from "./france";
import { netherlandsPool } from "./netherlands";
import { colombiaPool } from "./colombia";
import { moroccoPool } from "./morocco";
import { japanPool } from "./japan";
import { senegalPool } from "./senegal";
import { canadaPool } from "./canada";
import { southAfricaPool } from "./south-africa";
import { wildcardsPool } from "./wildcards";

/**
 * Deep pools (~18-22 players each): nations with enough all-time legends for a full puzzle theme.
 * Light pools (~10-12 players each): emerging or African/CONCACAF nations.
 * Wildcards: global legends from nations without a dedicated pool, usable any day.
 */
export const nationPools: Record<string, import("../../types").NationPlayer[]> = {
  Brazil: brazilPool,
  Argentina: argentinaPool,
  Mexico: mexicoPool,
  USA: usaPool,
  Spain: spainPool,
  France: francePool,
  Netherlands: netherlandsPool,
  Colombia: colombiaPool,
  Morocco: moroccoPool,
  Japan: japanPool,
  Senegal: senegalPool,
  Canada: canadaPool,
  "South Africa": southAfricaPool,
  wildcards: wildcardsPool,
};

export const allNationPlayers: import("../../types").NationPlayer[] = Object.values(nationPools).flat();
