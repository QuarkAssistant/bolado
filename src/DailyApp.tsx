import { useEffect, useState } from "react";
import "./daily.css";
import { getTodayChallenge } from "./challenges";
import { todayChallengeNumber } from "./dailyId";
import { CompleteXiScreen } from "./CompleteXiScreen";
import { MatchReveal } from "./MatchReveal";
import { VerdictScreen } from "./VerdictScreen";
import type { PickedSlot } from "./playDailyMatch";
import { playDailyMatch } from "./playDailyMatch";
import { scorePerformance } from "./scoring";
import { buildMatchScript } from "./matchScript";
import { buildDayRecord, saveDayRecord, loadDayRecord } from "./dayLock";
import type { DailyVerdict, DailyMatchResult } from "./types";
import type { MatchBeat } from "./matchScript";
import { trackFirstPartyEvent } from "./engine/analytics";

// ---------------------------------------------------------------------------
// App phases post-confirm
// ---------------------------------------------------------------------------

type PostConfirmPhase =
  | { phase: "reveal"; beats: MatchBeat[]; verdict: DailyVerdict; matchResult: DailyMatchResult; picks: PickedSlot[] }
  | { phase: "verdict"; verdict: DailyVerdict; matchResult: DailyMatchResult; picks: PickedSlot[]; beats: MatchBeat[] };

// ---------------------------------------------------------------------------
// Root app
// ---------------------------------------------------------------------------

export default function DailyApp() {
  const challenge = getTodayChallenge();
  const num = todayChallengeNumber();

  // ── Load persisted day record (if already completed today)
  const savedRecord = challenge ? loadDayRecord(challenge.id) : null;

  const [postConfirm, setPostConfirm] = useState<PostConfirmPhase | null>(() => {
    if (!challenge || !savedRecord) return null;
    // Rebuild script from saved data
    const beats = buildMatchScript(challenge, savedRecord.picks, savedRecord.matchResult);
    return {
      phase: "verdict",
      verdict: savedRecord.verdict,
      matchResult: savedRecord.matchResult,
      picks: savedRecord.picks,
      beats,
    };
  });

  // ── Analytics: daily_open (once on mount; fires even if day is locked)
  useEffect(() => {
    trackFirstPartyEvent("daily_open", { challengeId: challenge?.id ?? null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Beyond authored horizon or pre-launch
  if (!challenge) {
    return (
      <div className="bolado-root">
        <h1 className="bolado-wordmark">Bolado</h1>
        <p className="bolado-tagline">Complete o time do dia</p>
        <div className="bolado-coming-soon">
          <p className="bolado-coming-soon-label">
            {num < 1 ? "em breve" : "volte amanhã"}
          </p>
          {num < 1 && (
            <p className="bolado-coming-soon-date">#1 · 11 de junho</p>
          )}
        </div>
      </div>
    );
  }

  // ── Post-confirm: reveal phase
  if (postConfirm?.phase === "reveal") {
    const { beats, verdict, matchResult, picks } = postConfirm;
    return (
      <div className="bolado-root">
        <MatchReveal
          beats={beats}
          matchLabel={challenge.themeLabel}
          totalUserGoals={matchResult.userGoals}
          totalOppGoals={matchResult.opponentGoals}
          onComplete={() => {
            // Fire daily_completed only when transitioning from reveal, not on
            // day-locked reloads (those start directly in "verdict" phase).
            trackFirstPartyEvent("daily_completed", {
              challengeId: challenge.id,
              stars: verdict.stars,
              points: verdict.points,
            });
            setPostConfirm({ phase: "verdict", verdict, matchResult, picks, beats });
          }}
        />
      </div>
    );
  }

  // ── Post-confirm: verdict phase
  if (postConfirm?.phase === "verdict") {
    const { verdict, matchResult, picks, beats } = postConfirm;
    return (
      <div className="bolado-root">
        <VerdictScreen
          verdict={verdict}
          matchResult={matchResult}
          picks={picks}
          challengeNumber={challenge.id}
          challengeFlags={challenge.flags}
          onReplayReveal={() => {
            setPostConfirm({ phase: "reveal", beats, verdict, matchResult, picks });
          }}
        />
      </div>
    );
  }

  // ── Main game: pick screen
  return (
    <div className="bolado-root">
      <CompleteXiScreen
        challenge={challenge}
        onConfirm={(picks) => {
          // Run simulation + scoring + script generation
          const matchResult = playDailyMatch(challenge, picks);
          const verdict = scorePerformance(challenge, picks, matchResult);
          const beats = buildMatchScript(challenge, picks, matchResult);

          // Persist
          const record = buildDayRecord(challenge.id, picks, verdict, matchResult);
          saveDayRecord(record);

          // Transition to reveal
          setPostConfirm({ phase: "reveal", beats, verdict, matchResult, picks });
        }}
      />
    </div>
  );
}
