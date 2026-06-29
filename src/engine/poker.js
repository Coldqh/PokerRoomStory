import {
  compareHands,
  createDeck,
  describeCards,
  detectStartingHandUnlocks,
  draw,
  estimatePreflopStrength,
  evaluateBestHand,
} from "./cards.js";
import { decideNpcAction, getArchetypeUnlockConditions, selectTableNpcs } from "./npc.js";

const PHASES = ["preflop", "flop", "turn", "river", "showdown"];
const PHASE_LABELS = {
  idle: "Стол свободен",
  preflop: "Префлоп",
  flop: "Флоп",
  turn: "Тёрн",
  river: "Ривер",
  showdown: "Шоудаун",
  finished: "Раздача завершена",
  folded: "Пас",
};

export function createInitialTableState() {
  return {
    phase: "idle",
    handNumber: 0,
    deck: [],
    communityCards: [],
    playerHoleCards: [],
    npcSeats: [],
    activeNpcSeats: [],
    pot: 0,
    playerInvested: 0,
    lastPlayerAction: null,
    lastResult: null,
    actionLog: [],
    awaitingPlayer: false,
  };
}

export function startNewHand({ content, table, club, player }) {
  const deck = createDeck();
  const npcs = selectTableNpcs(content, table, club, table.seats - 1);
  const playerAnte = table.bigBlind;
  const npcAnte = table.bigBlind;
  const pot = playerAnte + npcs.length * npcAnte;

  const npcSeats = npcs.map((npc) => ({
    npc,
    holeCards: draw(deck, 2),
    folded: false,
    invested: npcAnte,
  }));

  return {
    phase: "preflop",
    handNumber: Date.now(),
    deck,
    communityCards: [],
    playerHoleCards: draw(deck, 2),
    npcSeats,
    activeNpcSeats: npcSeats.map((seat) => seat.npc.id),
    pot,
    playerInvested: playerAnte,
    lastPlayerAction: null,
    lastResult: null,
    actionLog: [
      `Новая раздача. Блайнд $${table.bigBlind}. За столом ${npcs.length + 1} игроков.`,
      `Ты внес $${playerAnte}. Банк: $${pot}.`,
    ],
    awaitingPlayer: true,
    buyInWarning: player.bankroll < table.bigBlind * 20,
  };
}

export function applyPlayerAction({ tableState, player, action, table }) {
  if (!tableState || !tableState.awaitingPlayer) return { tableState, player, result: null };

  if (action === "fold") {
    const result = buildFoldResult(tableState, table);
    return {
      tableState: {
        ...tableState,
        phase: "folded",
        awaitingPlayer: false,
        lastPlayerAction: action,
        lastResult: result,
        actionLog: [...tableState.actionLog, "Ты сбросил руку. Банк ушёл столу."],
      },
      player,
      result,
    };
  }

  const pressure = action === "raise" ? table.bigBlind * 3 : table.bigBlind;
  let pot = tableState.pot;
  let playerInvested = tableState.playerInvested;
  const actionLog = [...tableState.actionLog];

  if (action === "raise") {
    pot += pressure;
    playerInvested += pressure;
    actionLog.push(`Ты рейзишь на $${pressure}.`);
  } else if (action === "call") {
    pot += table.bigBlind;
    playerInvested += table.bigBlind;
    actionLog.push(`Ты коллируешь $${table.bigBlind}.`);
  } else {
    actionLog.push("Ты чекаешь.");
  }

  const npcRound = resolveNpcRound({
    tableState: { ...tableState, pot, playerInvested },
    phase: tableState.phase,
    pressure: action === "raise" ? pressure : 0,
  });

  pot = npcRound.pot;
  actionLog.push(...npcRound.logs);

  const advanced = advancePhase({ ...tableState, pot, playerInvested, actionLog, npcSeats: npcRound.npcSeats });

  if (advanced.phase === "showdown") {
    const result = resolveShowdown(advanced, table);
    return {
      tableState: {
        ...advanced,
        phase: "finished",
        awaitingPlayer: false,
        lastPlayerAction: action,
        lastResult: result,
        actionLog: [...advanced.actionLog, ...result.logs],
      },
      player,
      result,
    };
  }

  return {
    tableState: {
      ...advanced,
      awaitingPlayer: true,
      lastPlayerAction: action,
      lastResult: null,
    },
    player,
    result: null,
  };
}

export function getAvailableActions(tableState) {
  if (!tableState || !tableState.awaitingPlayer) return [];
  return ["fold", "check", "call", "raise"];
}

export function getPhaseLabel(phase) {
  return PHASE_LABELS[phase] ?? phase;
}

export function getHandHint(tableState) {
  if (!tableState || tableState.phase === "idle") return "Сядь за стол и начни раздачу.";
  if (!tableState.playerHoleCards?.length) return "Карты ещё не розданы.";

  if (tableState.phase === "preflop") {
    const strength = estimatePreflopStrength(tableState.playerHoleCards);
    if (strength > 0.74) return "Сильная стартовая рука. Можно играть активнее.";
    if (strength > 0.48) return "Рука рабочая. Смотри на давление, банк и соперников.";
    return "Рука слабая. Пас часто лучше дорогого любопытства.";
  }

  const info = getCurrentHandInfo(tableState);
  if (!info.ready) return "Ждём флоп. Пока решение только по стартовой руке.";
  if (info.best.category >= 4) return `${info.best.summary} Это сильная готовая рука.`;
  if (info.best.category >= 1) return `${info.best.summary} Не переоценивай против крупного давления.`;
  return `${info.best.summary} Нужна осторожность.`;
}

export function getCurrentHandInfo(tableState) {
  if (!tableState?.playerHoleCards?.length) {
    return { ready: false, title: "Нет раздачи", detail: "Начни новую руку.", best: null, highlightedIds: new Set() };
  }

  if ((tableState.communityCards?.length ?? 0) < 3) {
    const strength = estimatePreflopStrength(tableState.playerHoleCards);
    return {
      ready: false,
      title: "Префлоп",
      detail: `Стартовая сила: ${Math.round(strength * 100)}%.`,
      best: null,
      highlightedIds: new Set(tableState.playerHoleCards.map((card) => card.id)),
    };
  }

  const best = evaluateBestHand([...tableState.playerHoleCards, ...tableState.communityCards]);
  return {
    ready: true,
    title: best.categoryName,
    detail: `${best.summary} Карты комбинации: ${describeCards(best.cards)}.`,
    best,
    highlightedIds: new Set(best.cardIds),
  };
}

export function getUnlockConditionsFromHand(tableState, result) {
  const conditions = ["first_hand", "first_hand_completed", "start_game"];
  conditions.push(...detectStartingHandUnlocks(tableState.playerHoleCards));
  conditions.push(...getArchetypeUnlockConditions(tableState.npcSeats.map((seat) => seat.npc)));

  if (result?.bankrollDelta < 0 && Math.abs(result.bankrollDelta) >= 30) conditions.push("big_loss");
  if (result?.winner === "player") {
    conditions.push("win_hand");
    if (result.playerHand?.category >= 1) conditions.push("win_with_pair_or_better");
  }
  if (result?.playerHand?.category >= 4 && result?.winner !== "player") conditions.push("lose_strong_hand");

  return conditions;
}

function resolveNpcRound({ tableState, phase, pressure }) {
  let pot = tableState.pot;
  const logs = [];
  const npcSeats = tableState.npcSeats.map((seat) => {
    if (seat.folded) return seat;

    const decision = decideNpcAction({
      npc: seat.npc,
      holeCards: seat.holeCards,
      communityCards: tableState.communityCards,
      phase,
      pressure,
      pot,
    });

    if (decision.action === "fold") {
      logs.push(`${seat.npc.name} сбрасывает.`);
      return { ...seat, folded: true };
    }

    if (decision.action === "raise") {
      const amount = pressure > 0 ? pressure * 2 : 6;
      pot += amount;
      logs.push(`${seat.npc.name} рейзит. +$${amount} в банк.`);
      return { ...seat, invested: seat.invested + amount };
    }

    if (decision.action === "call") {
      const amount = pressure || 2;
      pot += amount;
      logs.push(`${seat.npc.name} коллирует $${amount}.`);
      return { ...seat, invested: seat.invested + amount };
    }

    logs.push(`${seat.npc.name} чекает.`);
    return seat;
  });

  return { pot, logs, npcSeats };
}

function advancePhase(tableState) {
  const currentIndex = PHASES.indexOf(tableState.phase);
  const nextPhase = PHASES[currentIndex + 1] ?? "showdown";
  const deck = [...tableState.deck];
  const communityCards = [...tableState.communityCards];
  const actionLog = [...tableState.actionLog];

  if (nextPhase === "flop") {
    communityCards.push(...draw(deck, 3));
    actionLog.push("Флоп открыт.");
  }

  if (nextPhase === "turn") {
    communityCards.push(...draw(deck, 1));
    actionLog.push("Тёрн открыт.");
  }

  if (nextPhase === "river") {
    communityCards.push(...draw(deck, 1));
    actionLog.push("Ривер открыт.");
  }

  return {
    ...tableState,
    deck,
    communityCards,
    phase: nextPhase,
    actionLog,
  };
}

function resolveShowdown(tableState, table) {
  const playerHand = evaluateBestHand([...tableState.playerHoleCards, ...tableState.communityCards]);
  const activeNpcHands = tableState.npcSeats
    .filter((seat) => !seat.folded)
    .map((seat) => ({ seat, hand: evaluateBestHand([...seat.holeCards, ...tableState.communityCards]) }));

  const allHands = [{ type: "player", hand: playerHand }, ...activeNpcHands.map((entry) => ({ type: "npc", ...entry }))];
  allHands.sort((a, b) => compareHands(a.hand, b.hand)).reverse();
  const winner = allHands[0];

  if (winner.type === "player") {
    return {
      winner: "player",
      pot: tableState.pot,
      bankrollDelta: tableState.pot - tableState.playerInvested,
      reputationGain: table.difficulty + 2,
      xp: 20 + table.difficulty * 5,
      playerHand,
      logs: [`Шоудаун: ${playerHand.categoryName}. Ты забираешь банк $${tableState.pot}.`],
    };
  }

  return {
    winner: winner.seat.npc.id,
    winnerName: winner.seat.npc.name,
    pot: tableState.pot,
    bankrollDelta: -tableState.playerInvested,
    reputationGain: 0,
    xp: 8 + table.difficulty * 3,
    playerHand,
    winnerHand: winner.hand,
    logs: [
      `Шоудаун: у тебя ${playerHand.categoryName}.`,
      `${winner.seat.npc.name} забирает банк с рукой: ${winner.hand.categoryName}.`,
    ],
  };
}

function buildFoldResult(tableState, table) {
  return {
    winner: "table",
    pot: tableState.pot,
    bankrollDelta: -tableState.playerInvested,
    reputationGain: 0,
    xp: 4 + table.difficulty,
    playerHand: null,
    logs: ["Пас тоже решение. Главное — не платить из злости."],
  };
}
