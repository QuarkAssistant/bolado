/**
 * Bolado broadcast phrase pools — pt-BR football-commentary register.
 * Kept separate from matchScript.ts for future i18n.
 *
 * All phrases use {variable} tokens replaced by the script generator:
 *   {marquee}  — challenge theme label (e.g. "México + África do Sul")
 *   {scorer}   — goal scorer display name
 *   {player}   — a named XI player for chance beats
 *   {gk}       — our goalkeeper's name
 *   {score}    — "X a Y" score string
 *   {homeGoals}, {awayGoals} — numeric scores
 */

export const phrases = {
  kickoff: [
    "A torcida canta! {marquee} em campo — bola rolando!",
    "APITA O ÁRBITRO! {marquee} pronto para o duelo!",
    "Dia de jogo! {marquee} entra em campo com tudo!",
    "A partida começa! Nos preparamos para ver {marquee} em ação!",
    "BOLA NO CHÃO! {marquee} escalado, o desafio começa agora!",
    "O estádio vibra! {marquee} versus Seleção do Mundo — começa a batalha!",
  ],

  chance: [
    "{player} quase marca — bateu na trave!",
    "QUE CHANCE! {player} chuta forte, goleiro deles faz a defesa!",
    "{player} aparece na área, cabeceia... pra fora!",
    "Jogada de mestre de {player} — mas passou pelo lado do gol!",
    "INCRÍVEL! {player} domina e chuta — para na zaga!",
    "{player} leva para a esquerda, finaliza... defesa espetacular do goleiro deles!",
  ],

  oppChance: [
    "Pressão da Seleção do Mundo... {gk} SALVA TUDO!",
    "Contra-ataque perigoso da Seleção do Mundo — {gk} fechou o gol!",
    "Cuidado! A Seleção do Mundo chuta cruzado... {gk} voa e defende!",
    "PERIGO! Chute de fora da área — {gk} espalmou!",
    "A Seleção do Mundo pressiona forte, mas {gk} está inspirado!",
    "Quase! A Seleção do Mundo chegou com perigo — {gk} se redimiu!",
  ],

  goal: [
    "GOOOOL! {scorer} aparece na área e manda pras redes! {score}!",
    "É GOL! {scorer} não perdoa — GOLAÇO! {score}!",
    "GOOOOL DE {scorer}! A torcida vai à loucura! {score}!",
    "QUE GOLAÇO! {scorer} mostrou toda a classe! Placar: {score}!",
    "BALANÇOU! {scorer} estava ali na hora certa! {score}!",
    "GOOOOOL! {scorer} marca um golaço histórico! {score}!",
  ],

  oppGoal: [
    "A Seleção do Mundo desconta! Gol deles aos {minute}! Placar: {score}.",
    "Tomamos! A Seleção do Mundo marca. {score} agora.",
    "Gol da Seleção do Mundo aos {minute} minutos. {score}. Precisamos reagir!",
    "Que revés! A Seleção do Mundo empata — {score}.",
    "A Seleção do Mundo aproveita o vacilo e marca. {score}.",
    "Sofreu! Seleção do Mundo balança as redes. Placar: {score}.",
  ],

  halftime: [
    "FIM DO PRIMEIRO TEMPO! Placar parcial: {score}. Vamos lá!",
    "Apita para o intervalo! {score} até aqui — tudo pode mudar!",
    "Intervalo! Placar: {score}. O segundo tempo promete!",
    "Descanso! {score} no marcador — mas a partida não acabou!",
    "15 minutos de pausa. {score} no placar. Concentração máxima para o segundo tempo!",
    "FIM DO 1° TEMPO — {score}. O técnico tem trabalho a fazer!",
  ],

  lateDrama: [
    "NOS ACRÉSCIMOS! A partida esquenta nos minutos finais!",
    "TEMPO EXTRA! O árbitro adiciona minutos — tudo pode acontecer!",
    "A EMOÇÃO É TOTAL! Estamos nos acréscimos — {score}!",
    "NOS ÚLTIMOS MINUTOS! A tensão é máxima no estádio!",
    "ACRÉSCIMOS! O coração acelera — {score} e tudo indefinido!",
    "EMOÇÃO ATÉ O FIM! Nos acréscimos com {score} no placar!",
  ],

  fulltime: [
    "APITA FINAL! {score} — nossa análise completa a seguir!",
    "FIM DE JOGO! Placar final: {score}!",
    "ENCERROU! {score} — saiba agora como foi sua escalação!",
    "ACABOU! {score} — vejamos como cada jogador se saiu!",
    "FIM! Placar final: {score}. Hora do veredito!",
    "TERMINOU! {score} — confira sua nota agora!",
  ],
};

/**
 * Run-mode (v2 Libertadores) pools — the opponent is a NAMED historic club,
 * not the fixed "Seleção do Mundo". Extra tokens:
 *   {opponent}   — opponent club name (e.g. "Peñarol 1960-61")
 *   {flavor}     — opponent flavor line ("o Rei de Copas")
 *   {stageLabel} — stage label ("Oitavas de Final")
 */
export const runPhrases = {
  kickoff: [
    "BOLA ROLANDO na {stageLabel}! Bolado FC encara o {opponent} — {flavor}!",
    "APITA O ÁRBITRO! {opponent} em campo: {flavor}. A {stageLabel} começa AGORA!",
    "Noite de jogo! Diante de nós o {opponent} — {flavor}. Segura o coração!",
    "É {stageLabel}! O {opponent} entra em campo: {flavor}. Bora, Bolado!",
    "COMEÇOU! {opponent} pela frente — {flavor}. O estádio vem abaixo!",
    "A bola rola na {stageLabel}! {opponent} do outro lado: {flavor}!",
  ],

  chance: [
    "{player} quase marca — bateu na trave!",
    "QUE CHANCE! {player} chuta forte, o goleiro do {opponent} faz a defesa!",
    "{player} aparece na área, cabeceia... pra fora!",
    "Jogada de mestre de {player} — mas passou raspando!",
    "INCRÍVEL! {player} domina e chuta — para na zaga do {opponent}!",
    "{player} leva para a esquerda, finaliza... defesa espetacular!",
  ],

  oppChance: [
    "Pressão do {opponent}... {gk} SALVA TUDO!",
    "Contra-ataque perigoso do {opponent} — {gk} fechou o gol!",
    "Cuidado! O {opponent} chuta cruzado... {gk} voa e defende!",
    "PERIGO! Chute de fora da área — {gk} espalmou!",
    "O {opponent} pressiona forte, mas {gk} está inspirado!",
    "Quase! O {opponent} chegou com perigo — {gk} se agigantou!",
  ],

  goal: [
    "GOOOOL! {scorer} aparece na área e manda pras redes! {score}!",
    "É GOL! {scorer} não perdoa — GOLAÇO! {score}!",
    "GOOOOL DE {scorer}! A torcida vai à loucura! {score}!",
    "QUE GOLAÇO! {scorer} mostrou toda a classe! Placar: {score}!",
    "BALANÇOU! {scorer} estava ali na hora certa! {score}!",
    "GOOOOOL! {scorer} marca um golaço histórico! {score}!",
  ],

  oppGoal: [
    "O {opponent} marca! Gol deles aos {minute}! Placar: {score}.",
    "Tomamos! O {opponent} balança a rede. {score} agora.",
    "Gol do {opponent} aos {minute} minutos. {score}. Precisamos reagir!",
    "Que revés! O {opponent} marca — {score}.",
    "O {opponent} aproveita o vacilo e marca. {score}.",
    "Sofreu! {opponent} nas redes. Placar: {score}.",
  ],

  halftime: [
    "FIM DO PRIMEIRO TEMPO! Placar parcial: {score}. Vamos lá!",
    "Apita para o intervalo! {score} até aqui — tudo pode mudar!",
    "Intervalo! Placar: {score}. O segundo tempo promete!",
    "Descanso! {score} no marcador — mas a partida não acabou!",
    "15 minutos de pausa. {score} no placar. Concentração máxima!",
    "FIM DO 1° TEMPO — {score}. O técnico tem trabalho a fazer!",
  ],

  lateDrama: [
    "NOS ACRÉSCIMOS! A partida esquenta nos minutos finais!",
    "TEMPO EXTRA! O árbitro adiciona minutos — tudo pode acontecer!",
    "A EMOÇÃO É TOTAL! Estamos nos acréscimos — {score}!",
    "NOS ÚLTIMOS MINUTOS! A tensão é máxima no estádio!",
    "ACRÉSCIMOS! O coração acelera — {score} e tudo indefinido!",
    "EMOÇÃO ATÉ O FIM! Nos acréscimos com {score} no placar!",
  ],

  fulltime: [
    "APITA FINAL! {score} contra o {opponent}!",
    "FIM DE JOGO! Placar final: {score}!",
    "ENCERROU! {score} diante do {opponent}!",
    "ACABOU! {score} — que batalha contra o {opponent}!",
    "FIM! Placar final: {score}. Hora das contas!",
    "TERMINOU! {score} na {stageLabel}!",
  ],

  shootoutWin: [
    "DISPUTA DE PÊNALTIS... E DEU BOLADO! Vitória na marca da cal!",
    "PÊNALTIS! Coração na boca... E O BOLADO VENCE NA RAÇA!",
    "Decisão por pênaltis... GOLEIRO HERÓI! O Bolado avança!",
  ],

  shootoutLoss: [
    "Disputa de pênaltis... e o {opponent} leva. Dói demais.",
    "Pênaltis... a bola não quis entrar. O {opponent} comemora.",
    "Na marca da cal, o {opponent} foi mais frio. Fim de linha.",
  ],

  shootoutDraw: [
    "Pênaltis perdidos — mas no grupo o empate fica de pé.",
    "A disputa escapou, fica o empate e o ponto no grupo.",
  ],
};
