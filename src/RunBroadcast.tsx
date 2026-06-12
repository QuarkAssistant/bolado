/**
 * RunBroadcast — the run-match transmissão (Phase B part 2, identity §3).
 *
 * Plays a RunMatchBeat[] script as a 90s TV broadcast:
 *   - .bld-scorebug pinned up top with a running minute ticker
 *   - commentary beats slide in as .bld-ticker lines (newest first)
 *   - cardFire beats slam in as BIG .bld-toast poster chips (the
 *     legibility payoff — every card effect gets its moment)
 *   - goal beats: full-screen flash + scorer name + haptics
 *   - controls: "⏩ Acelerar" (2×) and "Pular" — always available
 *
 * Timer hygiene copied from the proven v1 MatchReveal pattern: every
 * timeout id is tracked in a ref and cleared on unmount, INCLUDING the
 * accelerate path (the effect cleanup clears + untracks the advance
 * timer before rescheduling at the new speed).
 *
 * Reduced motion: animations ride .bld-anim (killed globally by
 * tokens.css) and the beat cadence drops to a quick fixed step.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { RunMatchBeat } from "./run/runMatchScript";

// ---------------------------------------------------------------------------
// Timing
// ---------------------------------------------------------------------------

const BASE_BEAT_MS = 3000;
const FAST_BEAT_MS = 1300;
const REDUCED_BEAT_MS = 1600; // calmer fixed cadence, no ticking minutes
const CARD_FIRE_EXTRA_MS = 800; // card slams hold a touch longer — they're the payoff
const COMPLETE_HOLD_MS = 1600;

function prefersReducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
}

function vibrateGoal(): void {
  try {
    navigator.vibrate?.([40, 20, 80]);
  } catch {
    /* feature not available */
  }
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

function BeatLine({ beat }: { beat: RunMatchBeat }) {
  const isGoal = beat.type === "goal";
  const isOppGoal = beat.type === "oppGoal";
  const tagStyle = isGoal
    ? { background: "var(--bld-field-500)", color: "var(--bld-flood-0)" }
    : isOppGoal || beat.type === "lateDrama" || beat.type === "shootout"
      ? undefined // red AO VIVO default
      : { background: "var(--bld-field-700)", color: "var(--bld-flood-100)" };

  return (
    <div
      className={`bld-ticker run-beat run-beat--${beat.type} bld-anim`}
      role={isGoal || isOppGoal ? "alert" : "status"}
    >
      <span className="bld-ticker__tag" style={tagStyle}>
        {beat.minute}&apos;
      </span>
      <span className="bld-ticker__text">{beat.commentary}</span>
    </div>
  );
}

function CardFireToast({ beat }: { beat: RunMatchBeat }) {
  return (
    <div className="run-cardfire bld-anim" role="alert">
      <div className="bld-toast bld-toast--gold run-cardfire__toast bld-anim">
        <span>{beat.commentary}</span>
      </div>
    </div>
  );
}

function GoalFlash({ beat }: { beat: RunMatchBeat }) {
  const isOpp = beat.type === "oppGoal";
  return (
    <div className={`run-goalflash${isOpp ? " run-goalflash--opp" : ""} bld-anim`} aria-hidden="true">
      <span className="run-goalflash__word">{isOpp ? "GOL DELES…" : "GOOOL!"}</span>
      <span className="run-goalflash__scorer">{beat.scorer}</span>
      <span className="run-goalflash__minute">{beat.minute}&apos;</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function RunBroadcast({
  beats,
  compLabel,
  userTag,
  opponentTag,
  onComplete,
}: {
  beats: RunMatchBeat[];
  /** Score bug competition tab, e.g. "Libertadores · Oitavas de Final". */
  compLabel: string;
  userTag: string;
  opponentTag: string;
  onComplete: () => void;
}) {
  const [revealedCount, setRevealedCount] = useState(1); // kickoff shows immediately
  const [displayMinute, setDisplayMinute] = useState(1);
  const [accelerated, setAccelerated] = useState(false);
  const [goalFlash, setGoalFlash] = useState<RunMatchBeat | null>(null);

  const timerRefs = useRef<number[]>([]);
  const isComplete = useRef(false);
  const reduced = useRef(prefersReducedMotion());

  const schedule = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timerRefs.current.push(id);
    return id;
  }, []);

  const clearAll = useCallback(() => {
    for (const id of timerRefs.current) window.clearTimeout(id);
    timerRefs.current = [];
  }, []);

  const handleSkip = useCallback(() => {
    if (isComplete.current) return;
    isComplete.current = true;
    clearAll();
    onComplete();
  }, [clearAll, onComplete]);

  // Cleanup on unmount
  useEffect(() => () => clearAll(), [clearAll]);

  // ── Drive the reveal loop
  useEffect(() => {
    if (revealedCount >= beats.length) {
      if (!isComplete.current) {
        schedule(() => {
          if (!isComplete.current) {
            isComplete.current = true;
            onComplete();
          }
        }, COMPLETE_HOLD_MS);
      }
      return;
    }

    const currentBeat = beats[revealedCount - 1]!;
    const nextBeat = beats[revealedCount]!;

    let beatDuration = reduced.current ? REDUCED_BEAT_MS : accelerated ? FAST_BEAT_MS : BASE_BEAT_MS;
    if (currentBeat.type === "cardFire" && !accelerated) beatDuration += CARD_FIRE_EXTRA_MS;

    // Minute ticker between beats (skipped under reduced motion)
    if (!reduced.current && nextBeat.minute > currentBeat.minute) {
      const steps = nextBeat.minute - currentBeat.minute;
      const tickInterval = Math.max(30, (beatDuration * 0.6) / steps);
      for (let step = 1; step <= steps; step += 1) {
        schedule(() => setDisplayMinute(currentBeat.minute + step), step * tickInterval);
      }
    } else {
      setDisplayMinute(nextBeat.minute);
    }

    // Goal moments: flash + haptics
    if (currentBeat.type === "goal" || currentBeat.type === "oppGoal") {
      setGoalFlash(currentBeat);
      if (currentBeat.type === "goal") vibrateGoal();
      schedule(() => setGoalFlash(null), accelerated ? 800 : 1500);
    }

    // Advance — the accelerate-cleanup fix: when `accelerated` flips, this
    // effect re-runs; clear AND untrack the stale advance timer so the next
    // beat is scheduled exactly once at the new speed.
    const advanceId = window.setTimeout(() => setRevealedCount((c) => c + 1), beatDuration);
    timerRefs.current.push(advanceId);
    return () => {
      window.clearTimeout(advanceId);
      timerRefs.current = timerRefs.current.filter((id) => id !== advanceId);
    };
  }, [revealedCount, beats, accelerated, onComplete, schedule]);

  const visible = beats.slice(0, revealedCount);
  const current = visible[visible.length - 1]!;
  const [userScore, oppScore] = current.scoreAtBeat;
  const newestFirst = [...visible].reverse();

  return (
    <div className="run-broadcast" aria-label="Transmissão da partida">
      <div className="run-broadcast__bug">
        <div className={`bld-scorebug${goalFlash ? " run-bug--goal" : ""}`}>
          <span className="bld-scorebug__comp">{compLabel}</span>
          <div className="bld-scorebug__row">
            <span className="bld-scorebug__team">{userTag}</span>
            <span
              className="bld-scorebug__score"
              aria-live="polite"
              aria-label={`Placar ${userScore} a ${oppScore}, minuto ${displayMinute}`}
            >
              {userScore}–{oppScore}
            </span>
            <span className="bld-scorebug__team">{opponentTag}</span>
            <span className="bld-scorebug__clock">
              {current.type === "fulltime" || current.type === "shootout" || current.type === "cardFire"
                ? displayMinute >= 90
                  ? "FIM"
                  : `${displayMinute}'`
                : `${displayMinute}'`}
            </span>
          </div>
        </div>
        <span className="run-live bld-label" aria-hidden="true">
          <span className="run-live__dot" /> Ao vivo
        </span>
      </div>

      {goalFlash && <GoalFlash beat={goalFlash} />}

      <div className="run-broadcast__beats" aria-label="Narração da partida">
        {newestFirst.map((beat, i) =>
          beat.type === "cardFire" ? (
            <CardFireToast key={`${beat.minute}-${beat.type}-${visible.length - i}`} beat={beat} />
          ) : (
            <BeatLine key={`${beat.minute}-${beat.type}-${visible.length - i}`} beat={beat} />
          ),
        )}
      </div>

      <div className="run-broadcast__controls">
        {!accelerated ? (
          <button
            type="button"
            className="bld-btn bld-btn--secondary run-broadcast__speed"
            onClick={() => setAccelerated(true)}
            aria-label="Acelerar transmissão"
          >
            <span>⏩ Acelerar</span>
          </button>
        ) : (
          <span className="bld-label" aria-live="polite">
            ⚡ 2× velocidade
          </span>
        )}
        <button
          type="button"
          className="bld-btn bld-btn--primary run-broadcast__skip"
          onClick={handleSkip}
          aria-label="Pular para o resultado"
        >
          <span>Pular ▶</span>
        </button>
      </div>
    </div>
  );
}
