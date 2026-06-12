/**
 * Libertadores opponents — historic South American sides for the v2 run mode
 * (docs/spec-v2.md §3.2).
 *
 * Each entry is a research-verified club + era (titles, finals or best
 * campaigns are real — no fabricated sides). Tiers drive the run curve:
 *
 *  - "group": group-stage pool, rating 74-82 — winnable by a journeyman XI
 *    plus a couple of signings (journeymen primary stats sit at 60-66).
 *  - "mata":  oitavas/quartas pool, rating 82-89 — the squad must have grown.
 *  - "boss":  semi/final pool, rating 88-94 — the continent's monsters.
 *
 * This module extends the engine's OpponentDef ADDITIVELY: `toOpponentDef`
 * produces the exact shape playRunMatch consumes (run/types.ts is untouched).
 * `country` here is the flag emoji for UI; `nationTag` carries the
 * player-pool nation name ("Brazil", "Argentina", "Colombia") that the
 * Lei do Ex card matches against (OpponentDef.country).
 */

import type { OpponentDef } from "../../run/types";

export type LibertadoresTier = "group" | "mata" | "boss";

export interface LibertadoresOpponent {
  id: string;
  /** Club + year(s), e.g. "Independiente 1972-75". */
  name: string;
  /** Flag emoji of the club's country. */
  country: string;
  rating: number;
  /** Year span of the side being evoked. */
  era: string;
  /** One pt-BR line of dread/respect. */
  flavor: string;
  /** Highland fortress (La Paz, Quito): away debuff is -4 instead of -2. */
  altitude?: boolean;
  tier: LibertadoresTier;
  /**
   * Nation-pool tag (matches NationPlayer.nation) for Lei do Ex, present
   * only where a player pool exists (Brazil / Argentina / Colombia).
   */
  nationTag?: string;
}

/** Tuned rating bands per tier (inclusive). */
export const RATING_BANDS: Record<LibertadoresTier, { min: number; max: number }> = {
  group: { min: 74, max: 82 },
  mata: { min: 82, max: 89 },
  boss: { min: 88, max: 94 },
};

export const libertadoresOpponents: readonly LibertadoresOpponent[] = [
  // -------------------------------------------------------------------------
  // BOSS — semi/final pool (88-94)
  // -------------------------------------------------------------------------
  {
    id: "santos-1962",
    name: "Santos 1962-63",
    country: "🇧🇷",
    rating: 94,
    era: "1962-1963",
    flavor: "O time do Rei. Pelé, Coutinho e Pepe — bicampeão da América e do mundo.",
    tier: "boss",
    nationTag: "Brazil",
  },
  {
    id: "independiente-1972",
    name: "Independiente 1972-75",
    country: "🇦🇷",
    rating: 94,
    era: "1972-1975",
    flavor: "O Rei de Copas. Quatro taças seguidas — ninguém nunca repetiu.",
    tier: "boss",
    nationTag: "Argentina",
  },
  {
    id: "penarol-1960",
    name: "Peñarol 1960-66",
    country: "🇺🇾",
    rating: 93,
    era: "1960-1966",
    flavor: "O primeiro campeão da história. Spencer no ar é gol anunciado.",
    tier: "boss",
  },
  {
    id: "boca-2000",
    name: "Boca Juniors 2000-03",
    country: "🇦🇷",
    rating: 93,
    era: "2000-2003",
    flavor: "Riquelme pensa, Palermo mata. A Bombonera não para de tremer.",
    tier: "boss",
    nationTag: "Argentina",
  },
  {
    id: "sao-paulo-1992",
    name: "São Paulo 1992-93",
    country: "🇧🇷",
    rating: 93,
    era: "1992-1993",
    flavor: "A máquina de Telê Santana. Bi da América e do mundo, sem pressa e sem dó.",
    tier: "boss",
    nationTag: "Brazil",
  },
  {
    id: "estudiantes-1968",
    name: "Estudiantes 1968-70",
    country: "🇦🇷",
    rating: 92,
    era: "1968-1970",
    flavor: "O tri de Zubeldía. Estudam cada fraqueza sua — e não perdoam nenhuma.",
    tier: "boss",
    nationTag: "Argentina",
  },
  {
    id: "river-1986",
    name: "River Plate 1986/96",
    country: "🇦🇷",
    rating: 92,
    era: "1986-1996",
    flavor: "Francescoli rege e o Monumental inteiro canta. Elegância que machuca.",
    tier: "boss",
    nationTag: "Argentina",
  },
  {
    id: "flamengo-1981",
    name: "Flamengo 1981",
    country: "🇧🇷",
    rating: 92,
    era: "1981",
    flavor: "Zico no auge e uma Nação inteira atrás. Depois da taça, 3 a 0 no Liverpool.",
    tier: "boss",
    nationTag: "Brazil",
  },
  {
    id: "boca-1977",
    name: "Boca Juniors 1977-78",
    country: "🇦🇷",
    rating: 91,
    era: "1977-1978",
    flavor: "O Boca de Lorenzo e Gatti. Bicampeão na raça e na catimba.",
    tier: "boss",
    nationTag: "Argentina",
  },
  {
    id: "nacional-1971",
    name: "Nacional 1971/80/88",
    country: "🇺🇾",
    rating: 91,
    era: "1971-1988",
    flavor: "Tricampeão charrua. A garra que atravessa décadas sem enferrujar.",
    tier: "boss",
  },
  {
    id: "gremio-1983",
    name: "Grêmio 1983/95",
    country: "🇧🇷",
    rating: 90,
    era: "1983-1995",
    flavor: "Renato em 83, Felipão em 95. O Olímpico vira caldeirão.",
    tier: "boss",
    nationTag: "Brazil",
  },
  {
    id: "olimpia-1979",
    name: "Olimpia 1979/1990",
    country: "🇵🇾",
    rating: 89,
    era: "1979-1990",
    flavor: "O Decano do Paraguai. Campeão duas vezes, silencia qualquer estádio.",
    tier: "boss",
  },
  {
    id: "racing-1967",
    name: "Racing 1967",
    country: "🇦🇷",
    rating: 88,
    era: "1967",
    flavor: "A Academia de Pizzuti. Campeã da América e do mundo no mesmo ano.",
    tier: "boss",
    nationTag: "Argentina",
  },

  // -------------------------------------------------------------------------
  // MATA — oitavas/quartas pool (82-89)
  // -------------------------------------------------------------------------
  {
    id: "velez-1994",
    name: "Vélez Sarsfield 1994",
    country: "🇦🇷",
    rating: 88,
    era: "1994",
    flavor: "O Vélez de Bianchi. Chilavert defende, organiza e ainda bate falta.",
    tier: "mata",
    nationTag: "Argentina",
  },
  {
    id: "atletico-nacional-1989",
    name: "Atlético Nacional 1989/2016",
    country: "🇨🇴",
    rating: 88,
    era: "1989-2016",
    flavor: "Higuita sai jogando e Medellín explode. Primeiro campeão colombiano.",
    tier: "mata",
    nationTag: "Colombia",
  },
  {
    id: "cruzeiro-1976",
    name: "Cruzeiro 1976/97",
    country: "🇧🇷",
    rating: 87,
    era: "1976-1997",
    flavor: "Bicampeão celeste. O Mineirão empurra e a Raposa morde.",
    tier: "mata",
    nationTag: "Brazil",
  },
  {
    id: "internacional-2006",
    name: "Internacional 2006/10",
    country: "🇧🇷",
    rating: 87,
    era: "2006-2010",
    flavor: "Bicampeão no Beira-Rio. Derrubou até o Barcelona de Ronaldinho.",
    tier: "mata",
    nationTag: "Brazil",
  },
  {
    id: "colo-colo-1991",
    name: "Colo-Colo 1991",
    country: "🇨🇱",
    rating: 86,
    era: "1991",
    flavor: "O Cacique de Mirko Jozić. Primeiro campeão chileno, pressão dos quatro lados.",
    tier: "mata",
  },
  {
    id: "ldu-quito-2008",
    name: "LDU Quito 2008",
    country: "🇪🇨",
    rating: 85,
    era: "2008",
    flavor: "Campeã no Maracanã. E em Quito, a 2.850 metros, o ar é deles.",
    altitude: true,
    tier: "mata",
  },
  {
    id: "america-cali-1985",
    name: "América de Cali 1985-87",
    country: "🇨🇴",
    rating: 85,
    era: "1985-1987",
    flavor: "Três finais seguidas. O Diabo Vermelho sempre volta.",
    tier: "mata",
    nationTag: "Colombia",
  },
  {
    id: "once-caldas-2004",
    name: "Once Caldas 2004",
    country: "🇨🇴",
    rating: 84,
    era: "2004",
    flavor: "Mataram o Boca nos pênaltis. Bloco baixo, paciência infinita.",
    tier: "mata",
    nationTag: "Colombia",
  },
  {
    id: "newells-1988",
    name: "Newell's Old Boys 1988/92",
    country: "🇦🇷",
    rating: 84,
    era: "1988-1992",
    flavor: "A Lepra de Rosario: duas finais com time de cria. Em 92, Bielsa no comando.",
    tier: "mata",
    nationTag: "Argentina",
  },
  {
    id: "cobreloa-1981",
    name: "Cobreloa 1981-82",
    country: "🇨🇱",
    rating: 83,
    era: "1981-1982",
    flavor: "Do deserto do Atacama a duas finais seguidas. Em Calama não tem amistoso.",
    tier: "mata",
  },

  // -------------------------------------------------------------------------
  // GROUP — group-stage pool (74-82)
  // -------------------------------------------------------------------------
  {
    id: "barcelona-sc-1990",
    name: "Barcelona SC 1990/98",
    country: "🇪🇨",
    rating: 82,
    era: "1990-1998",
    flavor: "O Ídolo de Guayaquil, duas vezes finalista. O Monumental ferve à beira do rio.",
    tier: "group",
  },
  {
    id: "deportivo-cali-1999",
    name: "Deportivo Cali 1999",
    country: "🇨🇴",
    rating: 81,
    era: "1999",
    flavor: "Duas finais na história. O açúcar de Cali desanda qualquer defesa.",
    tier: "group",
    nationTag: "Colombia",
  },
  {
    id: "sporting-cristal-1997",
    name: "Sporting Cristal 1997",
    country: "🇵🇪",
    rating: 80,
    era: "1997",
    flavor: "Finalista em 97 contra o Cruzeiro. O Rímac inteiro vestido de celeste.",
    tier: "group",
  },
  {
    id: "cerro-porteno-1998",
    name: "Cerro Porteño 1998",
    country: "🇵🇾",
    rating: 80,
    era: "1998",
    flavor: "Semifinalista em 73, 78, 93 e 98. O Ciclón sopra forte em Barrio Obrero.",
    tier: "group",
  },
  {
    id: "emelec-1995",
    name: "Emelec 1995",
    country: "🇪🇨",
    rating: 79,
    era: "1995",
    flavor: "O Bombillo do Tanque Hurtado. Semifinalista em 95, elétrico em casa.",
    tier: "group",
  },
  {
    id: "union-espanola-1975",
    name: "Unión Española 1975",
    country: "🇨🇱",
    rating: 79,
    era: "1975",
    flavor: "Finalista em 75 — só caiu para o Rei de Copas, no jogo de desempate.",
    tier: "group",
  },
  {
    id: "bolivar-2014",
    name: "Bolívar 2014",
    country: "🇧🇴",
    rating: 78,
    era: "2014",
    flavor: "Semifinalista em 2014. Em La Paz, a 3.600 metros, falta ar e sobra Bolívar.",
    altitude: true,
    tier: "group",
  },
  {
    id: "the-strongest-2017",
    name: "The Strongest 2017",
    country: "🇧🇴",
    rating: 76,
    era: "2017",
    flavor: "O Tigre de La Paz. No Hernando Siles, o oxigênio joga do lado deles.",
    altitude: true,
    tier: "group",
  },
  {
    id: "universitario-1972",
    name: "Universitario 1972",
    country: "🇵🇪",
    rating: 76,
    era: "1972",
    flavor: "Primeiro finalista peruano. Eliminou Peñarol e Nacional no caminho.",
    tier: "group",
  },
  {
    id: "alianza-lima-1978",
    name: "Alianza Lima 1978",
    country: "🇵🇪",
    rating: 74,
    era: "1977-1978",
    flavor: "Cubillas e Sotil no comando. Os Íntimos jogam de memória.",
    tier: "group",
  },
];

/** Opponents of a given tier, in declaration (rating-descending) order. */
export function opponentsByTier(tier: LibertadoresTier): LibertadoresOpponent[] {
  return libertadoresOpponents.filter((opponent) => opponent.tier === tier);
}

/** Lookup by id; undefined when unknown. */
export function findLibertadoresOpponent(id: string): LibertadoresOpponent | undefined {
  return libertadoresOpponents.find((opponent) => opponent.id === id);
}

/**
 * Project to the exact OpponentDef shape playRunMatch consumes.
 * OpponentDef.country carries the nation-pool tag (Lei do Ex matching),
 * NOT the flag emoji — the emoji stays a UI concern of this module.
 */
export function toOpponentDef(opponent: LibertadoresOpponent): OpponentDef {
  return {
    name: opponent.name,
    rating: opponent.rating,
    flavor: opponent.flavor,
    ...(opponent.altitude ? { altitude: true } : {}),
    ...(opponent.nationTag ? { country: opponent.nationTag } : {}),
  };
}
