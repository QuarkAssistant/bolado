/**
 * Bolado v2 run-core shared types (spec docs/spec-v2.md §3).
 *
 * Mode-agnostic: Libertadores/Campanha supply StageDef lists (Phase B/C);
 * Phase A ships the engine + placeholder default stage curves.
 */

import type { NationPlayer } from "../types";
import type { Position } from "../engine/types";

// ---------------------------------------------------------------------------
// Formations
// ---------------------------------------------------------------------------

export type FormationId = "4-3-3" | "4-4-2" | "3-5-2";

export interface FormationSlot {
  slotId: string;
  position: Position;
}

export const FORMATIONS: Record<FormationId, FormationSlot[]> = {
  "4-3-3": [
    { slotId: "GOL", position: "GOL" },
    { slotId: "LD", position: "LD" },
    { slotId: "ZAG1", position: "ZAG" },
    { slotId: "ZAG2", position: "ZAG" },
    { slotId: "LE", position: "LE" },
    { slotId: "VOL", position: "VOL" },
    { slotId: "MEI1", position: "MEI" },
    { slotId: "MEI2", position: "MEI" },
    { slotId: "PD", position: "PD" },
    { slotId: "CA", position: "CA" },
    { slotId: "PE", position: "PE" },
  ],
  "4-4-2": [
    { slotId: "GOL", position: "GOL" },
    { slotId: "LD", position: "LD" },
    { slotId: "ZAG1", position: "ZAG" },
    { slotId: "ZAG2", position: "ZAG" },
    { slotId: "LE", position: "LE" },
    { slotId: "MD", position: "MD" },
    { slotId: "VOL", position: "VOL" },
    { slotId: "MEI", position: "MEI" },
    { slotId: "ME", position: "ME" },
    { slotId: "CA1", position: "CA" },
    { slotId: "CA2", position: "CA" },
  ],
  "3-5-2": [
    { slotId: "GOL", position: "GOL" },
    { slotId: "ZAG1", position: "ZAG" },
    { slotId: "ZAG2", position: "ZAG" },
    { slotId: "ZAG3", position: "ZAG" },
    { slotId: "MD", position: "MD" },
    { slotId: "VOL1", position: "VOL" },
    { slotId: "MEI", position: "MEI" },
    { slotId: "VOL2", position: "VOL" },
    { slotId: "ME", position: "ME" },
    { slotId: "CA1", position: "CA" },
    { slotId: "CA2", position: "CA" },
  ],
};

/** The playmaker slot ("camisa 10") per formation — Maestro's anchor. */
export const CAMISA_10_SLOT: Record<FormationId, string> = {
  "4-3-3": "MEI1",
  "4-4-2": "MEI",
  "3-5-2": "MEI",
};

// ---------------------------------------------------------------------------
// Squad / opponents / stages
// ---------------------------------------------------------------------------

export interface Squad {
  formation: FormationId;
  /** slotId → occupant. Always fully populated (journeymen are placeholders). */
  slots: Map<string, NationPlayer>;
}

export interface OpponentDef {
  name: string;
  rating: number;
  flavor: string;
  /** Altitude fortress (La Paz, Quito…): away debuff is -4 instead of -2. */
  altitude?: boolean;
  /** Country tag for Lei do Ex matching (e.g. "Argentina"). */
  country?: string;
}

export interface StageDef {
  id: string;
  label: string;
  opponent: OpponentDef;
  homeAway: "home" | "away";
  /** Lose this match → run over (mata-mata). */
  elimination: boolean;
  /** Coins paid for surviving the stage. */
  completionBonus: number;
}

// ---------------------------------------------------------------------------
// Match output
// ---------------------------------------------------------------------------

export interface RunGoalEvent {
  minute: number;
  side: "user" | "opponent";
  scorer: string;
  /** Squad slot of the scorer (user side only). */
  scorerSlotId?: string;
}

export interface SquadStrength {
  attack: number;
  midfield: number;
  defense: number;
  overall: number;
}

export interface RunMatchResult {
  userGoals: number;
  opponentGoals: number;
  outcome: "win" | "draw" | "loss";
  /** True when a drawn match was decided on penalties (Catimba / mata-mata). */
  viaPenalties: boolean;
  goalEvents: RunGoalEvent[];
  /** Effective strength after card deltas + home/away modifiers (legibility). */
  userStrength: SquadStrength;
  opponentRating: number;
}

export type FiringMoment = "preMatch" | "goal" | "result" | "shootout";

/** A card effect firing — drives the broadcast popups (legibility mandate). */
export interface CardFiring {
  cardId: string;
  moment: FiringMoment;
  minute?: number;
  /** pt-BR popup text, e.g. "😤 Catimba ativou: empate vira disputa de pênaltis!" */
  label: string;
  value?: number;
}
