import { PHASES } from "./constants.js?v=1.1.0";
import { getToCall } from "./betting.js?v=1.1.0";
import { getAllSeats, getNextActiveSeatAfter, getNextSeatId, getSeatByRelativePosition, setAllSeats, setCurrentActor, syncTableState } from "./seats.js?v=1.1.0";

export function beginBettingRound(tableState, firstActorId) {
  const seats = getAllSeats(tableState).map((seat) => ({
    ...seat,
    acted: seat.folded || seat.allIn ? true : false,
  }));
  return setCurrentActor(setAllSeats(tableState, seats), firstActorId);
}

export function getFirstPreflopActor(tableState) {
  const total = getAllSeats(tableState).length;
  if (total <= 2) return getSeatByRelativePosition(tableState, 0)?.id;
  return getNextActiveSeatAfter(tableState, getSeatByRelativePosition(tableState, 2)?.seatIndex ?? tableState.buttonSeatIndex)?.id;
}

export function getFirstPostflopActor(tableState) {
  return getNextActiveSeatAfter(tableState, tableState.buttonSeatIndex)?.id;
}

export function getFirstActorForCurrentRound(tableState) {
  if (tableState.phase === "preflop") return getFirstPreflopActor(tableState);
  return getFirstPostflopActor(tableState);
}

export function isBettingRoundComplete(tableState) {
  const active = getAllSeats(tableState).filter((seat) => !seat.folded && !seat.allIn);
  if (active.length <= 1) return true;
  return active.every((seat) => seat.acted && getToCall(tableState, seat) === 0);
}

export function shouldKeepNpcInHandBeforeHeroDecision(tableState, actor, decision) {
  const requestedAction = typeof decision === "string" ? decision : decision?.action;
  if (requestedAction !== "fold") return false;
  if (!actor || actor.id === "player") return false;
  if (tableState.phase !== "preflop") return false;
  if ((tableState.communityCards?.length ?? 0) > 0) return false;
  if (tableState.lastPlayerAction) return false;

  const hero = tableState.heroSeat;
  if (!hero || hero.folded || hero.allIn) return false;

  const remainingAfterFold = getAllSeats(tableState).filter((seat) => !seat.folded && seat.id !== actor.id);
  return remainingAfterFold.length === 1 && remainingAfterFold[0]?.id === "player";
}

export function getNextPhase(phase) {
  const index = PHASES.indexOf(phase);
  return PHASES[index + 1] ?? "showdown";
}

export function movePastInactiveActor(tableState, actor) {
  const nextId = getNextSeatId(tableState, actor.seatIndex) ?? getFirstActorForCurrentRound(tableState);
  if (!nextId || nextId === actor.id) {
    return syncTableState({
      ...tableState,
      currentActorId: null,
      currentActorName: null,
    });
  }
  return setCurrentActor(tableState, nextId);
}
