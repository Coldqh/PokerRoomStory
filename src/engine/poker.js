import { createDeck, draw } from "./cards.js?v=3.6.0";
import { createInitialTableState, createAnimationState, getRevealCountForPhase } from "./poker/state.js?v=3.6.0";
import { canRaise, getBetSizeOptions, getDefaultRaiseTarget, getLegalRaiseTarget, getToCall, normalizeAction } from "./poker/betting.js?v=3.6.0";
import {
  applyContribution,
  buildHeroSeat,
  buildNpcSeat,
  clampMoney,
  getActiveNpcSeats,
  getAllSeats,
  getNextSeatId,
  getOnlyActiveSeat,
  getSeatById,
  setAllSeats,
  setCurrentActor,
  setSeat,
  syncTableState,
} from "./poker/seats.js?v=3.6.0";
import { assignPositions, postBlinds } from "./poker/setup.js?v=3.6.0";
import { getNextButtonIndex, prepareDynamicTableNpcs } from "./poker/tableNpcs.js?v=3.6.0";
import {
  beginBettingRound,
  getFirstActorForCurrentRound,
  getFirstPostflopActor,
  getFirstPreflopActor,
  isBettingRoundComplete,
  movePastInactiveActor,
  shouldKeepNpcInHandBeforeHeroDecision,
} from "./poker/rounds.js?v=3.6.0";
import {
  appendHandEvent,
  buildActionHandEvent,
  buildResultHandEvent,
  buildShowdownTimeline,
  buildStartHandTimeline,
  buildWinnerEvent,
  event,
  eventWithSnapshot,
} from "./poker/events.js?v=3.6.0";
import { advanceStreet } from "./poker/streets.js?v=3.6.0";
import { buildFoldResult, buildSingleWinnerResult, resolveShowdown } from "./poker/results.js?v=3.6.0";
import { applyClubDecisionBias, decideNpcForState } from "./poker/npcDecision.js?v=3.6.0";

export { createInitialTableState, createAnimationState };
export { getBetSizeOptions } from "./poker/betting.js?v=3.6.0";
export { buildStartHandTimeline } from "./poker/events.js?v=3.6.0";
export { getCurrentHandInfo, getHandHint, getPhaseLabel, getUnlockConditionsFromHand } from "./poker/handInfo.js?v=3.6.0";

export function startNewHand({ content, table, club, player, previousTableState = null, clubSnapshot = null }) {
  const deck = createDeck();
  const tableNpcSetup = prepareDynamicTableNpcs(content, table, club, previousTableState, clubSnapshot);
  const npcs = tableNpcSetup.npcs;
  const totalSeats = npcs.length + 1;
  const buttonSeatIndex = getNextButtonIndex(totalSeats, previousTableState?.buttonSeatIndex);
  const previousNpcStacks = buildPreviousNpcStackMap(previousTableState);
  const heroStack = clampMoney(player.tableStack ?? Math.min(player.bankroll, table.maxBuyIn));

  const heroSeat = buildHeroSeat({
    holeCards: draw(deck, 2),
    stack: heroStack,
    seatIndex: 0,
  });

  const npcSeats = npcs.map((npc, index) =>
    buildNpcSeat({
      npc,
      holeCards: draw(deck, 2),
      stack: getNpcStartingStack(npc, table, previousNpcStacks),
      seatIndex: index + 1,
      mood: clubSnapshot?.npcMoods?.[npc.id] ?? "calm",
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
    handEvents: [],
    awaitingPlayer: false,
    buyInWarning: player.bankroll < table.bigBlind * 20,
    clubEvent: clubSnapshot?.activeEvent ?? null,
    clubDay: clubSnapshot?.day ?? 1,
    clubRep: clubSnapshot?.clubRep ?? 0,
    tableDynamics: tableNpcSetup.dynamics,
    animation: createAnimationState(),
  });

  tableState = assignPositions(tableState);
  tableState = postBlinds(tableState, table);
  tableState = beginBettingRound(tableState, getFirstPreflopActor(tableState));

  return syncTableState(tableState);
}

export function advanceUntilPlayerOrEnd({ tableState, table }) {
  return autoAdvance(syncTableState(tableState), table);
}

export function applyPlayerAction({ tableState, player, action, table, raiseTarget = null }) {
  if (!tableState || !tableState.awaitingPlayer || tableState.animation?.isPlaying) {
    return { tableState, player, result: null, timeline: [] };
  }

  let state = syncTableState(tableState);
  const hero = state.heroSeat;
  const available = getAvailableActions(state);
  const hardFold = action === "fold" && hero && !hero.folded && !hero.allIn && !["idle", "finished", "folded"].includes(state.phase);
  if (!hardFold && !available.includes(action)) {
    return { tableState: state, player, result: null, timeline: [] };
  }

  const playerDecision = action === "raise" ? { action: "raise", raiseTarget } : action === "fold" ? "fold" : normalizeAction(action, state, hero, table);
  const commit = commitSeatAction(state, hero.id, playerDecision, table, { source: "player" });
  state = commit.tableState;
  const timeline = commit.event ? [eventWithSnapshot(state, commit.event)] : [];

  state = { ...state, lastPlayerAction: commit.event?.action ?? state.lastPlayerAction, awaitingPlayer: false };

  if (state.heroSeat.folded) {
    const activeNpcs = getActiveNpcSeats(state);

    if (activeNpcs.length <= 1) {
      const result = buildFoldResult(state, table);
      const finished = syncTableState({
        ...state,
        phase: "folded",
        awaitingPlayer: false,
        currentActorId: null,
        currentActorName: null,
        lastResult: result,
        actionLog: [...state.actionLog, ...result.logs],
        handEvents: appendHandEvent(state, buildResultHandEvent(state, result)),
      });
      timeline.push(eventWithSnapshot(finished, buildWinnerEvent(finished, result)));
      return { tableState: finished, player, result, timeline };
    }

    const nextNpcId = getNextSeatId(state, hero.seatIndex) ?? activeNpcs[0]?.id ?? null;
    const auto = autoAdvance(state, table, nextNpcId);
    return {
      tableState: auto.tableState,
      player,
      result: auto.result,
      timeline: [...timeline, ...auto.timeline],
    };
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
  if (hero.folded || hero.allIn || ["finished", "folded", "idle"].includes(tableState.phase)) return [];

  const toCall = getToCall(tableState, hero);
  const actions = ["fold"];

  if (toCall > 0) {
    actions.push("call");
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
  if (hero.folded || ["finished", "folded", "idle"].includes(tableState?.phase)) {
    return {
      toCall: 0,
      currentBet: tableState?.currentBet ?? 0,
      playerBet: hero.currentBet ?? 0,
      playerStack: hero.stack ?? 0,
      raiseTarget: 0,
      raiseCost: 0,
      labels: { fold: "Fold", check: "Check", call: "Call", raise: "Raise" },
    };
  }
  const toCall = getToCall(tableState, hero);
  const safeTable = table ?? { bigBlind: tableState?.bigBlind || tableState?.minRaise || 20 };
  const target = getDefaultRaiseTarget(tableState, safeTable, hero);
  const raiseCost = Math.max(0, target - hero.currentBet);
  const betOptions = getBetSizeOptions(tableState, safeTable);

  return {
    toCall,
    currentBet: tableState.currentBet ?? 0,
    playerBet: hero.currentBet ?? 0,
    playerStack: hero.stack ?? 0,
    raiseTarget: target,
    raiseCost,
    betOptions,
    labels: {
      fold: "Fold",
      check: "Check",
      call: toCall > 0 ? `Call $${Math.min(toCall, hero.stack)}` : "Call",
      raise: (tableState.currentBet ?? 0) > 0 ? `Raise $${target}` : `Bet $${target}`,
    },
  };
}

export function settleTableStacks(tableState, result) {
  const state = syncTableState(tableState);
  if (!result || state.tableEconomy?.settled) return state;

  const pot = clampMoney(result.pot ?? state.pot ?? 0);
  const payouts = getResultPayouts(result, pot);
  const winnerIds = Object.entries(payouts)
    .filter(([, amount]) => amount > 0)
    .map(([id]) => id);
  if (!winnerIds.length) return state;

  const seats = getAllSeats(state).map((seat) => {
    const payout = clampMoney(payouts[seat.id] ?? 0);
    return {
      ...seat,
      stack: clampMoney((seat.stack ?? 0) + payout),
      payout,
    };
  });

  const payoutLines = seats
    .filter((seat) => seat.payout > 0)
    .map((seat) => `${seat.name}: payout $${seat.payout}.`);

  return syncTableState({
    ...setAllSeats(state, seats),
    tableEconomy: {
      ...(state.tableEconomy ?? {}),
      settled: true,
      pot,
      winnerIds,
      payouts,
      potAwards: result.potAwards ?? null,
    },
    actionLog: payoutLines.length ? [...state.actionLog, ...payoutLines] : state.actionLog,
  });
}

function getResultPayouts(result, pot) {
  const payouts = {};
  if (Array.isArray(result?.potAwards) && result.potAwards.length) {
    for (const award of result.potAwards) {
      for (const [id, amount] of Object.entries(award.payouts ?? {})) {
        payouts[id] = clampMoney((payouts[id] ?? 0) + amount);
      }
    }
    return payouts;
  }

  const winnerIds = String(result?.winnerId ?? result?.winner ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  if (!winnerIds.length) return payouts;

  const splitAmount = result.split ? clampMoney(result.splitAmount ?? Math.floor(pot / Math.max(1, winnerIds.length))) : pot;
  for (const id of winnerIds) payouts[id] = splitAmount;
  return payouts;
}


function buildPreviousNpcStackMap(previousTableState = null) {
  const stacks = new Map();
  for (const seat of previousTableState?.npcSeats ?? []) {
    const id = seat?.npc?.id ?? seat?.npcId ?? seat?.id;
    if (!id) continue;
    const stack = clampMoney(seat.stack ?? 0);
    if (stack > 0) stacks.set(id, stack);
  }
  return stacks;
}

function getNpcStartingStack(npc, table, previousNpcStacks) {
  const carriedStack = previousNpcStacks.get(npc.id);
  if (carriedStack > 0) return carriedStack;

  const fallbackBuyIn = table.recommendedBuyIn ?? table.maxBuyIn ?? table.bigBlind * 100;
  return clampMoney(Math.min(npc.bankroll ?? fallbackBuyIn, table.maxBuyIn ?? fallbackBuyIn));
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
        handEvents: appendHandEvent(state, buildResultHandEvent(state, result)),
      });
      timeline.push(eventWithSnapshot(state, buildWinnerEvent(state, result)));
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
          handEvents: appendHandEvent(state, buildResultHandEvent(state, result)),
        });
        timeline.push(...buildShowdownTimeline(state, result));
        return { tableState: state, result, timeline };
      }

      const advanced = advanceStreet(state);
      state = advanced.tableState;
      timeline.push(eventWithSnapshot(state, advanced.event));
      state = setCurrentActor(state, getFirstPostflopActor(state));
      continue;
    }

    const actor = getSeatById(state, state.currentActorId) ?? getSeatById(state, getFirstActorForCurrentRound(state));
    if (!actor) {
      state = setCurrentActor(state, getFirstActorForCurrentRound(state));
      continue;
    }

    if (actor.folded || actor.allIn) {
      state = movePastInactiveActor(state, actor);
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

    let decision = decideNpcForState(state, actor, table);
    if (shouldKeepNpcInHandBeforeHeroDecision(state, actor, decision)) {
      decision = {
        ...decision,
        action: getToCall(state, actor) > 0 ? "call" : "check",
        reason: "protect_first_player_decision",
      };
    }
    decision = applyClubDecisionBias(state, actor, decision, table);

    const commit = commitSeatAction(state, actor.id, decision, table, { source: "npc" });
    state = commit.tableState;
    if (commit.event) timeline.push(eventWithSnapshot(state, commit.event));

    state = setCurrentActor(state, getNextSeatId(state, actor.seatIndex));
  }

  const failEvent = event("dealer", "Dealer", "log", "Раздача остановлена", { pot: state.pot, revealCount: getRevealCountForPhase(state.phase) });
  timeline.push(eventWithSnapshot(state, failEvent));
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

function commitSeatAction(tableState, seatId, decision, table, options = {}) {
  let state = syncTableState(tableState);
  const seat = getSeatById(state, seatId);
  if (!seat) return { tableState: state, event: event("dealer", "Dealer", "log", "Нет игрока", { pot: state.pot }) };

  if (seat.folded || seat.allIn) {
    return {
      tableState: movePastInactiveActor(state, seat),
      event: null,
    };
  }

  const toCall = getToCall(state, seat);
  const requestedAction = typeof decision === "string" ? decision : decision?.action;
  const requestedRaiseTarget = typeof decision === "object" ? decision?.raiseTarget : null;
  const normalized = normalizeAction(requestedAction, state, seat, table);
  const decisionMeta = getDecisionMeta(decision, options, state, seat, toCall);
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
    const target = getLegalRaiseTarget(state, table, seat, requestedRaiseTarget ?? getDefaultRaiseTarget(state, table, seat));
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

  const handEvent = buildActionHandEvent(state, nextSeat, action, amount, nextPot);
  const enrichedHandEvent = decisionMeta.source === "npc"
    ? { ...handEvent, ...decisionMeta }
    : handEvent;

  state = syncTableState({
    ...state,
    pot: nextPot,
    currentBet: nextCurrentBet,
    minRaise: nextMinRaise,
    streetRaises: nextStreetRaises,
    actionLog: [...state.actionLog, `${nextSeat.name}: ${message}.`],
    handEvents: appendHandEvent(state, enrichedHandEvent),
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

function getDecisionMeta(decision, options, state, seat, toCall) {
  const raw = typeof decision === "object" ? decision : {};
  const pressure = Math.max(0, Number(raw.toCall ?? toCall ?? 0));
  const pot = Math.max(0, Number(state?.pot ?? 0));
  return {
    source: options.source,
    reason: raw.reason ?? null,
    previousReason: raw.previousReason ?? null,
    confidence: normalizeMetaNumber(raw.confidence),
    toCall: pressure,
    potOdds: raw.potOdds ?? (pressure > 0 ? normalizeMetaNumber(pressure / Math.max(pot + pressure, 1)) : 0),
    actorStack: Number(seat?.stack ?? 0),
  };
}

function normalizeMetaNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 1000) / 1000 : null;
}
