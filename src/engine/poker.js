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
const STREET_LABELS = {
  preflop: "Префлоп",
  flop: "Флоп",
  turn: "Тёрн",
  river: "Ривер",
};
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
    heroSeat: null,
    npcSeats: [],
    activeNpcSeats: [],
    pot: 0,
    smallBlind: 0,
    bigBlind: 0,
    currentBet: 0,
    minRaise: 0,
    streetRaises: 0,
    currentActorId: null,
    currentActorName: null,
    buttonSeatIndex: null,
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
  const npcs = selectTableNpcs(content, table, club, Math.max(2, table.seats - 1));
  const totalSeats = npcs.length + 1;
  const buttonSeatIndex = getNextButtonIndex(totalSeats);
  const heroStack = clampMoney(Math.min(player.bankroll, table.maxBuyIn));

  const heroSeat = buildHeroSeat({
    holeCards: draw(deck, 2),
    stack: heroStack,
    seatIndex: 0,
  });

  const npcSeats = npcs.map((npc, index) =>
    buildNpcSeat({
      npc,
      holeCards: draw(deck, 2),
      stack: clampMoney(Math.min(npc.bankroll ?? table.maxBuyIn, table.maxBuyIn)),
      seatIndex: index + 1,
    }),
  );

  let tableState = syncTableState({
    phase: "preflop",
    handNumber: Date.now(),
    deck,
    communityCards: [],
    heroSeat,
    npcSeats,
    pot: 0,
    smallBlind: table.smallBlind,
    bigBlind: table.bigBlind,
    currentBet: 0,
    minRaise: table.bigBlind,
    streetRaises: 0,
    currentActorId: null,
    currentActorName: null,
    buttonSeatIndex,
    lastPlayerAction: null,
    lastResult: null,
    actionLog: [`Новая раздача · ${totalSeats} игроков.`],
    awaitingPlayer: false,
    buyInWarning: player.bankroll < table.bigBlind * 20,
    animation: createAnimationState(),
  });

  tableState = assignPositions(tableState);
  tableState = postBlinds(tableState, table);
  tableState = beginBettingRound(tableState, getFirstPreflopActor(tableState));

  return syncTableState(tableState);
}

export function buildStartHandTimeline(tableState, table) {
  const smallBlind = findBlindSeat(tableState, "small");
  const bigBlind = findBlindSeat(tableState, "big");
  const events = [
    event("dealer", "Dealer", "shuffle", `Новая раздача · $${table.smallBlind}/$${table.bigBlind}`, {
      pot: 0,
      revealCount: 0,
    }),
  ];

  if (smallBlind) {
    events.push(
      event(smallBlind.id, smallBlind.name, "blind", `SB $${table.smallBlind}`, {
        amount: table.smallBlind,
        pot: table.smallBlind,
        revealCount: 0,
      }),
    );
  }

  if (bigBlind) {
    events.push(
      event(bigBlind.id, bigBlind.name, "blind", `BB $${table.bigBlind}`, {
        amount: table.bigBlind,
        pot: tableState.pot,
        revealCount: 0,
      }),
    );
  }

  events.push(event("dealer", "Dealer", "deal", "Карты розданы", { pot: tableState.pot, revealCount: 0 }));
  return events;
}

export function advanceUntilPlayerOrEnd({ tableState, table }) {
  return autoAdvance(syncTableState(tableState), table);
}

export function applyPlayerAction({ tableState, player, action, table }) {
  if (!tableState || !tableState.awaitingPlayer || tableState.animation?.isPlaying) {
    return { tableState, player, result: null, timeline: [] };
  }

  let state = syncTableState(tableState);
  const hero = state.heroSeat;
  const available = getAvailableActions(state);
  if (!available.includes(action)) {
    return { tableState: state, player, result: null, timeline: [] };
  }

  const commit = commitSeatAction(state, hero.id, normalizeAction(action, state, hero, table), table, { source: "player" });
  state = commit.tableState;
  const timeline = [commit.event];

  state = { ...state, lastPlayerAction: commit.event.action, awaitingPlayer: false };

  if (state.heroSeat.folded) {
    const result = buildFoldResult(state, table);
    const finished = syncTableState({
      ...state,
      phase: "folded",
      awaitingPlayer: false,
      currentActorId: null,
      currentActorName: null,
      lastResult: result,
      actionLog: [...state.actionLog, ...result.logs],
    });
    timeline.push(buildWinnerEvent(finished, result));
    return { tableState: finished, player, result, timeline };
  }

  const auto = autoAdvance(state, table, getNextSeatId(state, hero.seatIndex));
  return {
    tableState: auto.tableState,
    player,
    result: auto.result,
    timeline: [...timeline, ...auto.timeline],
  };
}

export function getAvailableActions(tableState) {
  if (!tableState || !tableState.awaitingPlayer || tableState.animation?.isPlaying || !tableState.heroSeat) return [];
  const hero = tableState.heroSeat;
  if (hero.folded || hero.allIn || tableState.phase === "finished" || tableState.phase === "idle") return [];

  const toCall = getToCall(tableState, hero);
  const actions = [];

  if (toCall > 0) {
    actions.push("fold", "call");
    if (canRaise(tableState, hero)) actions.push("raise");
    return actions;
  }

  actions.push("check");
  if (canRaise(tableState, hero)) actions.push("raise");
  return actions;
}

export function getActionMeta(tableState, table = null) {
  const hero = tableState?.heroSeat;
  if (!hero) return {};
  const toCall = getToCall(tableState, hero);
  const target = getDefaultRaiseTarget(tableState, table ?? { bigBlind: tableState?.bigBlind || tableState?.minRaise || 20 }, hero);
  const raiseCost = Math.max(0, target - hero.currentBet);

  return {
    toCall,
    currentBet: tableState.currentBet ?? 0,
    playerBet: hero.currentBet ?? 0,
    playerStack: hero.stack ?? 0,
    raiseTarget: target,
    raiseCost,
    labels: {
      fold: "Fold",
      check: "Check",
      call: toCall > 0 ? `Call $${Math.min(toCall, hero.stack)}` : "Call",
      raise: (tableState.currentBet ?? 0) > 0 ? `Raise $${target}` : `Bet $${target}`,
    },
  };
}

export function getPhaseLabel(phase) {
  return PHASE_LABELS[phase] ?? phase;
}

export function getHandHint(tableState) {
  if (!tableState || tableState.phase === "idle") return "Начни раздачу.";
  if (!tableState.playerHoleCards?.length) return "Карты не розданы.";
  if (tableState.awaitingPlayer) {
    const meta = getActionMeta(tableState);
    if (meta.toCall > 0) return `Доставить $${meta.toCall} или сбросить.`;
    return "Можно чекнуть.";
  }

  if (tableState.phase === "preflop") {
    const strength = estimatePreflopStrength(tableState.playerHoleCards);
    if (strength > 0.74) return "Сильный старт.";
    if (strength > 0.48) return "Играбельно.";
    return "Слабый старт.";
  }

  const info = getCurrentHandInfo(tableState);
  if (!info.ready) return "Ждём флоп.";
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
      detail: `Сила: ${Math.round(strength * 100)}%.`,
      best: null,
      highlightedIds: new Set(tableState.playerHoleCards.map((card) => card.id)),
    };
  }

  const best = evaluateBestHand([...tableState.playerHoleCards, ...tableState.communityCards]);
  return {
    ready: true,
    title: best.categoryName,
    detail: `${best.summary} ${describeCards(best.cards)}.`,
    best,
    highlightedIds: new Set(best.cardIds),
  };
}

export function getUnlockConditionsFromHand(tableState, result) {
  const conditions = ["first_hand", "first_hand_completed", "start_game"];
  conditions.push(...detectStartingHandUnlocks(tableState.playerHoleCards));
  conditions.push(...getArchetypeUnlockConditions((tableState.npcSeats ?? []).map((seat) => seat.npc)));

  if (result?.bankrollDelta < 0 && Math.abs(result.bankrollDelta) >= 30) conditions.push("big_loss");
  if (result?.winner === "player") {
    conditions.push("win_hand");
    if (result.playerHand?.category >= 1) conditions.push("win_with_pair_or_better");
  }
  if (result?.playerHand?.category >= 4 && result?.winner !== "player") conditions.push("lose_strong_hand");

  return conditions;
}

function autoAdvance(initialState, table, forcedActorId = null) {
  let state = syncTableState({ ...initialState, awaitingPlayer: false });
  let timeline = [];
  let result = null;
  let guard = 0;

  if (forcedActorId) state = setCurrentActor(state, forcedActorId);
  if (!state.currentActorId) state = setCurrentActor(state, getFirstActorForCurrentRound(state));

  while (guard < 120) {
    guard += 1;
    state = syncTableState(state);

    const lone = getOnlyActiveSeat(state);
    if (lone) {
      result = buildSingleWinnerResult(state, table, lone);
      state = syncTableState({
        ...state,
        phase: "finished",
        awaitingPlayer: false,
        currentActorId: null,
        currentActorName: null,
        lastResult: result,
        actionLog: [...state.actionLog, ...result.logs],
      });
      timeline.push(buildWinnerEvent(state, result));
      return { tableState: state, result, timeline };
    }

    if (isBettingRoundComplete(state)) {
      if (state.phase === "river") {
        result = resolveShowdown(state, table);
        state = syncTableState({
          ...state,
          phase: "finished",
          awaitingPlayer: false,
          currentActorId: null,
          currentActorName: null,
          lastResult: result,
          actionLog: [...state.actionLog, ...result.logs],
        });
        timeline.push(...buildShowdownTimeline(state, result));
        return { tableState: state, result, timeline };
      }

      const advanced = advanceStreet(state);
      state = advanced.tableState;
      timeline.push(advanced.event);
      state = setCurrentActor(state, getFirstPostflopActor(state));
      continue;
    }

    const actor = getSeatById(state, state.currentActorId) ?? getSeatById(state, getFirstActorForCurrentRound(state));
    if (!actor) {
      state = setCurrentActor(state, getFirstActorForCurrentRound(state));
      continue;
    }

    if (actor.id === "player") {
      return {
        tableState: syncTableState({
          ...state,
          awaitingPlayer: true,
          currentActorId: "player",
          currentActorName: "Ты",
        }),
        result: null,
        timeline,
      };
    }

    const decision = decideNpcForState(state, actor, table);
    const commit = commitSeatAction(state, actor.id, decision, table, { source: "npc" });
    state = commit.tableState;
    timeline.push(commit.event);

    state = setCurrentActor(state, getNextSeatId(state, actor.seatIndex));
  }

  const failEvent = event("dealer", "Dealer", "log", "Раздача остановлена", { pot: state.pot, revealCount: getRevealCountForPhase(state.phase) });
  timeline.push(failEvent);
  return {
    tableState: syncTableState({
      ...state,
      awaitingPlayer: true,
      currentActorId: "player",
      currentActorName: "Ты",
      actionLog: [...state.actionLog, "Guard stop."],
    }),
    result: null,
    timeline,
  };
}

function decideNpcForState(state, seat, table) {
  const toCall = getToCall(state, seat);
  const raw = decideNpcAction({
    npc: seat.npc,
    holeCards: seat.holeCards,
    communityCards: state.communityCards,
    phase: state.phase,
    pressure: toCall,
    pot: state.pot,
  });

  if (toCall > 0) {
    if (raw.action === "fold") return { action: "fold" };
    if (raw.action === "raise" && canRaise(state, seat) && state.streetRaises < 2) return { action: "raise" };
    return { action: "call" };
  }

  if (raw.action === "raise" && canRaise(state, seat) && state.streetRaises < 2) return { action: "raise" };
  return { action: "check" };
}

function commitSeatAction(tableState, seatId, decision, table, options = {}) {
  let state = syncTableState(tableState);
  const seat = getSeatById(state, seatId);
  if (!seat) return { tableState: state, event: event("dealer", "Dealer", "log", "Нет игрока", { pot: state.pot }) };

  const toCall = getToCall(state, seat);
  const normalized = normalizeAction(decision.action, state, seat, table);
  let nextSeat = { ...seat };
  let nextPot = state.pot;
  let nextCurrentBet = state.currentBet;
  let nextMinRaise = state.minRaise || table.bigBlind;
  let nextStreetRaises = state.streetRaises;
  let action = normalized;
  let amount = 0;
  let message = "";
  let resetActionFlags = false;

  if (action === "fold") {
    nextSeat = { ...nextSeat, folded: true, acted: true, lastAction: "fold", lastAmount: 0 };
    message = "Fold";
  } else if (action === "check") {
    nextSeat = { ...nextSeat, acted: true, lastAction: "check", lastAmount: 0 };
    message = "Check";
  } else if (action === "call") {
    amount = Math.min(toCall, nextSeat.stack);
    nextSeat = applyContribution(nextSeat, amount);
    nextSeat = { ...nextSeat, acted: true, lastAction: "call", lastAmount: amount };
    nextPot += amount;
    message = `Call $${amount}`;
  } else if (action === "raise") {
    const target = getDefaultRaiseTarget(state, table, seat);
    amount = Math.min(Math.max(0, target - nextSeat.currentBet), nextSeat.stack);
    nextSeat = applyContribution(nextSeat, amount);
    const actualTarget = nextSeat.currentBet;
    const raiseBy = Math.max(0, actualTarget - state.currentBet);
    const isBet = state.currentBet <= 0;
    action = isBet ? "bet" : "raise";
    nextSeat = { ...nextSeat, acted: true, lastAction: action, lastAmount: amount };
    nextPot += amount;

    if (actualTarget > state.currentBet) {
      nextCurrentBet = actualTarget;
      nextMinRaise = Math.max(table.bigBlind, raiseBy);
      nextStreetRaises += 1;
      resetActionFlags = true;
    }

    message = isBet ? `Bet $${actualTarget}` : `Raise $${actualTarget}`;
  }

  state = setSeat(state, nextSeat);

  let allSeats = getAllSeats(state);
  if (resetActionFlags) {
    allSeats = allSeats.map((entry) => {
      if (entry.id === nextSeat.id || entry.folded || entry.allIn) return entry;
      return { ...entry, acted: false };
    });
    state = setAllSeats(state, allSeats);
  }

  state = syncTableState({
    ...state,
    pot: nextPot,
    currentBet: nextCurrentBet,
    minRaise: nextMinRaise,
    streetRaises: nextStreetRaises,
    actionLog: [...state.actionLog, `${nextSeat.name}: ${message}.`],
  });

  return {
    tableState: state,
    event: event(nextSeat.id, nextSeat.name, action, message, {
      amount,
      pot: state.pot,
      revealCount: getRevealCountForPhase(state.phase),
      position: nextSeat.position,
      actorStack: nextSeat.stack,
      source: options.source,
    }),
  };
}

function advanceStreet(tableState) {
  let state = syncTableState(tableState);
  const deck = [...state.deck];
  const communityCards = [...state.communityCards];
  const nextPhase = getNextPhase(state.phase);
  let stageEvent = null;

  if (nextPhase === "flop") {
    communityCards.push(...draw(deck, 3));
    stageEvent = event("dealer", "Dealer", "flop", `Флоп · ${describeCards(communityCards.slice(0, 3))}`, {
      revealCount: 3,
      pot: state.pot,
    });
  }

  if (nextPhase === "turn") {
    const card = draw(deck, 1)[0];
    communityCards.push(card);
    stageEvent = event("dealer", "Dealer", "turn", `Тёрн · ${describeCards([card])}`, {
      revealCount: 4,
      pot: state.pot,
    });
  }

  if (nextPhase === "river") {
    const card = draw(deck, 1)[0];
    communityCards.push(card);
    stageEvent = event("dealer", "Dealer", "river", `Ривер · ${describeCards([card])}`, {
      revealCount: 5,
      pot: state.pot,
    });
  }

  const resetSeats = getAllSeats(state).map((seat) => ({
    ...seat,
    currentBet: 0,
    acted: seat.folded || seat.allIn,
    lastAction: seat.folded ? "fold" : seat.allIn ? "all-in" : "ready",
    lastAmount: 0,
  }));

  state = setAllSeats(state, resetSeats);

  return {
    tableState: syncTableState({
      ...state,
      deck,
      communityCards,
      phase: nextPhase,
      currentBet: 0,
      minRaise: 0,
      streetRaises: 0,
      actionLog: [...state.actionLog, `${STREET_LABELS[nextPhase]}.`],
    }),
    event: stageEvent,
  };
}

function resolveShowdown(tableState, table) {
  const state = syncTableState(tableState);
  const activeSeats = getAllSeats(state).filter((seat) => !seat.folded);
  const hands = activeSeats.map((seat) => ({
    seat,
    hand: evaluateBestHand([...seat.holeCards, ...state.communityCards]),
  }));

  hands.sort((a, b) => compareHands(a.hand, b.hand)).reverse();
  const best = hands[0];
  const winners = hands.filter((entry) => compareHands(entry.hand, best.hand) === 0);
  const splitAmount = Math.floor(state.pot / winners.length);
  const playerHand = hands.find((entry) => entry.seat.id === "player")?.hand ?? null;
  const playerWinner = winners.some((entry) => entry.seat.id === "player");
  const mainWinner = winners[0];
  const split = winners.length > 1;
  const bankrollDelta = playerWinner ? splitAmount - state.playerInvested : -state.playerInvested;

  return {
    winner: playerWinner ? "player" : mainWinner.seat.id,
    winnerId: split ? winners.map((entry) => entry.seat.id).join(",") : mainWinner.seat.id,
    winnerName: split ? `Сплит: ${winners.map((entry) => entry.seat.name).join(" / ")}` : mainWinner.seat.name,
    winningHand: best.hand,
    pot: state.pot,
    split,
    splitAmount,
    showdown: true,
    bankrollDelta,
    reputationGain: playerWinner ? table.difficulty + 2 : 0,
    xp: playerWinner ? 20 + table.difficulty * 5 : 8 + table.difficulty * 3,
    playerHand,
    winnerHand: best.hand,
    showdownHands: hands.map((entry) => ({
      id: entry.seat.id,
      name: entry.seat.name,
      hand: entry.hand,
      cards: entry.seat.holeCards,
    })),
    logs: buildResultLogs({ playerWinner, split, winners, best, state, bankrollDelta }),
  };
}

function buildShowdownTimeline(tableState, result) {
  const state = syncTableState(tableState);
  const revealEvents = getAllSeats(state)
    .filter((seat) => !seat.folded && seat.id !== "player")
    .slice(0, 4)
    .map((seat) => event(seat.id, seat.name, "show", `${seat.name}: ${describeCards(seat.holeCards)}`, { pot: state.pot, revealCount: 5 }));

  return [
    event("dealer", "Dealer", "showdown", "Showdown", { pot: state.pot, revealCount: 5 }),
    ...revealEvents,
    buildWinnerEvent(state, result),
  ];
}

function buildFoldResult(tableState, table) {
  const state = syncTableState(tableState);
  const activeNpcs = state.npcSeats.filter((seat) => !seat.folded);
  const winnerSeat = activeNpcs[0] ?? state.npcSeats[0];
  return {
    winner: winnerSeat?.id ?? "table",
    winnerId: winnerSeat?.id ?? "table",
    winnerName: winnerSeat?.name ?? "Стол",
    pot: state.pot,
    bankrollDelta: -state.playerInvested,
    reputationGain: 0,
    xp: 4 + table.difficulty,
    playerHand: null,
    showdown: false,
    logs: [`Fold · -$${state.playerInvested}.`],
  };
}

function buildSingleWinnerResult(tableState, table, winnerSeat) {
  const state = syncTableState(tableState);
  const isPlayer = winnerSeat.id === "player";
  return {
    winner: winnerSeat.id,
    winnerId: winnerSeat.id,
    winnerName: winnerSeat.name,
    winningHand: null,
    pot: state.pot,
    bankrollDelta: isPlayer ? state.pot - state.playerInvested : -state.playerInvested,
    reputationGain: isPlayer ? table.difficulty + 1 : 0,
    xp: isPlayer ? 16 + table.difficulty * 4 : 6 + table.difficulty * 2,
    playerHand: null,
    showdown: false,
    logs: [isPlayer ? `Все сбросили · +$${state.pot - state.playerInvested}.` : `${winnerSeat.name} забирает банк.`],
  };
}

function buildWinnerEvent(tableState, result) {
  return event(result.winnerId ?? result.winner, result.winnerName ?? "Победитель", "winner", `${result.winnerName ?? "Победитель"} · $${result.pot}`, {
    pot: result.pot,
    winnerId: result.winnerId ?? result.winner,
    revealCount: tableState.phase === "finished" ? getRevealCountForPhase(tableState.phase, tableState) : tableState.communityCards?.length ?? 0,
    handName: result.winningHand?.categoryName,
  });
}

function buildResultLogs({ playerWinner, split, winners, best, bankrollDelta }) {
  if (split) {
    return [`Сплит: ${winners.map((entry) => entry.seat.name).join(" / ")} · ${best.hand.categoryName}.`, `Итог: ${formatDelta(bankrollDelta)}.`];
  }
  if (playerWinner) return [`Ты выиграл · ${best.hand.categoryName}.`, `Итог: ${formatDelta(bankrollDelta)}.`];
  return [`${winners[0].seat.name} выиграл · ${best.hand.categoryName}.`, `Итог: ${formatDelta(bankrollDelta)}.`];
}

function beginBettingRound(tableState, firstActorId) {
  const seats = getAllSeats(tableState).map((seat) => ({
    ...seat,
    acted: seat.folded || seat.allIn ? true : false,
  }));
  return setCurrentActor(setAllSeats(tableState, seats), firstActorId);
}

function postBlinds(tableState, table) {
  let state = syncTableState(tableState);
  const sb = findBlindSeat(state, "small");
  const bb = findBlindSeat(state, "big");
  let pot = state.pot;

  if (sb) {
    const posted = Math.min(table.smallBlind, sb.stack);
    const nextSb = applyContribution(sb, posted);
    state = setSeat(state, { ...nextSb, lastAction: "sb", lastAmount: posted });
    pot += posted;
  }

  if (bb) {
    const posted = Math.min(table.bigBlind, bb.stack);
    const nextBb = applyContribution(bb, posted);
    state = setSeat(state, { ...nextBb, lastAction: "bb", lastAmount: posted });
    pot += posted;
  }

  return syncTableState({
    ...state,
    pot,
    currentBet: table.bigBlind,
    minRaise: table.bigBlind,
    streetRaises: 0,
    actionLog: [...state.actionLog, `Блайнды $${table.smallBlind}/$${table.bigBlind}.`],
  });
}

function assignPositions(tableState) {
  const total = getAllSeats(tableState).length;
  const labels = getPositionLabels(total);
  const seats = getAllSeats(tableState).map((seat) => {
    const relative = normalizeIndex(seat.seatIndex - tableState.buttonSeatIndex, total);
    const position = labels[relative] ?? `P${relative + 1}`;
    return {
      ...seat,
      position,
      isDealer: relative === 0,
      isSmallBlind: relative === 1,
      isBigBlind: relative === 2,
    };
  });
  return setAllSeats(tableState, seats);
}

function getPositionLabels(total) {
  if (total <= 2) return ["BTN/SB", "BB"];
  if (total === 3) return ["BTN", "SB", "BB"];
  if (total === 4) return ["BTN", "SB", "BB", "CO"];
  if (total === 5) return ["BTN", "SB", "BB", "UTG", "CO"];
  return ["BTN", "SB", "BB", "UTG", "MP", "CO"];
}

function getFirstPreflopActor(tableState) {
  const total = getAllSeats(tableState).length;
  if (total <= 2) return getSeatByRelativePosition(tableState, 0)?.id;
  return getNextActiveSeatAfter(tableState, getSeatByRelativePosition(tableState, 2)?.seatIndex ?? tableState.buttonSeatIndex)?.id;
}

function getFirstPostflopActor(tableState) {
  return getNextActiveSeatAfter(tableState, tableState.buttonSeatIndex)?.id;
}

function getFirstActorForCurrentRound(tableState) {
  if (tableState.phase === "preflop") return getFirstPreflopActor(tableState);
  return getFirstPostflopActor(tableState);
}

function isBettingRoundComplete(tableState) {
  const active = getAllSeats(tableState).filter((seat) => !seat.folded && !seat.allIn);
  if (active.length <= 1) return true;
  return active.every((seat) => seat.acted && getToCall(tableState, seat) === 0);
}

function getOnlyActiveSeat(tableState) {
  const active = getAllSeats(tableState).filter((seat) => !seat.folded);
  return active.length === 1 ? active[0] : null;
}

function getNextPhase(phase) {
  const index = PHASES.indexOf(phase);
  return PHASES[index + 1] ?? "showdown";
}

function getToCall(tableState, seat) {
  return Math.max(0, (tableState.currentBet ?? 0) - (seat?.currentBet ?? 0));
}

function canRaise(tableState, seat) {
  if (!seat || seat.folded || seat.allIn) return false;
  if ((tableState.streetRaises ?? 0) >= 2) return false;
  const target = getDefaultRaiseTarget(tableState, { bigBlind: tableState.bigBlind || tableState.minRaise || 20 }, seat);
  return seat.stack > Math.max(0, target - seat.currentBet);
}

function getDefaultRaiseTarget(tableState, table, seat) {
  const bigBlind = table.bigBlind || tableState.minRaise || 20;
  const currentBet = tableState.currentBet ?? 0;
  const minRaise = tableState.minRaise || bigBlind;
  if (currentBet <= 0) return Math.min(seat.currentBet + seat.stack, bigBlind * 2);
  return Math.min(seat.currentBet + seat.stack, currentBet + minRaise);
}

function normalizeAction(action, state, seat, table) {
  const toCall = getToCall(state, seat);
  if (action === "raise") return "raise";
  if (action === "call" && toCall > 0) return "call";
  if (action === "check" && toCall <= 0) return "check";
  if (action === "fold") return "fold";
  if (toCall > 0) return "call";
  return "check";
}

function applyContribution(seat, amount) {
  const contribution = clampMoney(Math.min(amount, seat.stack));
  const nextStack = clampMoney(seat.stack - contribution);
  return {
    ...seat,
    stack: nextStack,
    currentBet: clampMoney((seat.currentBet ?? 0) + contribution),
    invested: clampMoney((seat.invested ?? 0) + contribution),
    allIn: nextStack <= 0,
  };
}

function getSeatById(tableState, seatId) {
  return getAllSeats(tableState).find((seat) => seat.id === seatId) ?? null;
}

function getSeatByRelativePosition(tableState, relativePosition) {
  const total = getAllSeats(tableState).length;
  const targetIndex = normalizeIndex((tableState.buttonSeatIndex ?? 0) + relativePosition, total);
  return getAllSeats(tableState).find((seat) => seat.seatIndex === targetIndex) ?? null;
}

function getNextSeatId(tableState, fromSeatIndex) {
  return getNextActiveSeatAfter(tableState, fromSeatIndex)?.id ?? null;
}

function getNextActiveSeatAfter(tableState, fromSeatIndex) {
  const seats = getAllSeats(tableState);
  if (!seats.length) return null;
  const total = seats.length;
  for (let offset = 1; offset <= total; offset += 1) {
    const index = normalizeIndex(fromSeatIndex + offset, total);
    const seat = seats.find((entry) => entry.seatIndex === index);
    if (seat && !seat.folded && !seat.allIn) return seat;
  }
  return null;
}

function setCurrentActor(tableState, seatId) {
  const seat = getSeatById(tableState, seatId);
  return syncTableState({
    ...tableState,
    currentActorId: seat?.id ?? null,
    currentActorName: seat?.name ?? null,
  });
}

function setSeat(tableState, seat) {
  if (seat.id === "player") return syncTableState({ ...tableState, heroSeat: seat });
  const npcSeats = (tableState.npcSeats ?? []).map((entry) => (entry.id === seat.id ? seat : entry));
  return syncTableState({ ...tableState, npcSeats });
}

function setAllSeats(tableState, seats) {
  const heroSeat = seats.find((seat) => seat.id === "player") ?? tableState.heroSeat;
  const npcSeats = seats.filter((seat) => seat.id !== "player");
  return syncTableState({ ...tableState, heroSeat, npcSeats });
}

function getAllSeats(tableState) {
  return [tableState.heroSeat, ...(tableState.npcSeats ?? [])].filter(Boolean).sort((a, b) => a.seatIndex - b.seatIndex);
}

function syncTableState(tableState) {
  const heroSeat = tableState.heroSeat ? { ...tableState.heroSeat } : null;
  const npcSeats = (tableState.npcSeats ?? []).map((seat) => ({ ...seat, npc: seat.npc }));
  return {
    ...tableState,
    heroSeat,
    npcSeats,
    playerHoleCards: heroSeat?.holeCards ?? tableState.playerHoleCards ?? [],
    activeNpcSeats: npcSeats.filter((seat) => !seat.folded).map((seat) => seat.id),
    playerInvested: heroSeat?.invested ?? tableState.playerInvested ?? 0,
  };
}

function buildHeroSeat({ holeCards, stack, seatIndex }) {
  return {
    id: "player",
    type: "player",
    name: "Ты",
    npc: null,
    holeCards,
    folded: false,
    allIn: false,
    acted: false,
    invested: 0,
    currentBet: 0,
    stack,
    seatIndex,
    position: "—",
    lastAction: "ready",
    lastAmount: 0,
    isDealer: false,
    isSmallBlind: false,
    isBigBlind: false,
  };
}

function buildNpcSeat({ npc, holeCards, stack, seatIndex }) {
  return {
    id: npc.id,
    type: "npc",
    name: npc.name,
    npc,
    holeCards,
    folded: false,
    allIn: false,
    acted: false,
    invested: 0,
    currentBet: 0,
    stack,
    seatIndex,
    position: "—",
    lastAction: "ready",
    lastAmount: 0,
    isDealer: false,
    isSmallBlind: false,
    isBigBlind: false,
  };
}

function findBlindSeat(tableState, type) {
  return getAllSeats(tableState).find((seat) => (type === "small" ? seat.isSmallBlind : seat.isBigBlind)) ?? null;
}

function getNextButtonIndex(totalSeats) {
  if (totalSeats <= 0) return 0;
  return Math.floor(Math.random() * totalSeats);
}

function normalizeIndex(index, total) {
  return ((index % total) + total) % total;
}

function getRevealCountForPhase(phase, tableState = null) {
  if (phase === "flop") return 3;
  if (phase === "turn") return 4;
  if (phase === "river" || phase === "showdown" || phase === "finished") return 5;
  return tableState?.communityCards?.length ?? 0;
}

function clampMoney(value) {
  return Math.max(0, Math.round(Number(value) || 0));
}

function formatDelta(value) {
  return value >= 0 ? `+$${value}` : `-$${Math.abs(value)}`;
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
    position: patch.position,
    actorStack: patch.actorStack,
    source: patch.source,
    createdAt: Date.now(),
  };
}
