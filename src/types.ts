import type { Position } from "./engine/types";

// ---------------------------------------------------------------------------
// Bolado single-match simulation types
// ---------------------------------------------------------------------------

/** A player assigned to one of the 5 open slots. */
export interface PickedSlot {
  slotId: string;
  player: NationPlayer;
}

/** A goal event in the single-match simulation. */
export interface MatchGoalEvent {
  minute: number;
  /** "user" = the player's XI; "opponent" = the benchmark side */
  side: "user" | "opponent";
  scorer: string;
}

/** Result of the single-match simulation for a Bolado daily puzzle. */
export interface DailyMatchResult {
  userGoals: number;
  opponentGoals: number;
  outcome: "win" | "draw" | "loss";
  goalEvents: MatchGoalEvent[];
}

/** Per-pick grade emoji for the share card. */
export type PickGrade = "🟩" | "🟨" | "🟥" | "🟦";

export interface PickGradeEntry {
  slotId: string;
  playerId: string;
  grade: PickGrade;
}

/** Final scoring verdict returned to the UI. */
export interface DailyVerdict {
  /** 0–100 composite performance score */
  points: number;
  /** 0–5 star bucket */
  stars: 0 | 1 | 2 | 3 | 4 | 5;
  /** Per-pick grade (🟩 great, 🟨 fine, 🟥 flop, 🟦 condition hit) */
  pickGrades: PickGradeEntry[];
}

/**
 * SlotPosition mirrors the game's Position type for compatibility.
 * ATA maps to the game's "CA" (centre-forward). The spec-listed ATA
 * is an alias used in the daily puzzle UI; the underlying position id
 * from the game types remains authoritative for the simulator.
 */
export type SlotPosition = Position;

export interface NationPlayer {
  id: string;
  displayName: string;
  nation: string;
  /** Position ids from the game's Position type */
  positions: string[];
  eraBand: string;
  attack: number;
  midfield: number;
  defense: number;
  special?: string;
  costTier: 1 | 2 | 3 | 4 | 5;
  bioHook: string;
}

export interface PrePlacedSlot {
  slotId: string;
  position: string;
  player: NationPlayer;
}

export interface OpenSlot {
  slotId: string;
  position: string;
}

export interface DailyCondition {
  id: string;
  label: { pt: string; en: string; es: string };
  appliesTo: (player: NationPlayer) => boolean;
  bonus: number;
}

export interface DailyChallenge {
  id: number;
  date: string;
  themeLabel: string;
  flags: string;
  prePlaced: PrePlacedSlot[];
  openSlots: OpenSlot[];
  candidates: NationPlayer[];
  condition: DailyCondition;
  benchmark: { name: string; rating: number };
  budget: number;
}
