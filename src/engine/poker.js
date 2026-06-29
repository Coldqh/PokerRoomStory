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
    animation: createAnimationState(),
  };
}

export function createAnimationState(patch = {}) {
  return {
    isPlaying: false,
    index: 0,
    total: 0,
    currentEvent: null,
    recentEvents: [],
    revealedCommunityCount: 0,
    showWinner: false,
    ...patch,
  };
}

export function startNewHand({ content, table, club, player }) {
  const deck = createDeck();
  const npcs = selectTableNpcs(content, table, club, table.seats - 1);
  const playerAnte = table.bigBlind;
  const npcAnte = table.bigBlind;
  const pot = playerAnte + npcs.length * npcAnte;

  const npcSeats = npcs.map((npc, index) => ({
    npc,
    holeCards: draw(deck, 2),
    folded: false,
    invested: npcAnte,
    stack: Math.max(0, Math.min(npc.bankroll ?? table.maxBuyIn, table.maxBuyIn) - npcAnte),
    seatIndex: index + 1,
    lastAction: "blind",
    lastAmount: npcAnte,
  }));

  const tableState = {
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
      `Новая раздача · ${npcs.length + 1} игроков.`,
      `Блайнд $${playerAnte}. Банк $${pot}.`,
    ],
    awaitingPlayer: true,
    buyInWarning: player.bankroll < table.bigBlind * 20,
    animation: createAnimationState(),
  };

  return tableState;
}

export function buildStartHandTimeline(tableState, table) {
  return [
    event("dealer", "Dealer", "shuffle", `Новая раздача · $${table.smallBlind}/$${table.bigBlind}`, { pot: 0, revealCount: 0 }),
    event("dealer", "Dealer", "blind", `Блайнды · банк $${tableState.pot}`, { pot: tableState.pot, revealCount: 0 }),
    event("player", "Ты", "deal", `Карты розданы`, { pot: tableState.pot, revealCount: 0 }),
  ];
}

export function applyPlayerAction({ tableState, player, action, table }) {
  if (!tableState || !tableState.awaitingPlayer || tableState.animation?.isPlaying) return { tableState, player, result: null, timeline: [] };

  if (action === "fold") {
    const result = buildFoldResult(tableState, table);
    const nextState = {
      ...tableState,
      phase: "folded",
      awaitingPlayer: false,
      lastPlayerAction: action,
      lastResult: result,
      actionLog: [...tableState.actionLog, "Fold."],
    };
    return {
      tableState: nextState,
      player,
      result,
      timeline: [
        event("player", "Ты", "fold", "Fold", { pot: tableState.pot }),
        event("dealer", "Dealer", "winner", `Потеря $${tableState.playerInvested}`, {
          pot: tableState.pot,
          winnerId: "table",
          revealCount: tableState.communityCards.length,
        }),
      ],
    };
  }

  const pressure = action === "raise" ? table.bigBlind * 3 : table.bigBlind;
  let pot = tableState.pot;
  let playerInvested = tableState.playerInvested;
  const actionLog = [...tableState.actionLog];
  const timeline = [];

  if (action === "raise") {
    pot += pressure;
    playerInvested += pressure;
    actionLog.push(`Raise $${pressure}.`);
    timeline.push(event("player", "Ты", "raise", `Raise $${pressure}`, { amount: pressure, pot }));
  } else if (action === "call") {
    pot += table.bigBlind;
    playerInvested += table.bigBlind;
    actionLog.push(`Call $${table.bigBlind}.`);
    timeline.push(event("player", "Ты", "call", `Call $${table.bigBlind}`, { amount: table.bigBlind, pot }));
  } else {
    actionLog.push("Check.");
    timeline.push(event("player", "Ты", "check", "Check.", { pot }));
  }

  const npcRound = resolveNpcRound({
    tableState: { ...tableState, pot, playerInvested },
    phase: tableState.phase,
    pressure: action === "raise" ? pressure : 0,
  });

  pot = npcRound.pot;
  actionLog.push(...npcRound.logs);
  timeline.push(...npcRound.events);

  const advanced = advancePhase({ ...tableState, pot, playerInvested, actionLog, npcSeats: npcRound.npcSeats });
  if (advanced.stageEvent) timeline.push(advanced.stageEvent);

  if (advanced.phase === "showdown") {
    const result = resolveShowdown(advanced, table);
    timeline.push(...buildShowdownTimeline(advanced, result));
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
      timeline,
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
    timeline,
  };
}

export function getAvailableActions(tableState) {
  if (!tableState || !tableState.awaitingPlayer || tableState.animation?.isPlaying) return [];
  return ["fold", "check", "call", "raise"];
}

export function getPhaseLabel(phase) {
  return PHASE_LABELS[phase] ?? phase;
}

export function getHandHint(tableState) {
  if (!tableState || tableState.phase === "idle") return "Начни раздачу.";
  if (!tableState.playerHoleCards?.length) return "Карты не розданы.";

  if (tableState.phase === "preflop") {
    const strength = estimatePreflopStrength(tableState.playerHoleCards);
    if (strength > 0.74) return "Сильный старт.";
    if (strength > 0.48) return "Играбельно. Смотри банк.";
    return "Слабый старт.";
  }

  const info = getCurrentHandInfo(tableState);
  if (!info.ready) return "Ждём флоп.";
  if (info.best.category >= 4) return `${info.best.summary}`;
  if (info.best.category >= 1) return `${info.best.summary}`;
  return `${info.best.summary}`;
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
  const events = [];
  const npcSeats = tableState.npcSeats.map((seat) => {
    if (seat.folded) return { ...seat, lastAction: "folded" };

    const decision = decideNpcAction({
      npc: seat.npc,
      holeCards: seat.holeCards,
      communityCards: tableState.communityCards,
      phase,
      pressure,
      pot,
    });

    if (decision.action === "fold") {
      logs.push(`${seat.npc.name}: fold.`);
      events.push(event(seat.npc.id, seat.npc.name, "fold", "Fold", { pot }));
      return { ...seat, folded: true, lastAction: "fold", lastAmount: 0 };
    }

    if (decision.action === "raise") {
      const amount = pressure > 0 ? pressure * 2 : 6;
      pot += amount;
      logs.push(`${seat.npc.name}: raise $${amount}.`);
      events.push(event(seat.npc.id, seat.npc.name, "raise", `Raise $${amount}`, { amount, pot }));
      return { ...seat, invested: seat.invested + amount, stack: Math.max(0, seat.stack - amount), lastAction: "raise", lastAmount: amount };
    }

    if (decision.action === "call") {
      const amount = pressure || 2;
      pot += amount;
      logs.push(`${seat.npc.name}: call $${amount}.`);
      events.push(event(seat.npc.id, seat.npc.name, "call", `Call $${amount}`, { amount, pot }));
      return { ...seat, invested: seat.invested + amount, stack: Math.max(0, seat.stack - amount), lastAction: "call", lastAmount: amount };
    }

    logs.push(`${seat.npc.name}: check.`);
    events.push(event(seat.npc.id, seat.npc.name, "check", "Check", { pot }));
    return { ...seat, lastAction: "check", lastAmount: 0 };
  });

  return { pot, logs, npcSeats, events };
}

function advancePhase(tableState) {
  const currentIndex = PHASES.indexOf(tableState.phase);
  const nextPhase = PHASES[currentIndex + 1] ?? "showdown";
  const deck = [...tableState.deck];
  const communityCards = [...tableState.communityCards];
  const actionLog = [...tableState.actionLog];
  let stageEvent = null;

  if (nextPhase === "flop") {
    communityCards.push(...draw(deck, 3));
    actionLog.push("Flop.");
    stageEvent = event("dealer", "Dealer", "flop", `Флоп: ${describeCards(communityCards.slice(0, 3))}`, { revealCount: 3, pot: tableState.pot });
  }

  if (nextPhase === "turn") {
    const card = draw(deck, 1)[0];
    communityCards.push(card);
    actionLog.push("Turn.");
    stageEvent = event("dealer", "Dealer", "turn", `Тёрн: ${describeCards([card])}`, { revealCount: 4, pot: tableState.pot });
  }

  if (nextPhase === "river") {
    const card = draw(deck, 1)[0];
    communityCards.push(card);
    actionLog.push("River.");
    stageEvent = event("dealer", "Dealer", "river", `Ривер: ${describeCards([card])}`, { revealCount: 5, pot: tableState.pot });
  }

  return {
    ...tableState,
    deck,
    communityCards,
    phase: nextPhase,
    actionLog,
    stageEvent,
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

  const showdownHands = allHands.map((entry) => ({
    id: entry.type === "player" ? "player" : entry.seat.npc.id,
    name: entry.type === "player" ? "Ты" : entry.seat.npc.name,
    hand: entry.hand,
    cards: entry.type === "player" ? tableState.playerHoleCards : entry.seat.holeCards,
  }));

  if (winner.type === "player") {
    return {
      winner: "player",
      winnerId: "player",
      winnerName: "Ты",
      winningHand: playerHand,
      pot: tableState.pot,
      bankrollDelta: tableState.pot - tableState.playerInvested,
      reputationGain: table.difficulty + 2,
      xp: 20 + table.difficulty * 5,
      playerHand,
      showdownHands,
      logs: [`Ты выигрываешь $${tableState.pot} · ${playerHand.categoryName}.`],
    };
  }

  return {
    winner: winner.seat.npc.id,
    winnerId: winner.seat.npc.id,
    winnerName: winner.seat.npc.name,
    pot: tableState.pot,
    bankrollDelta: -tableState.playerInvested,
    reputationGain: 0,
    xp: 8 + table.difficulty * 3,
    playerHand,
    winnerHand: winner.hand,
    winningHand: winner.hand,
    showdownHands,
    logs: [
      `Твоя рука: ${playerHand.categoryName}.`,
      `${winner.seat.npc.name} выигрывает · ${winner.hand.categoryName}.`,
    ],
  };
}

function buildShowdownTimeline(tableState, result) {
  const revealEvents = tableState.npcSeats
    .filter((seat) => !seat.folded)
    .slice(0, 3)
    .map((seat) => event(seat.npc.id, seat.npc.name, "show", `${seat.npc.name} вскрывает карты.`, { pot: tableState.pot, revealCount: 5 }));

  return [
    event("dealer", "Dealer", "showdown", "Showdown", { pot: tableState.pot, revealCount: 5 }),
    ...revealEvents,
    event(result.winnerId ?? result.winner, result.winnerName ?? "Победитель", "winner", `${result.winnerName ?? "Победитель"} забирает $${tableState.pot} · ${result.winningHand?.categoryName ?? "банк"}`, {
      pot: tableState.pot,
      winnerId: result.winnerId ?? result.winner,
      revealCount: 5,
      handName: result.winningHand?.categoryName,
    }),
  ];
}

function buildFoldResult(tableState, table) {
  return {
    winner: "table",
    winnerId: "table",
    winnerName: "Стол",
    pot: tableState.pot,
    bankrollDelta: -tableState.playerInvested,
    reputationGain: 0,
    xp: 4 + table.difficulty,
    playerHand: null,
    logs: ["Fold."],
  };
}

function event(actorId, actorName, action, message, patch = {}) {
  return {
    id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
    actorId,
    actorName,
    action,
    message,
    amount: patch.amount ?? null,
    pot: patch.pot ?? null,
    revealCount: patch.revealCount,
    winnerId: patch.winnerId,
    handName: patch.handName,
    createdAt: Date.now(),
  };
}
