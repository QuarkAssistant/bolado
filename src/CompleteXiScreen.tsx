/**
 * Bolado — Complete the XI pick screen (Task 1.3)
 *
 * Layout (mobile-first, thumb-zone aware):
 *   1. Challenge header (theme, flags, condition banner)
 *   2. Compact pitch: 6 pre-placed + 5 open slots in formation
 *   3. Budget meter (12 stars)
 *   4. Candidate lista (15 rows)
 *   5. ESCALAR! confirm button
 *
 * All picks flow through pickReducer — pure, TDD-verified logic.
 * Animations: ≤200ms, transform/opacity, prefers-reduced-motion safe.
 */

import { useReducer, useCallback, useRef, useState } from "react";
import type { DailyChallenge, NationPlayer, OpenSlot, PrePlacedSlot } from "./types";
import type { PickedSlot } from "./playDailyMatch";
import {
  createPickState,
  pickReducer,
  remainingBudget,
  canConfirm,
  placeableSlotIds,
  picksAsArray,
} from "./pickState";

// ---------------------------------------------------------------------------
// Formation layout: slot position → (x%, y%) on a 100×100 pitch viewport
// GK at top (1st row), defenders below, midfielders, forwards at bottom.
// We use a traditional top=opponent, bottom=user orientation (GK closest to top).
// ---------------------------------------------------------------------------

type PitchCoord = { x: number; y: number };

const POSITION_COORDS: Record<string, PitchCoord> = {
  // Goalkeeper row (y=12)
  GOL: { x: 50, y: 12 },

  // Defender row (y=28)
  LD: { x: 80, y: 28 },
  ZAG: { x: 58, y: 28 }, // first ZAG
  ZAG2: { x: 38, y: 28 }, // second ZAG (slotId-based override applied later)
  LE: { x: 18, y: 28 },

  // Midfielder row (y=52)
  VOL: { x: 50, y: 50 },
  VOL2: { x: 34, y: 50 },
  MEI: { x: 66, y: 50 },
  MEI2: { x: 34, y: 50 },

  // Wide midfield row (y=65)
  PD: { x: 80, y: 65 },
  PE: { x: 18, y: 65 },

  // Forward row (y=82)
  CA: { x: 50, y: 82 },
};

/** Map slotId → pitch coordinates for the challenge formation. */
function slotCoord(slotId: string, position: string, positionIndex: number): PitchCoord {
  // For duplicate positions (ZAG×2, VOL×2, MEI×2), use index to spread them
  const key = position;

  // Challenge-specific overrides based on slotId patterns
  // zag1 → right side, zag2 → left side
  if (position === "ZAG") {
    return positionIndex === 0
      ? { x: 60, y: 28 }
      : { x: 38, y: 28 };
  }
  if (position === "VOL") {
    return positionIndex === 0
      ? { x: 50, y: 50 }
      : { x: 34, y: 50 };
  }
  if (position === "MEI") {
    return positionIndex === 0
      ? { x: 66, y: 50 }
      : { x: 34, y: 50 };
  }

  return POSITION_COORDS[key] ?? { x: 50, y: 50 };
}

/** Assign stable coords to all 11 slots (6 pre-placed + 5 open) */
function buildSlotCoords(
  prePlaced: PrePlacedSlot[],
  openSlots: OpenSlot[],
): Map<string, PitchCoord> {
  const all = [
    ...prePlaced.map((s) => ({ slotId: s.slotId, position: s.position })),
    ...openSlots.map((s) => ({ slotId: s.slotId, position: s.position })),
  ];

  const positionCounts: Record<string, number> = {};
  const coords = new Map<string, PitchCoord>();

  for (const { slotId, position } of all) {
    const idx = positionCounts[position] ?? 0;
    positionCounts[position] = idx + 1;
    coords.set(slotId, slotCoord(slotId, position, idx));
  }
  return coords;
}

// ---------------------------------------------------------------------------
// Cost stars display
// ---------------------------------------------------------------------------

function CostStars({ cost, size = "sm" }: { cost: number; size?: "sm" | "lg" }) {
  return (
    <span
      className={`bolado-cost-stars bolado-cost-stars--${size}`}
      aria-label={`${cost} estrela${cost !== 1 ? "s" : ""}`}
    >
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          className={`bolado-star ${i < cost ? "bolado-star--on" : "bolado-star--off"}`}
          aria-hidden="true"
        >
          ★
        </span>
      ))}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Budget meter
// ---------------------------------------------------------------------------

interface BudgetMeterProps {
  spent: number;
  budget: number;
  shake: boolean;
}

function BudgetMeter({ spent, budget, shake }: BudgetMeterProps) {
  const remaining = budget - spent;
  const pct = Math.min(1, spent / budget);

  return (
    <div
      className={`bolado-budget-meter ${shake ? "bolado-budget-shake" : ""}`}
      role="meter"
      aria-valuenow={remaining}
      aria-valuemin={0}
      aria-valuemax={budget}
      aria-label={`Orçamento: ${remaining} de ${budget} estrelas restantes`}
    >
      <div className="bolado-budget-label">
        <span>Orçamento</span>
        <span className={`bolado-budget-remaining ${remaining <= 2 ? "bolado-budget-tight" : ""}`}>
          {remaining}★ restante{remaining !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="bolado-budget-track">
        <div
          className={`bolado-budget-fill ${remaining === 0 ? "bolado-budget-full" : ""} ${remaining <= 2 && remaining > 0 ? "bolado-budget-warning" : ""}`}
          style={{ transform: `scaleX(${pct})` }}
        />
      </div>
      <div className="bolado-budget-stars" aria-hidden="true">
        {Array.from({ length: budget }, (_, i) => (
          <span
            key={i}
            className={`bolado-budget-star ${i < spent ? "bolado-budget-star--spent" : "bolado-budget-star--free"}`}
          >
            ★
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pitch slot card
// ---------------------------------------------------------------------------

interface PitchSlotProps {
  slotId: string;
  position: string;
  player: NationPlayer | null;
  isOpen: boolean;
  isHighlighted: boolean; // open + selected candidate can fill
  isPlaceable: boolean;   // slot is in placeableSlotIds
  coord: PitchCoord;
  onSlotClick: (slotId: string) => void;
}

function PitchSlot({
  slotId,
  position,
  player,
  isOpen,
  isHighlighted,
  coord,
  onSlotClick,
}: PitchSlotProps) {
  const classes = [
    "bolado-pitch-slot",
    player ? "bolado-pitch-slot--filled" : "bolado-pitch-slot--empty",
    isOpen ? "bolado-pitch-slot--open" : "bolado-pitch-slot--preplaced",
    isHighlighted ? "bolado-pitch-slot--highlighted" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const label = player
    ? `${player.displayName}, ${position}${isOpen ? ", toque para remover" : ""}`
    : `Vaga ${position}${isHighlighted ? ", toque para colocar" : ""}`;

  return (
    <button
      type="button"
      className={classes}
      style={{
        left: `${coord.x}%`,
        top: `${coord.y}%`,
      }}
      onClick={() => isOpen ? onSlotClick(slotId) : undefined}
      disabled={!isOpen}
      aria-label={label}
      data-position={position}
      data-slot-id={slotId}
    >
      <span className="bolado-slot-pos">{position}</span>
      {player ? (
        <strong className="bolado-slot-name">{formatPitchName(player.displayName)}</strong>
      ) : (
        <span className="bolado-slot-pulse" aria-hidden="true" />
      )}
    </button>
  );
}

/** Truncate long names for pitch display */
function formatPitchName(name: string): string {
  const parts = name.split(" ");
  if (parts.length === 1) return name.slice(0, 8);
  // Last name or known short name
  const last = parts[parts.length - 1]!;
  return last.length <= 9 ? last : last.slice(0, 8) + ".";
}

// ---------------------------------------------------------------------------
// Pitch (compact formation view)
// ---------------------------------------------------------------------------

interface PitchProps {
  challenge: DailyChallenge;
  picks: ReadonlyMap<string, NationPlayer>;
  selectedCandidateId: string | null;
  placeableIds: string[];
  onSlotClick: (slotId: string) => void;
}

function Pitch({ challenge, picks, selectedCandidateId, placeableIds, onSlotClick }: PitchProps) {
  const coords = buildSlotCoords(challenge.prePlaced, challenge.openSlots);
  const placeableSet = new Set(placeableIds);
  const hasSelection = selectedCandidateId !== null;

  return (
    <div className="bolado-pitch" aria-label="Campo de jogo" role="group">
      <div className="bolado-pitch-field">
        <div className="bolado-pitch-circle" aria-hidden="true" />
        <div className="bolado-pitch-box bolado-pitch-box--top" aria-hidden="true" />
        <div className="bolado-pitch-box bolado-pitch-box--bottom" aria-hidden="true" />

        {/* Pre-placed slots (locked) */}
        {challenge.prePlaced.map((slot) => {
          const coord = coords.get(slot.slotId) ?? { x: 50, y: 50 };
          return (
            <PitchSlot
              key={slot.slotId}
              slotId={slot.slotId}
              position={slot.position}
              player={slot.player}
              isOpen={false}
              isHighlighted={false}
              isPlaceable={false}
              coord={coord}
              onSlotClick={onSlotClick}
            />
          );
        })}

        {/* Open slots (user fills these) */}
        {challenge.openSlots.map((slot) => {
          const coord = coords.get(slot.slotId) ?? { x: 50, y: 50 };
          const pickedPlayer = picks.get(slot.slotId) ?? null;
          const isHighlighted = hasSelection && placeableSet.has(slot.slotId);

          return (
            <PitchSlot
              key={slot.slotId}
              slotId={slot.slotId}
              position={slot.position}
              player={pickedPlayer}
              isOpen={true}
              isHighlighted={isHighlighted}
              isPlaceable={placeableSet.has(slot.slotId)}
              coord={coord}
              onSlotClick={onSlotClick}
            />
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Candidate row
// ---------------------------------------------------------------------------

interface CandidateRowProps {
  candidate: NationPlayer;
  isSelected: boolean;
  isCompatible: boolean; // has any open slot they can fill
  isAffordable: boolean; // cost fits remaining budget (accounting for refunds)
  isPlaced: boolean;     // already in a slot
  onSelect: (candidateId: string) => void;
}

function eraBandShort(era: string): string {
  // "70s-80s" → "70s", "00s-10s" → "00s", "10s-20s" → "10s"
  return era.split("-")[0] ?? era;
}

function CandidateRow({
  candidate,
  isSelected,
  isCompatible,
  isAffordable,
  isPlaced,
  onSelect,
}: CandidateRowProps) {
  const muted = !isCompatible || !isAffordable;

  const classes = [
    "bolado-candidate-row",
    isSelected ? "bolado-candidate-row--selected" : "",
    muted ? "bolado-candidate-row--muted" : "",
    isPlaced ? "bolado-candidate-row--placed" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const ariaLabel = [
    candidate.displayName,
    candidate.positions.join("/"),
    candidate.eraBand,
    `${candidate.costTier} estrelas`,
    !isCompatible ? "posição incompatível" : "",
    !isAffordable ? "orçamento insuficiente" : "",
    isPlaced ? "já escalado" : "",
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <button
      type="button"
      className={classes}
      aria-label={ariaLabel}
      aria-pressed={isSelected}
      onClick={() => onSelect(candidate.id)}
      data-testid="bolado-candidate"
    >
      <span className="bolado-candidate-pos-col">
        {candidate.positions.map((p) => (
          <b key={p} className="bolado-pos-badge">
            {p}
          </b>
        ))}
      </span>

      <span className="bolado-candidate-main">
        <span className="bolado-candidate-name">{candidate.displayName}</span>
        <span className="bolado-candidate-meta">
          <span className="bolado-era-badge">{eraBandShort(candidate.eraBand)}</span>
          <span className="bolado-candidate-bio">{candidate.bioHook}</span>
        </span>
      </span>

      <span className="bolado-candidate-right">
        <CostStars cost={candidate.costTier} />
        {isPlaced && (
          <span className="bolado-placed-badge" aria-hidden="true">
            ✓
          </span>
        )}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Candidate lista
// ---------------------------------------------------------------------------

interface CandidateListaProps {
  candidates: NationPlayer[];
  picks: ReadonlyMap<string, NationPlayer>;
  selectedCandidateId: string | null;
  placeableIds: string[];
  remainingBudget: number;
  challenge: DailyChallenge;
  onSelect: (candidateId: string) => void;
}

function CandidateLista({
  candidates,
  picks,
  selectedCandidateId,
  placeableIds,
  remainingBudget: remaining,
  challenge,
  onSelect,
}: CandidateListaProps) {
  const openSlots = challenge.openSlots;

  return (
    <div className="bolado-lista" role="listbox" aria-label="Candidatos" aria-multiselectable="false">
      <div className="bolado-lista-header">
        <span>Escolha 5 jogadores</span>
        <span className="bolado-lista-count">
          {picks.size}/5
        </span>
      </div>
      <div className="bolado-lista-rows">
        {candidates.map((candidate) => {
          const isSelected = selectedCandidateId === candidate.id;
          const isPlaced = [...picks.values()].some((p) => p.id === candidate.id);
          const placedSlotId = [...picks.entries()].find(([, p]) => p.id === candidate.id)?.[0];

          // Candidate is "compatible" if there's at least one open slot they can fill
          // (considering the candidate's current slot as "free" for move semantics)
          const candidateCurrentRefund = isPlaced ? candidate.costTier : 0;
          const isCompatible = openSlots.some((slot) => {
            if (!candidate.positions.includes(slot.position)) return false;
            return true;
          });

          // Affordable: candidate can fit in at least one slot given budget
          // Use placeableSlotIds logic: net cost ≤ remaining
          const isAffordable = openSlots.some((slot) => {
            if (!candidate.positions.includes(slot.position)) return false;
            const occupant = picks.get(slot.slotId);
            const occupantRefund =
              occupant && occupant.id !== candidate.id ? occupant.costTier : 0;
            const net = candidate.costTier - candidateCurrentRefund - occupantRefund;
            return net <= remaining;
          });

          return (
            <CandidateRow
              key={candidate.id}
              candidate={candidate}
              isSelected={isSelected}
              isCompatible={isCompatible}
              isAffordable={isAffordable}
              isPlaced={isPlaced}
              onSelect={onSelect}
            />
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Condition banner
// ---------------------------------------------------------------------------

function ConditionBanner({ challenge }: { challenge: DailyChallenge }) {
  return (
    <div className="bolado-condition-banner" role="note" aria-label="Condição do dia">
      <span className="bolado-condition-icon" aria-hidden="true">⚡</span>
      <span className="bolado-condition-text">{challenge.condition.label.pt}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

interface CompleteXiScreenProps {
  challenge: DailyChallenge;
  /** Called when the player confirms their picks. Receives the final 5 PickedSlots. */
  onConfirm: (picks: PickedSlot[]) => void;
}

export function CompleteXiScreen({ challenge, onConfirm }: CompleteXiScreenProps) {
  const [state, dispatch] = useReducer(pickReducer, challenge, createPickState);
  const [shakeBudget, setShakeBudget] = useState(false);
  const shakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const remaining = remainingBudget(state, challenge);
  const confirmed = canConfirm(state);

  // Resolve selected candidate object
  const selectedCandidate = state.selectedCandidateId
    ? (challenge.candidates.find((c) => c.id === state.selectedCandidateId) ?? null)
    : null;

  // Compute placeable slot ids for the selected candidate
  const currentPlaceableIds = selectedCandidate
    ? placeableSlotIds(state, selectedCandidate, challenge)
    : [];

  // Trigger shake animation when an over-budget placement is attempted
  function triggerBudgetShake() {
    if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
    setShakeBudget(true);
    shakeTimerRef.current = setTimeout(() => setShakeBudget(false), 500);
  }

  // Handle slot click on pitch
  const handleSlotClick = useCallback(
    (slotId: string) => {
      if (selectedCandidate) {
        // Try to place selected candidate in this slot
        const slot = challenge.openSlots.find((s) => s.slotId === slotId);
        if (!slot) return;

        // Check if this would be blocked
        const beforeSize = state.picks.size;
        const beforeBudget = state.budgetSpent;
        dispatch({
          type: "PLACE",
          candidate: selectedCandidate,
          slot,
          budget: challenge.budget,
        });
        // Note: if reducer returned same state (blocked), we'd want to shake.
        // Since we can't check state synchronously after dispatch, we detect
        // budget/compatibility issues upfront:
        const isPositionOk = selectedCandidate.positions.includes(slot.position);
        if (!isPositionOk) return; // silently ignore incompatible
        // Check if it would overspend (before dispatch executes)
        const occupant = state.picks.get(slotId);
        const candidateCurrentSlotId = [...state.picks.entries()].find(
          ([, p]) => p.id === selectedCandidate.id,
        )?.[0] ?? null;
        const candidateRefund = candidateCurrentSlotId !== null ? selectedCandidate.costTier : 0;
        const occupantRefund =
          occupant && occupant.id !== selectedCandidate.id ? occupant.costTier : 0;
        const net = selectedCandidate.costTier - candidateRefund - occupantRefund;
        if (net > remaining) {
          triggerBudgetShake();
        }
      } else {
        // No candidate selected: tapping a filled open slot removes it
        const hasPick = state.picks.has(slotId);
        if (hasPick) {
          dispatch({ type: "REMOVE", slotId });
        }
      }
    },
    [selectedCandidate, state.picks, state.budgetSpent, remaining, challenge],
  );

  const handleSelectCandidate = useCallback((candidateId: string) => {
    dispatch({ type: "SELECT_CANDIDATE", candidateId });
  }, []);

  const handleConfirm = useCallback(() => {
    if (!confirmed) return;
    onConfirm(picksAsArray(state));
  }, [confirmed, state, onConfirm]);

  const handleReset = useCallback(() => {
    dispatch({ type: "RESET" });
  }, []);

  return (
    <div className="bolado-pick-screen" data-testid="bolado-pick-screen">
      {/* ── Challenge header ── */}
      <header className="bolado-pick-header">
        <div className="bolado-pick-meta">
          <span className="bolado-pick-number">#{challenge.id}</span>
          <span className="bolado-pick-flags">{challenge.flags}</span>
        </div>
        <h2 className="bolado-pick-theme">{challenge.themeLabel}</h2>
        <p className="bolado-pick-cta">6 craques no campo. Complete com 5.</p>
        <ConditionBanner challenge={challenge} />
      </header>

      {/* ── Compact pitch ── */}
      <Pitch
        challenge={challenge}
        picks={state.picks}
        selectedCandidateId={state.selectedCandidateId}
        placeableIds={currentPlaceableIds}
        onSlotClick={handleSlotClick}
      />

      {/* ── Budget meter ── */}
      <BudgetMeter spent={state.budgetSpent} budget={challenge.budget} shake={shakeBudget} />

      {/* ── Candidate lista ── */}
      <CandidateLista
        candidates={challenge.candidates}
        picks={state.picks}
        selectedCandidateId={state.selectedCandidateId}
        placeableIds={currentPlaceableIds}
        remainingBudget={remaining}
        challenge={challenge}
        onSelect={handleSelectCandidate}
      />

      {/* ── Action row ── */}
      <div className="bolado-action-row">
        <button
          type="button"
          className="bolado-reset-btn"
          onClick={handleReset}
          aria-label="Recomeçar seleção"
          disabled={state.picks.size === 0 && state.selectedCandidateId === null}
        >
          ↺ Limpar
        </button>
        <button
          type="button"
          className={`bolado-confirm-btn ${confirmed ? "bolado-confirm-btn--ready" : ""}`}
          onClick={handleConfirm}
          disabled={!confirmed}
          aria-label={confirmed ? "Confirmar seleção e escalar o time" : "Complete os 5 jogadores para escalar"}
          data-testid="bolado-confirm-btn"
        >
          ESCALAR! ▶
        </button>
      </div>
    </div>
  );
}
