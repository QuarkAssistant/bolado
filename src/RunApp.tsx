/**
 * RunApp — the Bolado v2 app shell (Phase B, spec §3).
 *
 * A thin face over the run engine: every game action is a RunDecision
 * dispatched through applyDecision; this file NEVER computes game logic.
 * Screens mirror RunState.phase:
 *
 *   (no run)      → Home (first visit: 3-panel onboarding overlay)
 *   "shop"        → Mercado  ⇄  Pre-match (UI-level confrontation step)
 *   "match"       → Transmissão (RunBroadcast) → receipts → Mercado
 *   "dead"        → Transmissão → receipts → Death framing → BORA DE NOVO
 *   "champion"    → Transmissão → receipts → Glory framing → BORA DE NOVO
 *
 * The in-progress run persists to localStorage as {seed, decisions log}
 * and resumes by pure replay (src/run/persistence.ts). The broadcast is
 * rebuilt deterministically from the replayed state, so a reload mid-match
 * simply replays the transmissão (skippable as always).
 */

import { useCallback, useMemo, useState } from "react";
import { MercadoScreen } from "./MercadoScreen";
import { RunBroadcast } from "./RunBroadcast";
import { buildRunMatchScript } from "./run/runMatchScript";
import { awayDebuff, computeRunSquadStrength } from "./run/playRunMatch";
import { libertadoresOpponentMeta } from "./run/libertadores";
import {
  RUN_STORAGE_KEY,
  competitionForRun,
  deserializeRun,
  restoreRun,
  serializeRun,
} from "./run/persistence";
import {
  applyDecision,
  startRun,
  type RunDecision,
  type RunState,
} from "./run/runState";
import { WIN_COINS } from "./run/economy";
import type { MatchRecord } from "./run/runState";
import type { StageDef } from "./run/types";

// ---------------------------------------------------------------------------
// Persistence plumbing
// ---------------------------------------------------------------------------

interface ShellState {
  run: RunState | null;
  /** Pre-match confrontation shown (engine phase is still "shop"). */
  atPreMatch: boolean;
}

function loadShell(): ShellState {
  try {
    const saved = deserializeRun(window.localStorage.getItem(RUN_STORAGE_KEY));
    if (!saved) return { run: null, atPreMatch: false };
    const run = restoreRun(saved);
    if (!run) {
      window.localStorage.removeItem(RUN_STORAGE_KEY);
      return { run: null, atPreMatch: false };
    }
    return { run, atPreMatch: saved.atPreMatch && run.phase === "shop" };
  } catch {
    return { run: null, atPreMatch: false };
  }
}

function persistShell(run: RunState, atPreMatch: boolean): void {
  try {
    window.localStorage.setItem(
      RUN_STORAGE_KEY,
      serializeRun({
        v: 1,
        seed: run.seed,
        mode: run.mode,
        decisions: run.decisionsLog,
        atPreMatch,
      }),
    );
  } catch {
    /* storage full/blocked — the run simply won't survive a reload */
  }
}

function clearShell(): void {
  try {
    window.localStorage.removeItem(RUN_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

function freshSeed(): string {
  return `livre-${Date.now().toString(36)}-${Math.floor(Math.random() * 0xffffff).toString(36)}`;
}

// ---------------------------------------------------------------------------
// Shared chrome
// ---------------------------------------------------------------------------

export function StagePips({ run }: { run: RunState }) {
  return (
    <div className="bld-stages run-pips" aria-label="Progresso da run">
      {run.competition.stages.map((stage, index) => {
        const classes = ["bld-pip"];
        if (stage.elimination) classes.push("bld-pip--boss");
        if (index < run.stageIndex) classes.push("bld-pip--done");
        if (index === run.stageIndex) classes.push("bld-pip--current");
        return <span key={stage.id} className={classes.join(" ")} title={stage.label} />;
      })}
    </div>
  );
}

export function TopBar({ run }: { run: RunState }) {
  return (
    <div className="run-topbar">
      <div className="run-wordmark">
        Bola<em>do</em>
      </div>
      <div className="run-topbar__right">
        <span className="run-scorechip">
          {run.score}
          <small>pts</small>
        </span>
        <span className="bld-coin bld-coin--wallet">{run.coins}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Home
// ---------------------------------------------------------------------------

function HomeScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="run-home">
      <h1 className="run-home__wordmark">
        Bola<em>do</em>
      </h1>
      <span className="bld-strap bld-strap--gold">
        <span>Libertadores</span>
      </span>
      <p className="run-home__tagline run-muted">
        Monte um time de lendas, sobreviva ao grupo e derrube os monstros do
        mata-mata. Perdeu? Bora de novo.
      </p>
      <button type="button" className="bld-btn bld-btn--primary bld-btn--big" onClick={onStart}>
        <span>Bora ▶</span>
      </button>
      <span className="bld-label">Run livre · a Run Diária chega em breve</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pre-match — the confrontation
// ---------------------------------------------------------------------------

function PreMatchScreen({
  run,
  onKickoff,
  onBack,
}: {
  run: RunState;
  onKickoff: () => void;
  onBack: () => void;
}) {
  const stage = run.competition.stages[run.stageIndex]!;
  const meta = libertadoresOpponentMeta(stage.opponent.name);
  // Engine-computed numbers only: base squad força + the away debuff rule.
  const forca = computeRunSquadStrength(run.squad).overall;
  const debuff = awayDebuff(stage.homeAway, stage.opponent);
  const rule = run.competition.groupRule;

  return (
    <div className="run-prematch">
      <span className="bld-strap">
        <span>{stage.label}</span>
      </span>

      <div className="run-vs">
        <div className="run-vs__side">
          <span className="bld-label">Seu time</span>
          <span className="run-vs__name">Bolado FC</span>
          <span className="run-vs__rating">{forca}</span>
          <span className="bld-label">força</span>
        </div>
        <span className="run-vs__x">×</span>
        <div className="run-vs__side">
          <span className="bld-label">{meta ? `${meta.country} ${meta.era}` : "adversário"}</span>
          <span className="run-vs__name">{stage.opponent.name}</span>
          <span className="run-vs__rating">{stage.opponent.rating}</span>
          <span className="bld-label">força</span>
        </div>
      </div>

      <div className="run-stakes">
        <span className={`run-badge${stage.homeAway === "away" ? " run-badge--danger" : ""}`}>
          {stage.homeAway === "home" ? "Em casa" : "Fora de casa"}
        </span>
        {debuff > 0 && (
          <span className="bld-label" style={{ color: "var(--bld-red-300)" }}>
            {stage.opponent.altitude ? `Altitude: −${debuff} força` : `Fora: −${debuff} força`}
          </span>
        )}
      </div>

      <p className="run-flavor">“{stage.opponent.flavor}”</p>

      <div className="run-stakes">
        <span className="bld-label">Vitória paga</span>
        <span className="bld-coin">{WIN_COINS}</span>
        {stage.elimination ? (
          <span className="bld-label" style={{ color: "var(--bld-red-300)" }}>
            Derrota: fim da run
          </span>
        ) : (
          rule && (
            <span className="bld-label">
              Grupo: {run.groupPoints}/{rule.qualifyPoints} pts
            </span>
          )
        )}
      </div>

      <div className="run-cta-row">
        <button type="button" className="bld-btn bld-btn--secondary" onClick={onBack}>
          <span>◀ Mercado</span>
        </button>
        <button
          type="button"
          className="bld-btn bld-btn--primary bld-btn--big"
          onClick={onKickoff}
        >
          <span>Bola rolando ▶</span>
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Full-time — broadcast STUB (instant result; agent 2 ships the real one)
// ---------------------------------------------------------------------------

function abbrev(name: string): string {
  const letters = name.replace(/[^\p{L}]/gu, "").toUpperCase();
  const short = letters.slice(0, 3) || "ADV";
  // Never collide with the user's own scorebug tag (Bolívar → BOLÍ, not BOL).
  return short === "BOL" ? letters.slice(0, 4) : short;
}

function Receipt({
  title,
  lines,
  total,
  totalLabel,
}: {
  title: string;
  lines: Array<{ label: string; text: string }>;
  total: string;
  totalLabel: string;
}) {
  return (
    <div className="run-receipt">
      <span className="bld-label run-receipt__title">{title}</span>
      {lines.map((line, i) => (
        <div key={i} className="run-receipt__line">
          <span>{line.label}</span>
          <strong>{line.text}</strong>
        </div>
      ))}
      <div className="run-receipt__total">
        <span>{totalLabel}</span>
        <span>{total}</span>
      </div>
    </div>
  );
}

function MatchSummary({ run, record, stage }: { run: RunState; record: MatchRecord; stage: StageDef }) {
  const r = record.result;
  return (
    <>
      <div className="run-fulltime__bughold">
        <div className="bld-scorebug">
          <span className="bld-scorebug__comp">Libertadores · {stage.label}</span>
          <div className="bld-scorebug__row">
            <span className="bld-scorebug__team">BOL</span>
            <span className="bld-scorebug__score">
              {r.userGoals}–{r.opponentGoals}
            </span>
            <span className="bld-scorebug__team">{abbrev(stage.opponent.name)}</span>
            <span className="bld-scorebug__clock">FIM</span>
          </div>
        </div>
      </div>

      {record.cardFirings.length > 0 && (
        <div className="run-toast-stack" aria-label="Cartas que ativaram">
          {record.cardFirings.map((firing, i) => (
            <div key={i} className="bld-toast" role="status">
              <span>{firing.label}</span>
            </div>
          ))}
        </div>
      )}

      {r.goalEvents.length > 0 && (
        <ul className="run-goals">
          {r.goalEvents.map((goal, i) => (
            <li key={i} className="bld-ticker">
              <span
                className="bld-ticker__tag"
                style={
                  goal.side === "user"
                    ? { background: "var(--bld-field-500)", color: "var(--bld-flood-0)" }
                    : undefined
                }
              >
                {goal.minute}&apos;
              </span>
              <span className="bld-ticker__text">
                {goal.side === "user" ? "GOL! " : "Gol deles… "}
                {goal.scorer}
              </span>
            </li>
          ))}
        </ul>
      )}
      {r.viaPenalties && (
        <span className="bld-label" style={{ textAlign: "center" }}>
          decidido nos pênaltis
        </span>
      )}

      <div className="run-receipt-grid">
        <Receipt
          title="Pontos da partida"
          lines={record.scoreBreakdown.lines.map((line) => ({
            label: line.label,
            text: line.mult !== undefined ? `×${line.mult}` : `+${line.value}`,
          }))}
          total={`${record.scoreBreakdown.total} pts`}
          totalLabel="Partida"
        />
        <Receipt
          title="Moedas"
          lines={record.coinBreakdown.lines.map((line) => ({
            label: line.label,
            text: `+${line.value}`,
          }))}
          total={`+${record.coinBreakdown.total}`}
          totalLabel="Total"
        />
      </div>

      <div className="run-stakes">
        <span className="bld-label">Run: {run.score} pts</span>
        <span className="bld-coin">{run.coins}</span>
      </div>
    </>
  );
}

function FullTimeScreen({
  run,
  onContinue,
  continueLabel,
}: {
  run: RunState;
  onContinue: () => void;
  continueLabel: string;
}) {
  const record = run.matchHistory[run.matchHistory.length - 1]!;
  const stage = run.competition.stages.find((s) => s.id === record.stageId)!;
  const r = record.result;
  const verdict =
    r.outcome === "win"
      ? r.viaPenalties
        ? "Vitória nos pênaltis!"
        : "Vitória!"
      : r.outcome === "draw"
        ? "Empate."
        : "Derrota.";

  return (
    <div className="run-fulltime">
      <div className="run-label-row">
        <span className="bld-strap">
          <span>{verdict}</span>
        </span>
      </div>
      <MatchSummary run={run} record={record} stage={stage} />
      <div className="run-cta-row">
        <button
          type="button"
          className="bld-btn bld-btn--primary bld-btn--big"
          data-testid="run-continue"
          onClick={onContinue}
        >
          <span>{continueLabel}</span>
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Transmissão wrapper — builds the deterministic script for the last match
// ---------------------------------------------------------------------------

function MatchBroadcast({ run, onComplete }: { run: RunState; onComplete: () => void }) {
  const record = run.matchHistory[run.matchHistory.length - 1]!;
  const stage = run.competition.stages.find((s) => s.id === record.stageId)!;
  const stageIndex = run.competition.stages.indexOf(stage);

  const beats = useMemo(
    () =>
      buildRunMatchScript(record.result, record.cardFirings, stage.opponent, {
        seed: `${run.seed}:match:${stageIndex}`,
        stage,
        squad: run.squad,
      }),
    [record, stage, stageIndex, run.seed, run.squad],
  );

  return (
    <RunBroadcast
      beats={beats}
      compLabel={`Libertadores · ${stage.label}`}
      userTag="BOL"
      opponentTag={abbrev(stage.opponent.name)}
      onComplete={onComplete}
    />
  );
}

// ---------------------------------------------------------------------------
// Death / Glory
// ---------------------------------------------------------------------------

/** "O que faltou" — one-line diagnosis from engine-computed numbers. */
function diagnosis(run: RunState): string {
  const record = run.matchHistory[run.matchHistory.length - 1];
  if (!record) return "O que faltou: a run nem começou direito.";
  const stage = run.competition.stages.find((s) => s.id === record.stageId);
  const rule = run.competition.groupRule;
  if (stage && !stage.elimination && rule) {
    const missing = rule.qualifyPoints - run.groupPoints;
    return `O que faltou: ${missing} ponto${missing === 1 ? "" : "s"} para sair do grupo (${run.groupPoints}/${rule.qualifyPoints}).`;
  }
  const r = record.result;
  if (r.userStrength.defense < r.opponentRating) {
    return `O que faltou: defesa ${r.userStrength.defense} contra um adversário ${r.opponentRating} — reforce a zaga.`;
  }
  return `O que faltou: força ${r.userStrength.overall} contra ${r.opponentRating} — o elenco parou de crescer.`;
}

function DeathScreen({ run, onRestart }: { run: RunState; onRestart: () => void }) {
  const record = run.matchHistory[run.matchHistory.length - 1];
  return (
    <div className="bld-screen bld-screen--death">
      <span className="bld-strap bld-strap--danger">
        <span>Fim da run</span>
      </span>
      <p className="bld-screen__title">Eliminado</p>
      <span className="bld-screen__scoreline">{run.score} pts</span>
      {record && (
        <span className="bld-label">
          {record.result.userGoals}–{record.result.opponentGoals} vs{" "}
          {run.competition.stages.find((s) => s.id === record.stageId)?.opponent.name}
        </span>
      )}
      <p className="bld-screen__verdict">{diagnosis(run)}</p>
      {run.cards.length > 0 && (
        <span className="bld-label">Build: {run.cards.map((c) => c.name).join(" + ")}</span>
      )}
      <button
        type="button"
        className="bld-btn bld-btn--primary bld-btn--big"
        onClick={onRestart}
      >
        <span>Bora de novo</span>
      </button>
    </div>
  );
}

function GloryScreen({ run, onRestart }: { run: RunState; onRestart: () => void }) {
  return (
    <div className="bld-screen bld-screen--glory">
      <span className="bld-strap bld-strap--gold">
        <span>Campeão</span>
      </span>
      <p className="bld-screen__title">Glória eterna</p>
      <span className="bld-screen__scoreline">{run.score} pts</span>
      <p className="bld-screen__verdict">
        {run.cards.length > 0
          ? `Build: ${run.cards.map((c) => c.name).join(" + ")}`
          : "Na raça, sem carta nenhuma."}
      </p>
      <button
        type="button"
        className="bld-btn bld-btn--primary bld-btn--big"
        onClick={onRestart}
      >
        <span>Bora de novo</span>
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

/** Post-kickoff UI sequence: transmissão → receipts → verdict screen. */
type MatchView = "broadcast" | "receipts" | "verdict";

export default function RunApp() {
  const [shell, setShell] = useState<ShellState>(loadShell);

  // Keyed by (seed, matches played) so every new match restarts the sequence.
  const [matchViewState, setMatchViewState] = useState<{ key: string; view: MatchView }>({
    key: "",
    view: "broadcast",
  });

  const dispatch = useCallback((decision: RunDecision) => {
    setShell((prev) => {
      if (!prev.run) return prev;
      try {
        const run = applyDecision(prev.run, decision);
        const atPreMatch = prev.atPreMatch && run.phase === "shop" && decision.type !== "kickoff";
        persistShell(run, atPreMatch);
        return { run, atPreMatch };
      } catch (error) {
        // The UI disables illegal moves; this is belt-and-suspenders.
        console.warn("[bolado] illegal decision ignored:", error);
        return prev;
      }
    });
  }, []);

  const startNewRun = useCallback(() => {
    const seed = freshSeed();
    const run = startRun(seed, "libertadores", {
      competition: competitionForRun("libertadores", seed),
    });
    persistShell(run, false);
    setShell({ run, atPreMatch: false });
  }, []);

  const abandon = useCallback(() => {
    clearShell();
    setShell({ run: null, atPreMatch: false });
  }, []);

  const setPreMatch = useCallback((atPreMatch: boolean) => {
    setShell((prev) => {
      if (!prev.run) return prev;
      persistShell(prev.run, atPreMatch);
      return { ...prev, atPreMatch };
    });
  }, []);

  const { run, atPreMatch } = shell;

  const matchKey = run ? `${run.seed}:${run.matchHistory.length}` : "";
  const matchView = matchViewState.key === matchKey ? matchViewState.view : "broadcast";
  const setMatchView = useCallback(
    (view: MatchView) => setMatchViewState({ key: matchKey, view }),
    [matchKey],
  );

  let screen: React.ReactNode;
  if (!run) {
    screen = <HomeScreen onStart={startNewRun} />;
  } else if (run.phase === "shop" && !atPreMatch) {
    screen = (
      <>
        <TopBar run={run} />
        <StagePips run={run} />
        <MercadoScreen
          run={run}
          dispatch={dispatch}
          onGoToMatch={() => setPreMatch(true)}
          onAbandon={abandon}
        />
      </>
    );
  } else if (run.phase === "shop") {
    screen = (
      <>
        <TopBar run={run} />
        <StagePips run={run} />
        <PreMatchScreen
          run={run}
          onKickoff={() => dispatch({ type: "kickoff" })}
          onBack={() => setPreMatch(false)}
        />
      </>
    );
  } else if (matchView === "broadcast" && run.matchHistory.length > 0) {
    // match | dead | champion — the transmissão plays first, spoiler-free
    // (no TopBar: the run score already includes this match's points).
    screen = <MatchBroadcast run={run} onComplete={() => setMatchView("receipts")} />;
  } else if (run.phase === "match" || matchView === "receipts") {
    const continueLabel =
      run.phase === "match"
        ? "Voltar ao Mercado ▶"
        : run.phase === "dead"
          ? "E agora? ▶"
          : "A TAÇA ▶";
    screen = (
      <>
        <TopBar run={run} />
        <StagePips run={run} />
        <FullTimeScreen
          run={run}
          continueLabel={continueLabel}
          onContinue={() =>
            run.phase === "match" ? dispatch({ type: "advance" }) : setMatchView("verdict")
          }
        />
      </>
    );
  } else if (run.phase === "dead") {
    screen = <DeathScreen run={run} onRestart={() => { clearShell(); startNewRun(); }} />;
  } else {
    screen = <GloryScreen run={run} onRestart={() => { clearShell(); startNewRun(); }} />;
  }

  return (
    <div className="bld-stage-bg bld-grain run-viewport">
      <div className="run-frame">{screen}</div>
    </div>
  );
}
