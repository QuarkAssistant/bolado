/**
 * MercadoScreen — O MERCADO, the heart of the run (spec §3.1 step 2).
 *
 * Built to the visual contract (design/mock.html, .bld-* components):
 * dice draft → card offers → squad strip → BORA. Every interaction
 * dispatches a RunDecision; illegal moves are prevented with disabled
 * states — this file computes ZERO game logic (costs, legality and
 * outcomes all come from the engine's exported rules).
 */

import { useEffect, useRef, useState } from "react";
import { canFill } from "./positionFit";
import { MAX_ACTIVE_CARDS, type CardDef } from "./run/cards";
import { REROLL_COST, sellValue, signingCost } from "./run/economy";
import { libertadoresOpponentMeta } from "./run/libertadores";
import type { DraftOffer, RunDecision, RunState } from "./run/runState";
import { FORMATIONS, type FormationId } from "./run/types";
import type { NationPlayer } from "./types";

// ---------------------------------------------------------------------------
// Presentation tables
// ---------------------------------------------------------------------------

const SHIRT_NUMBERS: Record<FormationId, number[]> = {
  "4-3-3": [1, 2, 3, 4, 6, 5, 8, 10, 7, 9, 11],
  "4-4-2": [1, 2, 3, 4, 6, 7, 5, 10, 11, 9, 8],
  "3-5-2": [1, 3, 4, 6, 2, 5, 10, 8, 7, 9, 11],
};

const RARITY_LABEL: Record<CardDef["rarity"], string> = {
  comum: "Comum",
  rara: "Rara",
  lendaria: "Lendária",
};

const CATEGORY_LABEL: Record<CardDef["category"], string> = {
  tatica: "Tática",
  vestiario: "Vestiário",
  varzea: "Várzea",
  lendaria: "Lendária",
};

function rarityClass(rarity: CardDef["rarity"]): string {
  return rarity === "comum" ? "" : ` bld-figurinha--${rarity}`;
}

/** costTier 5 → lendária foil, 4 → rara seal, rest chalk (figurinha hook). */
function tierRarity(costTier: NationPlayer["costTier"]): CardDef["rarity"] {
  return costTier === 5 ? "lendaria" : costTier === 4 ? "rara" : "comum";
}

const DICE_ROLL_MS = 360; // + reveal transition stays ≤400ms total

// ---------------------------------------------------------------------------
// Figurinhas
// ---------------------------------------------------------------------------

function PlayerFigurinha({
  player,
  selected,
  inSquad,
  onClick,
}: {
  player: NationPlayer;
  selected: boolean;
  inSquad: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`run-figbtn run-deal bld-anim bld-figurinha${rarityClass(tierRarity(player.costTier))}${selected ? " run-figbtn--selected" : ""}`}
      onClick={onClick}
      disabled={inSquad}
      aria-pressed={selected}
    >
      <span className="bld-figurinha__face">
        <span className="bld-figurinha__portrait">
          <span className="run-pos-badge">{player.positions[0]}</span>
          <span className="bld-figurinha__rarity">
            {inSquad ? "No elenco" : RARITY_LABEL[tierRarity(player.costTier)]}
          </span>
        </span>
        <span className="bld-figurinha__name">{player.displayName}</span>
        <span className="bld-figurinha__effect">
          ATA {player.attack} · MEI {player.midfield} · DEF {player.defense}
          <br />
          {player.eraBand}
        </span>
        <span className="bld-figurinha__bottom">
          <span className="bld-figurinha__tag">{player.positions.join("/")}</span>
          <span className="bld-coin bld-coin--cost">{signingCost(player.costTier)}</span>
        </span>
      </span>
    </button>
  );
}

function CardFigurinha({
  card,
  mini,
  selected,
  priceText,
  onClick,
}: {
  card: CardDef;
  mini?: boolean;
  selected: boolean;
  priceText?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`run-figbtn bld-figurinha${rarityClass(card.rarity)}${mini ? " bld-figurinha--mini" : ""}${selected ? " run-figbtn--selected" : ""}`}
      onClick={onClick}
      aria-pressed={selected}
    >
      <span className="bld-figurinha__face">
        <span className="bld-figurinha__portrait">
          <span className="bld-figurinha__emoji">{card.emoji}</span>
          <span className="bld-figurinha__rarity">{RARITY_LABEL[card.rarity]}</span>
        </span>
        <span className="bld-figurinha__name">{card.name}</span>
        <span className="bld-figurinha__effect">{card.description}</span>
        <span className="bld-figurinha__bottom">
          <span className="bld-figurinha__tag">{CATEGORY_LABEL[card.category]}</span>
          {priceText !== undefined ? (
            <span className="bld-coin bld-coin--cost">{priceText}</span>
          ) : (
            <span className="bld-figurinha__tag">ativa</span>
          )}
        </span>
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// The screen
// ---------------------------------------------------------------------------

export function MercadoScreen({
  run,
  dispatch,
  onGoToMatch,
  onAbandon,
}: {
  run: RunState;
  dispatch: (decision: RunDecision) => void;
  onGoToMatch: () => void;
  onAbandon: () => void;
}) {
  const shop = run.shop!;
  const stage = run.competition.stages[run.stageIndex]!;
  const meta = libertadoresOpponentMeta(stage.opponent.name);
  const formationSlots = FORMATIONS[run.squad.formation];
  const occupantIds = new Set([...run.squad.slots.values()].map((p) => p.id));

  const [rolling, setRolling] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [offerCardId, setOfferCardId] = useState<string | null>(null);
  const [ownedCardId, setOwnedCardId] = useState<string | null>(null);
  const [inspectSlotId, setInspectSlotId] = useState<string | null>(null);
  const rollTimer = useRef<number | undefined>(undefined);

  // New shop (next stage) → drop every local selection.
  useEffect(() => {
    setSelectedPlayerId(null);
    setSelectedSlotId(null);
    setOfferCardId(null);
    setOwnedCardId(null);
    setInspectSlotId(null);
  }, [run.stageIndex]);

  useEffect(() => () => window.clearTimeout(rollTimer.current), []);

  const rollDice = (type: "roll" | "reroll") => {
    if (rolling) return;
    setSelectedPlayerId(null);
    setSelectedSlotId(null);
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
    if (reduced) {
      dispatch({ type });
      return;
    }
    setRolling(true);
    rollTimer.current = window.setTimeout(() => {
      setRolling(false);
      dispatch({ type });
    }, DICE_ROLL_MS);
  };

  // ── derived UI state (engine values only) ──────────────────────────────
  const selectedPlayer =
    shop.diceOffers.flatMap((o: DraftOffer) => o.players).find((p) => p.id === selectedPlayerId) ??
    null;
  const signingPrice = selectedPlayer ? signingCost(selectedPlayer.costTier) : 0;
  const canAffordSigning = selectedPlayer !== null && run.coins >= signingPrice;
  const replacedPlayer = selectedSlotId ? (run.squad.slots.get(selectedSlotId) ?? null) : null;

  const freeReroll = shop.freeReroll && shop.rerollsUsed === 0;
  const rerollPrice = freeReroll ? 0 : REROLL_COST;

  const offerCard = shop.cardOffers.find((c) => c.id === offerCardId) ?? null;
  const ownedCard = run.cards.find((c) => c.id === ownedCardId) ?? null;
  const cardsFull = run.cards.length >= MAX_ACTIVE_CARDS;
  const inspectPlayer = inspectSlotId ? (run.squad.slots.get(inspectSlotId) ?? null) : null;

  return (
    <div className="bld-shop">
      <header className="bld-shop__header">
        <h2 className="bld-strap bld-strap--gold" style={{ margin: 0 }}>
          <span>O Mercado</span>
        </h2>
        <span className="bld-label">
          {stage.label} — próximo: {meta?.country ? `${meta.country} ` : ""}
          {stage.opponent.name} ({stage.homeAway === "home" ? "casa" : "fora"})
        </span>
      </header>

      {shop.enterFirings.length > 0 && (
        <div className="run-toast-stack" aria-label="Cartas ativas no mercado">
          {shop.enterFirings.map((firing) => (
            <div key={firing.cardId} className="bld-toast bld-anim" role="status">
              <span>{firing.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── THE DICE ─────────────────────────────────────────────────── */}
      <div className="bld-shop__section">
        {!shop.signClosed ? (
          <>
            <div className="run-dice-row">
              <button
                type="button"
                className={`bld-dice${rolling ? " bld-dice--rolling bld-anim" : ""}`}
                aria-label="Rolar o dado: lendas aleatórias"
                onClick={() => rollDice(shop.rolled ? "reroll" : "roll")}
                disabled={rolling || (shop.rolled && run.coins < rerollPrice)}
              />
              <div className="run-dice-copy">
                <span className="bld-label">Rolar o dado</span>
                <p>
                  Um time de lendas aparece. Contrate <strong>UM</strong> jogador para o seu
                  elenco. Rerolar custa{" "}
                  <strong style={{ color: "var(--bld-gold-300)" }}>{REROLL_COST}</strong>.
                </p>
              </div>
              {shop.rolled && !rolling && (
                <div className="run-offer-actions">
                  <button
                    type="button"
                    className="bld-btn bld-btn--secondary"
                    onClick={() => rollDice("reroll")}
                    disabled={run.coins < rerollPrice}
                  >
                    <span>Rerolar · {freeReroll ? "grátis" : rerollPrice}</span>
                  </button>
                  <button
                    type="button"
                    className="run-linkbtn"
                    onClick={() => {
                      setSelectedPlayerId(null);
                      setSelectedSlotId(null);
                      dispatch({ type: "skipSign" });
                    }}
                  >
                    Dispensar oferta
                  </button>
                </div>
              )}
            </div>

            {shop.rolled &&
              !rolling &&
              shop.diceOffers.map((offer: DraftOffer) => (
                <div key={offer.id}>
                  <div className="run-offer-head">
                    <span className="bld-strap">
                      <span>{offer.label}</span>
                    </span>
                  </div>
                  <div className="run-card-row">
                    {offer.players.map((player) => (
                      <PlayerFigurinha
                        key={player.id}
                        player={player}
                        selected={player.id === selectedPlayerId}
                        inSquad={occupantIds.has(player.id)}
                        onClick={() => {
                          setSelectedPlayerId((cur) => (cur === player.id ? null : player.id));
                          setSelectedSlotId(null);
                          setInspectSlotId(null);
                        }}
                      />
                    ))}
                  </div>
                </div>
              ))}

            {selectedPlayer && (
              <div className="run-panel">
                <p className="run-panel__title">Contratar {selectedPlayer.displayName}</p>
                <p className="run-panel__text">
                  Toque numa camisa <strong>verde</strong> na escalação para escolher quem sai
                  ({selectedPlayer.positions.join("/")}).
                  {replacedPlayer && (
                    <>
                      {" "}
                      Sai: <strong>{replacedPlayer.displayName}</strong>.
                    </>
                  )}
                  {!canAffordSigning && (
                    <>
                      {" "}
                      <strong style={{ color: "var(--bld-red-300)" }}>
                        Faltam {signingPrice - run.coins} moedas.
                      </strong>
                    </>
                  )}
                </p>
                <div className="run-panel__actions">
                  <button
                    type="button"
                    className="bld-btn bld-btn--primary"
                    disabled={!selectedSlotId || !canAffordSigning}
                    onClick={() => {
                      if (!selectedSlotId) return;
                      dispatch({
                        type: "sign",
                        playerId: selectedPlayer.id,
                        slotId: selectedSlotId,
                      });
                      setSelectedPlayerId(null);
                      setSelectedSlotId(null);
                    }}
                  >
                    <span>Contratar · {signingPrice}</span>
                  </button>
                  <button
                    type="button"
                    className="bld-btn bld-btn--secondary"
                    onClick={() => {
                      setSelectedPlayerId(null);
                      setSelectedSlotId(null);
                    }}
                  >
                    <span>Cancelar</span>
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <span className="bld-label">Janela de contratação fechada para esta etapa.</span>
        )}
      </div>

      {/* ── CARTAS DE BOLEIRO ────────────────────────────────────────── */}
      <div className="bld-shop__section">
        <div className="run-label-row">
          <span className="bld-label">Cartas de Boleiro · máx {MAX_ACTIVE_CARDS} ativas</span>
          <span className="bld-label">
            {run.cards.length}/{MAX_ACTIVE_CARDS}
          </span>
        </div>
        {shop.cardOffers.length > 0 ? (
          <div className="run-card-row">
            {shop.cardOffers.map((card) => (
              <CardFigurinha
                key={card.id}
                card={card}
                selected={card.id === offerCardId}
                priceText={String(card.price)}
                onClick={() => setOfferCardId((cur) => (cur === card.id ? null : card.id))}
              />
            ))}
          </div>
        ) : (
          <p className="run-muted">Banca vazia — as cartas desta parada já foram.</p>
        )}

        {offerCard && (
          <div className="run-panel">
            <p className="run-panel__title">
              {offerCard.emoji} {offerCard.name} · {RARITY_LABEL[offerCard.rarity]}
            </p>
            <p className="run-panel__text">{offerCard.description}</p>
            {cardsFull && (
              <p className="run-panel__text" style={{ color: "var(--bld-red-300)" }}>
                Limite de {MAX_ACTIVE_CARDS} cartas — venda uma antes.
              </p>
            )}
            {!cardsFull && run.coins < offerCard.price && (
              <p className="run-panel__text" style={{ color: "var(--bld-red-300)" }}>
                Faltam {offerCard.price - run.coins} moedas.
              </p>
            )}
            <div className="run-panel__actions">
              <button
                type="button"
                className="bld-btn bld-btn--primary"
                disabled={cardsFull || run.coins < offerCard.price}
                onClick={() => {
                  dispatch({ type: "buyCard", cardId: offerCard.id });
                  setOfferCardId(null);
                }}
              >
                <span>Comprar · {offerCard.price}</span>
              </button>
              <button
                type="button"
                className="bld-btn bld-btn--secondary"
                onClick={() => setOfferCardId(null)}
              >
                <span>Fechar</span>
              </button>
            </div>
          </div>
        )}

        {run.cards.length > 0 && (
          <>
            <span className="bld-label" style={{ display: "block", margin: "6px 0" }}>
              Suas cartas
            </span>
            <div className="run-card-row">
              {run.cards.map((card) => (
                <CardFigurinha
                  key={card.id}
                  card={card}
                  mini
                  selected={card.id === ownedCardId}
                  onClick={() => setOwnedCardId((cur) => (cur === card.id ? null : card.id))}
                />
              ))}
            </div>
            {ownedCard && (
              <div className="run-panel">
                <p className="run-panel__title">
                  {ownedCard.emoji} {ownedCard.name}
                </p>
                <p className="run-panel__text">{ownedCard.description}</p>
                <div className="run-panel__actions">
                  <button
                    type="button"
                    className="bld-btn bld-btn--danger"
                    onClick={() => {
                      dispatch({ type: "sellCard", cardId: ownedCard.id });
                      setOwnedCardId(null);
                    }}
                  >
                    <span>Vender · +{sellValue(ownedCard.price)}</span>
                  </button>
                  <button
                    type="button"
                    className="bld-btn bld-btn--secondary"
                    onClick={() => setOwnedCardId(null)}
                  >
                    <span>Fechar</span>
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── ESCALAÇÃO ────────────────────────────────────────────────── */}
      <div className="bld-shop__section">
        <div className="run-label-row">
          <span className="bld-label">Escalação · {run.squad.formation}</span>
          {selectedPlayer && (
            <span className="bld-label" style={{ color: "var(--bld-field-300)" }}>
              escolha a vaga
            </span>
          )}
        </div>
        <div className="bld-squad">
          {formationSlots.map((slot, index) => {
            const player = run.squad.slots.get(slot.slotId)!;
            const picking = selectedPlayer !== null;
            const compatible =
              picking && canFill(selectedPlayer!, { slotId: slot.slotId, position: slot.position });
            const classes = ["run-shirtbtn"];
            if (compatible) classes.push("run-shirtbtn--ok");
            if (slot.slotId === selectedSlotId) classes.push("run-shirtbtn--picked");
            return (
              <button
                key={slot.slotId}
                type="button"
                className={classes.join(" ")}
                disabled={picking && !compatible}
                onClick={() => {
                  if (picking) {
                    setSelectedSlotId((cur) => (cur === slot.slotId ? null : slot.slotId));
                  } else {
                    setInspectSlotId((cur) => (cur === slot.slotId ? null : slot.slotId));
                  }
                }}
              >
                <span
                  className={`bld-shirt${run.signedPlayerIds.has(player.id) ? " bld-shirt--new" : ""}`}
                >
                  <span className="bld-shirt__num">{SHIRT_NUMBERS[run.squad.formation][index]}</span>
                  <span className="bld-shirt__name">{player.displayName}</span>
                  <span className="run-shirt-pos">{slot.position}</span>
                </span>
              </button>
            );
          })}
        </div>

        {inspectPlayer && !selectedPlayer && (
          <div className="run-panel">
            <p className="run-panel__title">{inspectPlayer.displayName}</p>
            <p className="run-panel__text">
              {inspectPlayer.nation} · {inspectPlayer.eraBand} · ATA {inspectPlayer.attack} · MEI{" "}
              {inspectPlayer.midfield} · DEF {inspectPlayer.defense}
              <br />
              {inspectPlayer.bioHook}
            </p>
            <div className="run-panel__actions">
              <button
                type="button"
                className="bld-btn bld-btn--secondary"
                onClick={() => setInspectSlotId(null)}
              >
                <span>Fechar</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── BORA ─────────────────────────────────────────────────────── */}
      <div className="run-cta-row">
        <button
          type="button"
          className="bld-btn bld-btn--primary bld-btn--big"
          onClick={onGoToMatch}
        >
          <span>Ir para o jogo ▶</span>
        </button>
      </div>
      <div className="run-cta-row" style={{ marginTop: 10 }}>
        <button type="button" className="run-linkbtn" onClick={onAbandon}>
          Abandonar run
        </button>
      </div>
    </div>
  );
}
