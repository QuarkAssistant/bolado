/**
 * Bolado — VerdictScreen component (Task 1.5 / 1.6)
 *
 * Staggered reveal:
 *   1. Final score
 *   2. Outcome headline (win/draw/loss)
 *   3. Stars (pop in one by one)
 *   4. Points count-up (0→N, ~1s)
 *   5. Pick grades row (5 squares + player name + one-line explanation)
 *   6. Percentile placeholder pill
 *   7. "volte amanhã" hook
 *   8. Action row (Compartilhar + Copiar + Rever partida)
 *
 * Confetti-ish win/5-star celebration: pure CSS particles.
 * Reduced-motion: instant reveals, no confetti.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import type { DailyVerdict, PickGradeEntry, PickedSlot } from "./types";
import type { DailyMatchResult } from "./types";
import { buildShareText } from "./shareDaily";
import { ShareActions } from "./ShareActions";

// ---------------------------------------------------------------------------
// Outcome strings (pt-BR broadcast register)
// ---------------------------------------------------------------------------

function outcomeHeadline(outcome: DailyMatchResult["outcome"], stars: number): string {
  if (outcome === "win") return stars >= 5 ? "VITÓRIA BOLADA! ⭐" : "VITÓRIA BOLADA!";
  if (outcome === "draw") return "EMPATE DURO.";
  return "HOJE NÃO...";
}

// ---------------------------------------------------------------------------
// Grade explanation (short, per grade type)
// ---------------------------------------------------------------------------

function gradeExplanation(grade: PickGradeEntry["grade"]): string {
  switch (grade) {
    case "🟦": return "Bônus da condição do dia!";
    case "🟩": return "Ótima escolha!";
    case "🟨": return "Jogada razoável.";
    case "🟥": return "Caro e não entregou.";
  }
}

// ---------------------------------------------------------------------------
// Star display
// ---------------------------------------------------------------------------

interface StarsDisplayProps {
  stars: number;
  revealed: number; // how many are currently shown
}

function StarsDisplay({ stars, revealed }: StarsDisplayProps) {
  return (
    <div className="bolado-verdict-stars" aria-label={`${stars} estrelas de 5`}>
      {Array.from({ length: 5 }, (_, i) => {
        const active = i < stars;
        const show = i < revealed;
        return (
          <span
            key={i}
            className={[
              "bolado-verdict-star",
              active ? "bolado-verdict-star--active" : "bolado-verdict-star--empty",
              show && active ? "bolado-verdict-star--pop" : "",
              !show ? "bolado-verdict-star--hidden" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-hidden="true"
          >
            ★
          </span>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Animated counter (count-up from 0 to target)
// ---------------------------------------------------------------------------

function useCountUp(target: number, durationMs: number, startDelay: number, instant: boolean): number {
  const [current, setCurrent] = useState(instant ? target : 0);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const delayRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (instant) {
      setCurrent(target);
      return;
    }

    delayRef.current = setTimeout(() => {
      const tick = (now: number) => {
        if (startTimeRef.current === null) startTimeRef.current = now;
        const elapsed = now - startTimeRef.current;
        const progress = Math.min(1, elapsed / durationMs);
        const eased = progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;
        setCurrent(Math.round(target * eased));
        if (progress < 1) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          setCurrent(target);
        }
      };
      rafRef.current = requestAnimationFrame(tick);
    }, startDelay);

    return () => {
      if (delayRef.current !== null) clearTimeout(delayRef.current);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, durationMs, startDelay, instant]);

  return current;
}

// ---------------------------------------------------------------------------
// Pick grade row
// ---------------------------------------------------------------------------

interface PickGradeRowProps {
  pickGrades: PickGradeEntry[];
  picks: PickedSlot[];
  visible: boolean;
}

function PickGradeRow({ pickGrades, picks, visible }: PickGradeRowProps) {
  return (
    <div
      className={`bolado-verdict-grades ${visible ? "bolado-verdict-grades--visible" : ""}`}
      aria-label="Avaliação individual dos jogadores escolhidos"
    >
      {pickGrades.map((entry, i) => {
        const pick = picks.find((p) => p.slotId === entry.slotId);
        const playerName = pick?.player.displayName ?? entry.playerId;
        const explanation = gradeExplanation(entry.grade);

        return (
          <div
            key={entry.slotId}
            className="bolado-verdict-grade-item"
            style={{ animationDelay: `${i * 80}ms` }}
            aria-label={`${playerName}: ${entry.grade} — ${explanation}`}
          >
            <span className="bolado-verdict-grade-emoji" aria-hidden="true">
              {entry.grade}
            </span>
            <div className="bolado-verdict-grade-info">
              <span className="bolado-verdict-grade-name">{playerName}</span>
              <span className="bolado-verdict-grade-explanation">{explanation}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Confetti (CSS particle burst for win / 5-star)
// ---------------------------------------------------------------------------

function Confetti() {
  const colors = ["#e0b54a", "#3dba6f", "#f7efd8", "#e05a4a", "#4a9fe0"];
  const particles = Array.from({ length: 18 }, (_, i) => ({
    id: i,
    color: colors[i % colors.length]!,
    left: `${5 + i * 5}%`,
    delay: `${(i * 80) % 400}ms`,
    duration: `${1200 + (i * 50) % 600}ms`,
    size: `${6 + (i % 4) * 3}px`,
  }));

  return (
    <div className="bolado-confetti" aria-hidden="true">
      {particles.map((p) => (
        <div
          key={p.id}
          className="bolado-confetti-particle"
          style={{
            left: p.left,
            backgroundColor: p.color,
            width: p.size,
            height: p.size,
            animationDelay: p.delay,
            animationDuration: p.duration,
          }}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reveal steps
// ---------------------------------------------------------------------------

const STEP_DELAY = 420; // ms between staggered reveal steps

type RevealStep =
  | "score"
  | "headline"
  | "stars"
  | "points"
  | "grades"
  | "percentile"
  | "hook"
  | "actions";

const STEPS: RevealStep[] = ["score", "headline", "stars", "points", "grades", "percentile", "hook", "actions"];

// ---------------------------------------------------------------------------
// Main VerdictScreen
// ---------------------------------------------------------------------------

interface VerdictScreenProps {
  verdict: DailyVerdict;
  matchResult: DailyMatchResult;
  picks: PickedSlot[];
  onReplayReveal: () => void;
  /** Challenge number for the share card header, e.g. 1 */
  challengeNumber: number;
  /** Flag emoji string from DailyChallenge.flags, e.g. "🇲🇽×🇿🇦" */
  challengeFlags: string;
}

export function VerdictScreen({
  verdict,
  matchResult,
  picks,
  onReplayReveal,
  challengeNumber,
  challengeFlags,
}: VerdictScreenProps) {
  const prefersReducedMotion =
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;

  const [completedStep, setCompletedStep] = useState<number>(-1);
  const [starsRevealed, setStarsRevealed] = useState(0);
  const timersRef = useRef<number[]>([]);

  const isVisible = (step: RevealStep) => {
    const idx = STEPS.indexOf(step);
    return completedStep >= idx;
  };

  // Count-up points
  const pointsStep = STEPS.indexOf("points");
  const pointsVisible = completedStep >= pointsStep;
  const pointsStart = pointsVisible ? pointsStep * STEP_DELAY + 200 : 0;
  const displayPoints = useCountUp(verdict.points, 1000, 0, prefersReducedMotion || !pointsVisible);

  // Share text (computed once from stable verdict data)
  const shareText = buildShareText({
    challengeNumber,
    flags: challengeFlags,
    score: { user: matchResult.userGoals, opp: matchResult.opponentGoals },
    stars: verdict.stars,
    percentile: null, // Phase 2 not live yet
    streakDays: null, // Task 1.7 wires streak
    pickGrades: verdict.pickGrades,
  });

  // Staggered reveal orchestration
  useEffect(() => {
    if (prefersReducedMotion) {
      setCompletedStep(STEPS.length - 1);
      setStarsRevealed(verdict.stars);
      return;
    }

    // Schedule each step
    STEPS.forEach((_, i) => {
      const id = window.setTimeout(() => {
        setCompletedStep(i);

        // For stars step: pop them in one by one
        if (STEPS[i] === "stars") {
          for (let s = 1; s <= verdict.stars; s++) {
            const sid = window.setTimeout(() => {
              setStarsRevealed(s);
            }, s * 180);
            timersRef.current.push(sid);
          }
        }
      }, (i + 1) * STEP_DELAY);
      timersRef.current.push(id);
    });

    return () => {
      for (const id of timersRef.current) window.clearTimeout(id);
    };
  }, [verdict.stars, prefersReducedMotion]);

  const showCelebration =
    (matchResult.outcome === "win" || verdict.stars >= 5) && !prefersReducedMotion;

  return (
    <div className="bolado-verdict-screen" aria-label="Resultado do desafio">
      {showCelebration && <Confetti />}

      {/* Final score */}
      {isVisible("score") && (
        <div className="bolado-verdict-score bolado-verdict-item--enter" aria-label={`Placar final: ${matchResult.userGoals} a ${matchResult.opponentGoals}`}>
          <div className="bolado-verdict-score-inner">
            <span className="bolado-verdict-score-label">BOLADO XI</span>
            <span className="bolado-verdict-score-num bolado-verdict-score-num--home">
              {matchResult.userGoals}
            </span>
            <span className="bolado-verdict-score-sep">×</span>
            <span className="bolado-verdict-score-num bolado-verdict-score-num--away">
              {matchResult.opponentGoals}
            </span>
            <span className="bolado-verdict-score-label">SELEÇÃO DO MUNDO</span>
          </div>
        </div>
      )}

      {/* Outcome headline */}
      {isVisible("headline") && (
        <h2
          className={[
            "bolado-verdict-headline",
            "bolado-verdict-item--enter",
            matchResult.outcome === "win" ? "bolado-verdict-headline--win" : "",
            matchResult.outcome === "loss" ? "bolado-verdict-headline--loss" : "",
            matchResult.outcome === "draw" ? "bolado-verdict-headline--draw" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {outcomeHeadline(matchResult.outcome, verdict.stars)}
        </h2>
      )}

      {/* Stars */}
      {isVisible("stars") && (
        <div className="bolado-verdict-item--enter">
          <StarsDisplay stars={verdict.stars} revealed={starsRevealed} />
        </div>
      )}

      {/* Points count-up */}
      {isVisible("points") && (
        <div className="bolado-verdict-points bolado-verdict-item--enter">
          <span className="bolado-verdict-points-num" aria-live="polite">
            {displayPoints}
          </span>
          <span className="bolado-verdict-points-label">pontos</span>
        </div>
      )}

      {/* Pick grades */}
      {isVisible("grades") && (
        <PickGradeRow
          pickGrades={verdict.pickGrades}
          picks={picks}
          visible={isVisible("grades")}
        />
      )}

      {/* Percentile placeholder */}
      {isVisible("percentile") && (
        <div className="bolado-verdict-percentile bolado-verdict-item--enter" aria-label="Posição mundial ainda sendo calculada">
          <span className="bolado-verdict-percentile-pill">
            🌍 calculando posição mundial…
          </span>
        </div>
      )}

      {/* "Come back tomorrow" hook */}
      {isVisible("hook") && (
        <p className="bolado-verdict-hook bolado-verdict-item--enter">
          Volte amanhã: o time perfeito de hoje será revelado.
        </p>
      )}

      {/* Action row */}
      {isVisible("actions") && (
        <ShareActions shareText={shareText} onReplayReveal={onReplayReveal} />
      )}
    </div>
  );
}
