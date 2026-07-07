import { describeCards } from "../cards.js?v=3.5.0";
import { createAnimationState, getRevealCountForPhase } from "./state.js?v=3.5.0";
import { applyContribution, findBlindSeat, getAllSeats, getSeatById, setSeat, syncTableState } from "./seats.js?v=3.5.0";

export function eventWithSnapshot(tableState, actionEvent) {
  if (!actionEvent) return actionEvent;
  const snapshot = createTimelineSnapshot(tableState, actionEvent);
  return { ...actionEvent, snapshot };
}

export function createTimelineSnapshot(tableState, actionEvent = null) {
  const state = syncTableState(tableState);
  const revealCount = typeof actionEvent?.revealCount === "number"
    ? actionEvent.revealCount
    : getRevealCountForPhase(state.phase, state);

  return {
    ...state,
    awaitingPlayer: false,
    animation: createAnimationState({
      revealedCommunityCount: revealCount,
      showWinner: actionEvent?.action === "winner",
    }),
  };
}

export function buildStartHandTimeline(tableState, table) {
  const smallBlind = findBlindSeat(tableState, "small");
  const bigBlind = findBlindSeat(tableState, "big");
  const base = makeStartSnapshotBase(tableState);
  const events = [];

  events.push(
    eventWithSnapshot(
      base,
      event("dealer", "Dealer", "shuffle", `Новая раздача · $${table.smallBlind}/$${table.bigBlind}`, {
        pot: 0,
        revealCount: 0,
      }),
    ),
  );

  let staged = base;

  if (smallBlind) {
    staged = applyBlindToSnapshot(staged, smallBlind.id, table.smallBlind);
    events.push(
      eventWithSnapshot(
        staged,
        event(smallBlind.id, smallBlind.name, "blind", `SB $${table.smallBlind}`, {
          amount: table.smallBlind,
          pot: staged.pot,
          revealCount: 0,
        }),
      ),
    );
  }

  if (bigBlind) {
    staged = applyBlindToSnapshot(staged, bigBlind.id, table.bigBlind);
    events.push(
      eventWithSnapshot(
        staged,
        event(bigBlind.id, bigBlind.name, "blind", `BB $${table.bigBlind}`, {
          amount: table.bigBlind,
          pot: staged.pot,
          revealCount: 0,
        }),
      ),
    );
  }

  events.push(eventWithSnapshot(tableState, event("dealer", "Dealer", "deal", "Карты розданы", { pot: tableState.pot, revealCount: 0 })));
  return events;
}

export function makeStartSnapshotBase(tableState) {
  const resetSeat = (seat) => ({
    ...seat,
    invested: 0,
    currentBet: 0,
    folded: false,
    allIn: false,
    acted: false,
    lastAction: "ready",
    lastAmount: 0,
  });

  return syncTableState({
    ...tableState,
    pot: 0,
    currentBet: 0,
    currentActorId: null,
    currentActorName: null,
    awaitingPlayer: false,
    handEvents: [],
    heroSeat: tableState.heroSeat ? resetSeat(tableState.heroSeat) : null,
    npcSeats: (tableState.npcSeats ?? []).map(resetSeat),
  });
}

export function applyBlindToSnapshot(tableState, seatId, amount) {
  const seat = getSeatById(tableState, seatId);
  if (!seat) return tableState;
  const posted = Math.min(amount, seat.stack);
  const nextSeat = {
    ...applyContribution(seat, posted),
    acted: false,
    lastAction: seat.isSmallBlind ? "sb" : seat.isBigBlind ? "bb" : "blind",
    lastAmount: posted,
  };

  return syncTableState({
    ...setSeat(tableState, nextSeat),
    pot: (tableState.pot ?? 0) + posted,
    currentBet: Math.max(tableState.currentBet ?? 0, nextSeat.currentBet ?? 0),
  });
}

export function buildShowdownTimeline(tableState, result) {
  const state = syncTableState(tableState);
  const revealEvents = getAllSeats(state)
    .filter((seat) => !seat.folded && seat.id !== "player")
    .slice(0, 4)
    .map((seat) => event(seat.id, seat.name, "show", `${seat.name}: ${describeCards(seat.holeCards)}`, { pot: state.pot, revealCount: 5 }));

  return [
    event("dealer", "Dealer", "showdown", "Showdown", { pot: state.pot, revealCount: 5 }),
    ...revealEvents,
    buildWinnerEvent(state, result),
  ].map((entry) => eventWithSnapshot(state, entry));
}

export function buildWinnerEvent(tableState, result) {
  return event(result.winnerId ?? result.winner, result.winnerName ?? "Победитель", "winner", `${result.winnerName ?? "Победитель"} · $${result.pot}`, {
    pot: result.pot,
    winnerId: result.winnerId ?? result.winner,
    revealCount: tableState.phase === "finished" ? getRevealCountForPhase(tableState.phase, tableState) : tableState.communityCards?.length ?? 0,
    handName: result.winningHand?.categoryName,
  });
}

export function buildActionHandEvent(tableState, seat, action, amount = 0, pot = 0) {
  return {
    street: normalizeStreetForEvent(tableState.phase),
    actorId: seat.id,
    actorName: seat.name,
    action,
    amount: amount ?? 0,
    pot: pot ?? tableState.pot ?? 0,
  };
}

export function buildStreetHandEvent(phase, pot = 0) {
  return {
    street: normalizeStreetForEvent(phase),
    actorId: "dealer",
    actorName: "Dealer",
    action: phase,
    amount: 0,
    pot,
  };
}

export function buildResultHandEvent(tableState, result) {
  return {
    street: normalizeStreetForEvent(tableState.phase),
    actorId: result.winnerId ?? result.winner ?? "winner",
    actorName: result.winnerName ?? "Победитель",
    action: "winner",
    amount: result.pot ?? tableState.pot ?? 0,
    pot: result.pot ?? tableState.pot ?? 0,
  };
}

export function appendHandEvent(tableState, handEvent) {
  if (!handEvent) return tableState.handEvents ?? [];
  const events = Array.isArray(tableState.handEvents) ? tableState.handEvents : [];
  return [
    ...events,
    {
      id: `${events.length + 1}_${handEvent.street}_${handEvent.actorId}_${handEvent.action}`,
      index: events.length,
      ...handEvent,
    },
  ];
}

export function normalizeStreetForEvent(phase) {
  if (["preflop", "flop", "turn", "river"].includes(phase)) return phase;
  if (phase === "showdown") return "river";
  return phase || "preflop";
}

export function event(actorId, actorName, action, message, patch = {}) {
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
    snapshot: patch.snapshot ?? null,
    createdAt: Date.now(),
  };
}
