/**
 * Bolado — MatchReveal component (Task 1.5)
 *
 * Broadcast-style sequential playback of a MatchBeat[] script:
 *   - Sticky scoreboard with running minute ticker
 *   - Beats render sequentially (~3s each)
 *   - GOAL beats get a full-flash overlay + score bump animation
 *   - oppGoal beats styled cold/red
 *   - lateDrama beats shake the scoreboard
 *   - Controls: "⏩ Acelerar" (2×) and "Pular" (jump to verdict)
 *   - Haptics on user goals (feature-detected, try/catch)
 *   - Reduced-motion: calmer fade-only, same content
 *
 * Timer pattern: ref-tracked timeout IDs cleaned up on unmount,
 * matching the scheduleTimeout idiom from src/App.tsx.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import type { MatchBeat } from "./matchScript";

// ---------------------------------------------------------------------------
// Timing constants
// ---------------------------------------------------------------------------

const BASE_BEAT_MS = 3200;  // ~3.2s per beat at normal speed
const FAST_BEAT_MS = 1400;  // ~1.4s at 2× speed
const MINUTE_TICK_MS = 60;  // How fast the minute ticker counts up between beats

// ---------------------------------------------------------------------------
// Haptics helper
// ---------------------------------------------------------------------------

function vibrateShort(): void {
  try {
    navigator.vibrate?.([40, 20, 80]);
  } catch {
    // Feature not available
  }
}

// ---------------------------------------------------------------------------
// Scoreboard component
// ---------------------------------------------------------------------------

interface ScoreboardProps {
  userGoals: number;
  oppGoals: number;
  displayMinute: number;
  isShaking: boolean;
  isGoalFlash: boolean;
  isOppGoalFlash: boolean;
  matchLabel: string;
}

function Scoreboard({
  userGoals,
  oppGoals,
  displayMinute,
  isShaking,
  isGoalFlash,
  isOppGoalFlash,
  matchLabel,
}: ScoreboardProps) {
  const classes = [
    "bolado-scoreboard",
    isShaking ? "bolado-scoreboard--shake" : "",
    isGoalFlash ? "bolado-scoreboard--goal-flash" : "",
    isOppGoalFlash ? "bolado-scoreboard--opp-flash" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} aria-live="polite" aria-label={`Placar: ${userGoals} a ${oppGoals}, minuto ${displayMinute}`}>
      <div className="bolado-scoreboard-inner">
        <div className="bolado-scoreboard-team bolado-scoreboard-team--home">
          <span className="bolado-scoreboard-team-name">BOLADO XI</span>
          <span className={`bolado-scoreboard-goals ${isGoalFlash ? "bolado-scoreboard-goals--bump" : ""}`}>
            {userGoals}
          </span>
        </div>
        <div className="bolado-scoreboard-center">
          <span className="bolado-scoreboard-minute" aria-label={`Minuto ${displayMinute}`}>
            {displayMinute}'
          </span>
          <span className="bolado-scoreboard-label">{matchLabel}</span>
        </div>
        <div className="bolado-scoreboard-team bolado-scoreboard-team--away">
          <span className={`bolado-scoreboard-goals ${isOppGoalFlash ? "bolado-scoreboard-goals--bump" : ""}`}>
            {oppGoals}
          </span>
          <span className="bolado-scoreboard-team-name">SELEÇÃO DO MUNDO</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Beat commentary card
// ---------------------------------------------------------------------------

interface BeatCardProps {
  beat: MatchBeat;
  index: number;
}

function BeatCard({ beat, index }: BeatCardProps) {
  const isGoal = beat.type === "goal";
  const isOppGoal = beat.type === "oppGoal";
  const isKickoff = beat.type === "kickoff";
  const isFulltime = beat.type === "fulltime";
  const isHalftime = beat.type === "halftime";
  const isLateDrama = beat.type === "lateDrama";

  const classes = [
    "bolado-beat-card",
    `bolado-beat-card--${beat.type}`,
    "bolado-beat-card--enter",
  ].join(" ");

  return (
    <div
      className={classes}
      style={{ animationDelay: `${index * 40}ms` }}
      role={isGoal || isOppGoal ? "alert" : "status"}
      aria-live={isGoal || isOppGoal ? "assertive" : "polite"}
    >
      {isGoal && (
        <div className="bolado-beat-goal-overlay" aria-hidden="true">
          <span className="bolado-beat-goal-badge">GOOOL!</span>
          <span className="bolado-beat-goal-minute">{beat.minute}'</span>
        </div>
      )}
      <div className="bolado-beat-body">
        <span className="bolado-beat-minute-badge" aria-hidden="true">
          {isKickoff ? "0'" : isFulltime ? "90'" : isHalftime ? "45'" : `${beat.minute}'`}
        </span>
        <p className="bolado-beat-text">{beat.commentary}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Goal flash overlay (full-screen)
// ---------------------------------------------------------------------------

function GoalFlashOverlay({ scorer, minute, isOpp }: { scorer: string; minute: number; isOpp: boolean }) {
  return (
    <div
      className={`bolado-goal-flash ${isOpp ? "bolado-goal-flash--opp" : ""}`}
      aria-hidden="true"
    >
      <div className="bolado-goal-flash-inner">
        <span className="bolado-goal-flash-word">{isOpp ? "GOL DELES!" : "GOOOL!"}</span>
        <span className="bolado-goal-flash-scorer">{scorer}</span>
        <span className="bolado-goal-flash-minute">{minute}'</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main MatchReveal component
// ---------------------------------------------------------------------------

interface MatchRevealProps {
  beats: MatchBeat[];
  matchLabel: string;
  totalUserGoals: number;
  totalOppGoals: number;
  onComplete: () => void;
}

export function MatchReveal({
  beats,
  matchLabel,
  totalUserGoals,
  totalOppGoals,
  onComplete,
}: MatchRevealProps) {
  const [revealedCount, setRevealedCount] = useState(1); // start with kickoff
  const [displayMinute, setDisplayMinute] = useState(0);
  const [isAccelerated, setIsAccelerated] = useState(false);
  const [showGoalFlash, setShowGoalFlash] = useState<{ scorer: string; minute: number; isOpp: boolean } | null>(null);
  const [userScore, setUserScore] = useState(0);
  const [oppScore, setOppScore] = useState(0);
  const [isScoreboardShaking, setIsScoreboardShaking] = useState(false);
  const [isGoalFlash, setIsGoalFlash] = useState(false);
  const [isOppGoalFlash, setIsOppGoalFlash] = useState(false);

  const timerRefs = useRef<number[]>([]);
  const isComplete = useRef(false);

  // ── Schedule timer with cleanup tracking
  const schedule = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timerRefs.current.push(id);
    return id;
  }, []);

  // ── Clear all pending timers
  const clearAll = useCallback(() => {
    for (const id of timerRefs.current) {
      window.clearTimeout(id);
    }
    timerRefs.current = [];
  }, []);

  // ── Skip to verdict immediately
  const handleSkip = useCallback(() => {
    if (isComplete.current) return;
    isComplete.current = true;
    clearAll();
    onComplete();
  }, [clearAll, onComplete]);

  // ── Accelerate (2×)
  const handleAccelerate = useCallback(() => {
    setIsAccelerated(true);
  }, []);

  // ── Cleanup on unmount
  useEffect(() => {
    return () => { clearAll(); };
  }, [clearAll]);

  // ── Drive the reveal loop
  useEffect(() => {
    if (revealedCount >= beats.length) {
      // All beats shown — wait then complete
      if (!isComplete.current) {
        const id = window.setTimeout(() => {
          if (!isComplete.current) {
            isComplete.current = true;
            onComplete();
          }
        }, 1800);
        timerRefs.current.push(id);
      }
      return;
    }

    const currentBeat = beats[revealedCount - 1]!;
    const nextBeat = beats[revealedCount];

    const beatDuration = isAccelerated ? FAST_BEAT_MS : BASE_BEAT_MS;

    // ── Minute ticker animation between current and next beat
    if (nextBeat) {
      const fromMin = currentBeat.minute;
      const toMin = nextBeat.minute;
      const steps = Math.max(1, toMin - fromMin);
      const tickInterval = Math.max(30, (beatDuration * 0.6) / steps);

      for (let step = 1; step <= steps; step++) {
        const id = window.setTimeout(() => {
          setDisplayMinute(fromMin + step);
        }, step * tickInterval);
        timerRefs.current.push(id);
      }
    }

    // ── Show goal flash for goal/oppGoal beats
    if (currentBeat.type === "goal" || currentBeat.type === "oppGoal") {
      const isOpp = currentBeat.type === "oppGoal";
      const id1 = window.setTimeout(() => {
        const scorer = currentBeat.scorer ?? (isOpp ? "Seleção do Mundo" : "Craque");
        setShowGoalFlash({ scorer, minute: currentBeat.minute, isOpp });
        // Update score
        if (isOpp) {
          setOppScore(currentBeat.scoreAtBeat[1]);
          setIsOppGoalFlash(true);
          schedule(() => setIsOppGoalFlash(false), 800);
        } else {
          setUserScore(currentBeat.scoreAtBeat[0]);
          setIsGoalFlash(true);
          vibrateShort();
          schedule(() => setIsGoalFlash(false), 800);
        }
      }, 200);
      timerRefs.current.push(id1);

      // Hide flash
      const id2 = window.setTimeout(() => {
        setShowGoalFlash(null);
      }, isAccelerated ? 800 : 1600);
      timerRefs.current.push(id2);
    }

    // ── Scoreboard shake for lateDrama
    if (currentBeat.type === "lateDrama") {
      setIsScoreboardShaking(true);
      const id = window.setTimeout(() => setIsScoreboardShaking(false), 700);
      timerRefs.current.push(id);
    }

    // ── Update score for non-goal beats (at current beat's accumulated score)
    if (currentBeat.type !== "goal" && currentBeat.type !== "oppGoal") {
      setUserScore(currentBeat.scoreAtBeat[0]);
      setOppScore(currentBeat.scoreAtBeat[1]);
    }

    // ── Advance to next beat
    const advanceId = window.setTimeout(() => {
      setRevealedCount((c) => c + 1);
    }, beatDuration);
    timerRefs.current.push(advanceId);

    return () => {
      window.clearTimeout(advanceId);
      // Remove advanceId from timerRefs to avoid a double-clear on unmount
      timerRefs.current = timerRefs.current.filter((id) => id !== advanceId);
    };
  }, [revealedCount, beats, isAccelerated, onComplete]);

  const visibleBeats = beats.slice(0, revealedCount);
  const latestBeat = visibleBeats[visibleBeats.length - 1];

  return (
    <div className="bolado-reveal-screen" aria-label="Transmissão da partida">
      {/* Sticky scoreboard */}
      <Scoreboard
        userGoals={userScore}
        oppGoals={oppScore}
        displayMinute={displayMinute}
        isShaking={isScoreboardShaking}
        isGoalFlash={isGoalFlash}
        isOppGoalFlash={isOppGoalFlash}
        matchLabel={matchLabel}
      />

      {/* Goal flash overlay */}
      {showGoalFlash && (
        <GoalFlashOverlay
          scorer={showGoalFlash.scorer}
          minute={showGoalFlash.minute}
          isOpp={showGoalFlash.isOpp}
        />
      )}

      {/* Beat timeline */}
      <div className="bolado-reveal-timeline" aria-label="Narração da partida">
        <div className="bolado-reveal-beats">
          {visibleBeats.map((beat, i) => (
            <BeatCard key={`${beat.type}-${beat.minute}-${i}`} beat={beat} index={i} />
          ))}
        </div>
      </div>

      {/* Control bar */}
      <div className="bolado-reveal-controls">
        {!isAccelerated && (
          <button
            type="button"
            className="bolado-reveal-speed-btn"
            onClick={handleAccelerate}
            aria-label="Acelerar transmissão"
          >
            ⏩ Acelerar
          </button>
        )}
        {isAccelerated && (
          <span className="bolado-reveal-speed-indicator" aria-live="polite">
            ⚡ 2× velocidade
          </span>
        )}
        <button
          type="button"
          className="bolado-reveal-skip-btn"
          onClick={handleSkip}
          aria-label="Pular para o resultado"
        >
          Pular →
        </button>
      </div>
    </div>
  );
}
