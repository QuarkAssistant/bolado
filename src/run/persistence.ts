/**
 * Run persistence — resume an in-progress run after a reload (Phase B).
 *
 * The save is tiny because the engine is a fold: we store ONLY the seed,
 * mode and decisions log, then restoreRun replays them through the pure
 * engine (replayRun) to the identical state. `atPreMatch` is the single
 * UI-level extra: whether the player had already advanced to the
 * pre-match confrontation (engine still in "shop").
 *
 * Everything here is defensive: garbage in localStorage (old versions,
 * manual edits, corrupt logs) yields null, never a throw — the app shell
 * falls back to the home screen.
 */

import { replayRun, type CompetitionDef, type RunDecision, type RunMode, type RunState } from "./runState";
import { buildLibertadoresCompetition } from "./libertadores";

export const RUN_STORAGE_KEY = "bolado-run-v2";

const DECISION_TYPES: ReadonlySet<string> = new Set([
  "roll",
  "reroll",
  "sign",
  "skipSign",
  "buyCard",
  "sellCard",
  "kickoff",
  "advance",
]);

export interface SavedRun {
  v: 1;
  seed: string;
  mode: RunMode;
  decisions: RunDecision[];
  /** UI position: pre-match screen shown (engine phase is still "shop"). */
  atPreMatch: boolean;
}

/** The CompetitionDef a run of this mode/seed plays (rebuilt, never stored). */
export function competitionForRun(mode: RunMode, seed: string): CompetitionDef {
  if (mode !== "libertadores") {
    throw new Error(`Unsupported run mode: ${mode} (Campanha is Phase C)`);
  }
  return buildLibertadoresCompetition(seed);
}

export function serializeRun(saved: SavedRun): string {
  return JSON.stringify(saved);
}

/** Parse + validate a stored payload. Null on anything suspicious. */
export function deserializeRun(raw: string | null): SavedRun | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const candidate = parsed as Record<string, unknown>;
  if (candidate.v !== 1) return null;
  if (typeof candidate.seed !== "string" || candidate.seed.length === 0) return null;
  if (candidate.mode !== "libertadores") return null;
  if (typeof candidate.atPreMatch !== "boolean") return null;
  if (!Array.isArray(candidate.decisions)) return null;
  for (const decision of candidate.decisions) {
    if (
      typeof decision !== "object" ||
      decision === null ||
      !DECISION_TYPES.has((decision as { type?: unknown }).type as string)
    ) {
      return null;
    }
  }
  return {
    v: 1,
    seed: candidate.seed,
    mode: candidate.mode,
    decisions: candidate.decisions as RunDecision[],
    atPreMatch: candidate.atPreMatch,
  };
}

/**
 * Replay a saved run back to its live state. Null when the log no longer
 * replays cleanly (engine changes, tampering) — caller discards the save.
 */
export function restoreRun(saved: SavedRun): RunState | null {
  try {
    return replayRun(saved.seed, saved.mode, saved.decisions, {
      competition: competitionForRun(saved.mode, saved.seed),
    });
  } catch {
    return null;
  }
}
