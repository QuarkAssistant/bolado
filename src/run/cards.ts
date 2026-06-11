/**
 * Cartas de Boleiro — the Balatro layer (spec v2 §4).
 *
 * Cards are passive modifiers with typed hooks fired at well-defined points:
 *   preMatch    → strength deltas (team-wide or per-slot) + structural flags
 *   onGoal      → per-goal point multipliers / coin bonuses
 *   onResult    → result-level point/coin bonuses + Catimba's override
 *   onShopEnter → shop perks (free reroll, dual dice roll)
 *   scoreMult   → final run-score multipliers
 *
 * Legibility mandate: every description states the EXACT effect in plain
 * pt-BR, and every hook that fires returns a pt-BR `label` for the broadcast
 * popup. Hooks are pure; aggregation helpers below collect per-card
 * contributions so playRunMatch/economy/scoring can both apply them and
 * record CardFirings.
 *
 * Spec adjustments (noted per card):
 *  - Lei do Ex: the draft pool is nation legends (not club rosters), so "vs
 *    their historic club" became "vs opponents from the player's country"
 *    (opponent.country tag). Same narrative, implementable today.
 *  - Volante Raçudo (designed card): spec sketch said "+2 when losing at
 *    half" — the engine has no half-time state, so it became "+2 away".
 */

import type { NationPlayer } from "../types";
import type { Position } from "../engine/types";
import { bucketForPosition } from "../teamStrength";
import { CAMISA_10_SLOT, FORMATIONS, type OpponentDef, type Squad, type StageDef } from "./types";

// ---------------------------------------------------------------------------
// Card definition
// ---------------------------------------------------------------------------

export type CardCategory = "tatica" | "vestiario" | "varzea" | "lendaria";
export type CardRarity = "comum" | "rara" | "lendaria";

export const MAX_ACTIVE_CARDS = 5;

export interface PreMatchCtx {
  squad: Squad;
  opponent: OpponentDef;
  homeAway: "home" | "away";
  stage: StageDef;
  /** True when any card was bought in the shop preceding this match. */
  boughtCardThisShop: boolean;
  /** Ids of players signed during the run (everyone except journeymen). */
  signedPlayerIds: ReadonlySet<string>;
}

export interface PreMatchEffect {
  /** Flat força delta applied to every aggregate. */
  teamDelta?: number;
  /** Per-slot delta on the occupant's contributing stat. */
  slotDeltas?: Record<string, number>;
  /** Cancels the away (and altitude) debuff. */
  negateAwayDebuff?: boolean;
  /** GK's defense also counts toward the midfield average (Paredão). */
  gkToMidfield?: boolean;
  /** Defender weight override in the scorer pool (Zagueiro Artilheiro). */
  defenderScorerWeight?: number;
  label: string;
}

export interface GoalCtx {
  side: "user" | "opponent";
  /** 0-based index of this goal within its side, in scoring order. */
  goalIndexForSide: number;
  minute: number;
  scorerSlotId?: string;
  scorerPosition?: Position;
  squad: Squad;
}

export interface GoalEffect {
  /** Multiplier applied to this goal's points (15 base). */
  pointsMult?: number;
  coinBonus?: number;
  label: string;
}

export interface ResultCtx {
  outcome: "win" | "draw" | "loss";
  userGoals: number;
  opponentGoals: number;
  viaPenalties: boolean;
  stage: StageDef;
  homeAway: "home" | "away";
}

export interface ResultEffect {
  pointsBonus?: number;
  coinBonus?: number;
  /** Catimba: send a drawn match to a penalty shootout. */
  resultOverride?: "penaltyShootout";
  label: string;
}

export interface ShopEffect {
  /** First dice reroll of this shop is free (Olheiro). */
  freeReroll?: boolean;
  /** Dice rolls reveal 2 clubs, sign from either (Maluquice). */
  dualRoll?: boolean;
  label: string;
}

export interface ScoreCtx {
  outcome: "win" | "draw" | "loss";
  userGoals: number;
  opponentGoals: number;
  stage: StageDef;
  homeAway: "home" | "away";
}

export interface CardHooks {
  preMatch?: (ctx: PreMatchCtx) => PreMatchEffect | null;
  onGoal?: (ctx: GoalCtx) => GoalEffect | null;
  onResult?: (ctx: ResultCtx) => ResultEffect | null;
  onShopEnter?: () => ShopEffect | null;
  /** Returns a multiplier (1 = inactive) applied to the match score. */
  scoreMult?: (ctx: ScoreCtx) => number;
}

export interface CardDef {
  id: string;
  name: string;
  emoji: string;
  category: CardCategory;
  rarity: CardRarity;
  /** Coins. Tuning bands: comum 3-4, rara 6-8, lendaria 10-12. */
  price: number;
  /** pt-BR, exact effect in plain words (legibility mandate). */
  description: string;
  hooks: CardHooks;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slotPosition(squad: Squad, slotId: string): Position | undefined {
  return FORMATIONS[squad.formation].find((s) => s.slotId === slotId)?.position;
}

function eachOccupant(
  squad: Squad,
  fn: (slotId: string, position: Position, player: NationPlayer) => void,
): void {
  for (const slot of FORMATIONS[squad.formation]) {
    const player = squad.slots.get(slot.slotId);
    if (player) fn(slot.slotId, slot.position, player);
  }
}

// ---------------------------------------------------------------------------
// The launch set — 20 cards
// ---------------------------------------------------------------------------

export const CARDS: CardDef[] = [
  // ——— Tática ———
  {
    id: "caldeirao",
    name: "Caldeirão",
    emoji: "📣",
    category: "tatica",
    rarity: "comum",
    price: 4,
    description: "Jogando em casa, seu time ganha +3 de força.",
    hooks: {
      preMatch: (ctx) =>
        ctx.homeAway === "home"
          ? { teamDelta: 3, label: "📣 Caldeirão: a torcida empurra, +3 força em casa!" }
          : null,
    },
  },
  {
    id: "doutor-altitude",
    name: "Doutor Altitude",
    emoji: "✈️",
    category: "tatica",
    rarity: "comum",
    price: 4,
    description: "Anula a penalidade de jogar fora de casa (inclusive na altitude).",
    hooks: {
      preMatch: (ctx) =>
        ctx.homeAway === "away"
          ? {
              negateAwayDebuff: true,
              label: "✈️ Doutor Altitude: time aclimatado, sem penalidade fora de casa!",
            }
          : null,
    },
  },
  {
    id: "mistica-da-taca",
    name: "Mística da Taça",
    emoji: "🏆",
    category: "tatica",
    rarity: "comum",
    price: 4,
    description: "Em jogos de mata-mata, seu time ganha +2 de força.",
    hooks: {
      preMatch: (ctx) =>
        ctx.stage.elimination
          ? { teamDelta: 2, label: "🏆 Mística da Taça: é mata-mata, +2 força!" }
          : null,
    },
  },
  {
    id: "catimba",
    name: "Catimba",
    emoji: "😤",
    category: "tatica",
    rarity: "rara",
    price: 8,
    description: "Empatou? O jogo vai para os pênaltis — e seu time é cascudo na marca da cal.",
    hooks: {
      onResult: (ctx) =>
        ctx.outcome === "draw"
          ? {
              resultOverride: "penaltyShootout",
              label: "😤 Catimba ativou: empate vira disputa de pênaltis!",
            }
          : null,
    },
  },
  {
    id: "artilheiro-nato",
    name: "Artilheiro Nato",
    emoji: "🎯",
    category: "tatica",
    rarity: "rara",
    price: 7,
    description: "Gols dos seus centroavantes (CA) valem o dobro de pontos.",
    hooks: {
      onGoal: (ctx) =>
        ctx.side === "user" && ctx.scorerPosition === "CA"
          ? { pointsMult: 2, label: "🎯 Artilheiro Nato: gol de centroavante vale dobrado!" }
          : null,
    },
  },
  {
    id: "joga-bonito",
    name: "Joga Bonito",
    emoji: "👟",
    category: "tatica",
    rarity: "rara",
    price: 7,
    description: "Do terceiro gol em diante na mesma partida, cada gol seu vale o dobro de pontos.",
    hooks: {
      onGoal: (ctx) =>
        ctx.side === "user" && ctx.goalIndexForSide >= 2
          ? { pointsMult: 2, label: "👟 Joga Bonito: o baile começou, gol valendo dobrado!" }
          : null,
    },
  },

  // ——— Vestiário ———
  {
    id: "maestro",
    name: "Maestro",
    emoji: "🎩",
    category: "vestiario",
    rarity: "rara",
    price: 7,
    description: "Seu camisa 10 ganha +2 de força por companheiro da mesma era no time.",
    hooks: {
      preMatch: (ctx) => {
        const slotId = CAMISA_10_SLOT[ctx.squad.formation];
        const ten = ctx.squad.slots.get(slotId);
        if (!ten) return null;
        let mates = 0;
        eachOccupant(ctx.squad, (sid, _pos, player) => {
          if (sid !== slotId && player.eraBand === ten.eraBand) mates += 1;
        });
        if (mates === 0) return null;
        const delta = 2 * mates;
        return {
          slotDeltas: { [slotId]: delta },
          label: `🎩 Maestro: ${ten.displayName} rege ${mates} da mesma era, +${delta} força!`,
        };
      },
    },
  },
  {
    id: "mago-da-varzea",
    name: "Mago da Várzea",
    emoji: "🧙",
    category: "vestiario",
    rarity: "rara",
    price: 6,
    description: "Todo jogador de tier 1 (os baratinhos) ganha +3 de força.",
    hooks: {
      preMatch: (ctx) => {
        const slotDeltas: Record<string, number> = {};
        let count = 0;
        eachOccupant(ctx.squad, (slotId, _pos, player) => {
          if (player.costTier === 1) {
            slotDeltas[slotId] = 3;
            count += 1;
          }
        });
        if (count === 0) return null;
        return {
          slotDeltas,
          label: `🧙 Mago da Várzea: ${count} baratinho(s) jogando acima do salário, +3 cada!`,
        };
      },
    },
  },
  {
    id: "lei-do-ex",
    name: "Lei do Ex",
    emoji: "⏱️",
    category: "vestiario",
    rarity: "comum",
    price: 4,
    description:
      "Jogadores contratados ganham +1 de força contra adversários do país deles. A lei do ex não perdoa.",
    hooks: {
      preMatch: (ctx) => {
        if (!ctx.opponent.country) return null;
        const slotDeltas: Record<string, number> = {};
        let count = 0;
        eachOccupant(ctx.squad, (slotId, _pos, player) => {
          if (ctx.signedPlayerIds.has(player.id) && player.nation === ctx.opponent.country) {
            slotDeltas[slotId] = 1;
            count += 1;
          }
        });
        if (count === 0) return null;
        return {
          slotDeltas,
          label: `⏱️ Lei do Ex: ${count} jogador(es) motivado(s) contra a terra natal, +1 cada!`,
        };
      },
    },
  },
  {
    id: "paredao",
    name: "Paredão",
    emoji: "🧤",
    category: "vestiario",
    rarity: "rara",
    price: 6,
    description: "A defesa do seu goleiro também conta na média do meio-campo.",
    hooks: {
      preMatch: (ctx) => {
        const gk = [...ctx.squad.slots.entries()].find(
          ([slotId]) => slotPosition(ctx.squad, slotId) === "GOL",
        );
        if (!gk) return null;
        return {
          gkToMidfield: true,
          label: `🧤 Paredão: ${gk[1].displayName} sai jogando e reforça o meio-campo!`,
        };
      },
    },
  },
  {
    id: "volante-racudo",
    name: "Volante Raçudo",
    emoji: "🐂",
    category: "vestiario",
    rarity: "comum",
    price: 3,
    description: "Fora de casa, seus volantes (VOL) ganham +2 de força. Raça pura.",
    hooks: {
      preMatch: (ctx) => {
        if (ctx.homeAway !== "away") return null;
        const slotDeltas: Record<string, number> = {};
        let count = 0;
        eachOccupant(ctx.squad, (slotId, position) => {
          if (position === "VOL") {
            slotDeltas[slotId] = 2;
            count += 1;
          }
        });
        if (count === 0) return null;
        return {
          slotDeltas,
          label: `🐂 Volante Raçudo: ${count} volante(s) na marcação, +2 cada fora de casa!`,
        };
      },
    },
  },
  {
    id: "pe-quente",
    name: "Pé Quente",
    emoji: "🔥",
    category: "vestiario",
    rarity: "comum",
    price: 3,
    description: "Comprou qualquer carta no mercado? Seu time entra com +2 de força na partida seguinte.",
    hooks: {
      preMatch: (ctx) =>
        ctx.boughtCardThisShop
          ? { teamDelta: 2, label: "🔥 Pé Quente: carta nova no bolso, +2 força!" }
          : null,
    },
  },

  // ——— Várzea (economia/sorte) ———
  {
    id: "muralha",
    name: "Muralha",
    emoji: "🧱",
    category: "varzea",
    rarity: "comum",
    price: 3,
    description: "Terminou sem sofrer gol? Ganhe +5 moedas.",
    hooks: {
      onResult: (ctx) =>
        ctx.opponentGoals === 0
          ? { coinBonus: 5, label: "🧱 Muralha: jogo sem sofrer gol, +5 moedas!" }
          : null,
    },
  },
  {
    id: "bicho-pago",
    name: "Bicho Pago",
    emoji: "🍀",
    category: "varzea",
    rarity: "comum",
    price: 3,
    description: "Toda vitória paga +2 moedas extras de bicho.",
    hooks: {
      onResult: (ctx) =>
        ctx.outcome === "win"
          ? { coinBonus: 2, label: "🍀 Bicho Pago: vitória paga +2 moedas de bicho!" }
          : null,
    },
  },
  {
    id: "olheiro",
    name: "Olheiro",
    emoji: "🔭",
    category: "varzea",
    rarity: "comum",
    price: 3,
    description: "O primeiro reroll do dado em cada mercado é de graça.",
    hooks: {
      onShopEnter: () => ({
        freeReroll: true,
        label: "🔭 Olheiro: primeiro reroll do dado é por conta da casa!",
      }),
    },
  },
  {
    id: "gol-de-placa",
    name: "Gol de Placa",
    emoji: "🥅",
    category: "varzea",
    rarity: "comum",
    price: 3,
    description: "O primeiro gol do seu time em cada partida paga +2 moedas.",
    hooks: {
      onGoal: (ctx) =>
        ctx.side === "user" && ctx.goalIndexForSide === 0
          ? { coinBonus: 2, label: "🥅 Gol de Placa: primeiro gol rende +2 moedas!" }
          : null,
    },
  },
  {
    id: "zagueiro-artilheiro",
    name: "Zagueiro Artilheiro",
    emoji: "🛡️",
    category: "varzea",
    rarity: "rara",
    price: 6,
    description:
      "Seus defensores sobem para a bola parada: marcam gols com a frequência de um atacante e cada gol deles vale o dobro de pontos.",
    hooks: {
      preMatch: () => ({
        defenderScorerWeight: 3,
        label: "🛡️ Zagueiro Artilheiro: a zaga subiu pra área!",
      }),
      onGoal: (ctx) =>
        ctx.side === "user" &&
        ctx.scorerPosition !== undefined &&
        bucketForPosition(ctx.scorerPosition) === "defense"
          ? { pointsMult: 2, label: "🛡️ Zagueiro Artilheiro: gol de zagueiro vale dobrado!" }
          : null,
    },
  },
  {
    id: "maluquice",
    name: "Maluquice",
    emoji: "🎲",
    category: "varzea",
    rarity: "rara",
    price: 8,
    description: "O dado do mercado mostra 2 clubes por rolagem — contrate de qualquer um dos dois.",
    hooks: {
      onShopEnter: () => ({
        dualRoll: true,
        label: "🎲 Maluquice: o dado mostra dois clubes por rolagem!",
      }),
    },
  },

  // ——— Lendárias ———
  {
    id: "camisa-pesada",
    name: "Camisa Pesada",
    emoji: "🌟",
    category: "lendaria",
    rarity: "lendaria",
    price: 11,
    description: "Em jogos de mata-mata, sua pontuação da partida é multiplicada por 1.5.",
    hooks: {
      scoreMult: (ctx) => (ctx.stage.elimination ? 1.5 : 1),
    },
  },
  {
    id: "dia-de-sao-jorge",
    name: "Dia de São Jorge",
    emoji: "🐉",
    category: "lendaria",
    rarity: "lendaria",
    price: 12,
    description: "O santo é forte: a pontuação de TODAS as partidas é multiplicada por 1.25.",
    hooks: {
      scoreMult: () => 1.25,
    },
  },
];

export const CARDS_BY_ID: ReadonlyMap<string, CardDef> = new Map(CARDS.map((c) => [c.id, c]));

export function getCard(cardId: string): CardDef {
  const card = CARDS_BY_ID.get(cardId);
  if (!card) throw new Error(`Unknown card: ${cardId}`);
  return card;
}

// ---------------------------------------------------------------------------
// Hook aggregation — per-card contributions, so callers can both apply the
// math AND record a CardFiring per contribution (broadcast popups).
// ---------------------------------------------------------------------------

export interface CardContribution<E> {
  card: CardDef;
  effect: E;
}

export function evalPreMatch(cards: CardDef[], ctx: PreMatchCtx): CardContribution<PreMatchEffect>[] {
  return cards.flatMap((card) => {
    const effect = card.hooks.preMatch?.(ctx);
    return effect ? [{ card, effect }] : [];
  });
}

export function evalOnGoal(cards: CardDef[], ctx: GoalCtx): CardContribution<GoalEffect>[] {
  return cards.flatMap((card) => {
    const effect = card.hooks.onGoal?.(ctx);
    return effect ? [{ card, effect }] : [];
  });
}

export function evalOnResult(cards: CardDef[], ctx: ResultCtx): CardContribution<ResultEffect>[] {
  return cards.flatMap((card) => {
    const effect = card.hooks.onResult?.(ctx);
    return effect ? [{ card, effect }] : [];
  });
}

export function evalOnShopEnter(cards: CardDef[]): CardContribution<ShopEffect>[] {
  return cards.flatMap((card) => {
    const effect = card.hooks.onShopEnter?.();
    return effect ? [{ card, effect }] : [];
  });
}

export function evalScoreMults(
  cards: CardDef[],
  ctx: ScoreCtx,
): Array<{ card: CardDef; mult: number }> {
  return cards.flatMap((card) => {
    const mult = card.hooks.scoreMult?.(ctx) ?? 1;
    return mult !== 1 ? [{ card, mult }] : [];
  });
}
