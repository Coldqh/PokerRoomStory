import { buildActionHandEvent } from "./events.js?v=1.0.0";
import { applyContribution, findBlindSeat, getAllSeats, setAllSeats, setSeat, syncTableState } from "./seats.js?v=1.0.0";
import { normalizeIndex } from "./tableNpcs.js?v=1.0.0";

export function postBlinds(tableState, table) {
  let state = syncTableState(tableState);
  const sb = findBlindSeat(state, "small");
  const bb = findBlindSeat(state, "big");
  let pot = state.pot;
  let blindEvents = [];

  if (sb) {
    const posted = Math.min(table.smallBlind, sb.stack);
    const nextSb = applyContribution(sb, posted);
    state = setSeat(state, { ...nextSb, lastAction: "sb", lastAmount: posted });
    pot += posted;
    blindEvents.push(buildActionHandEvent(state, { ...nextSb, name: sb.name }, "sb", posted, pot));
  }

  if (bb) {
    const posted = Math.min(table.bigBlind, bb.stack);
    const nextBb = applyContribution(bb, posted);
    state = setSeat(state, { ...nextBb, lastAction: "bb", lastAmount: posted });
    pot += posted;
    blindEvents.push(buildActionHandEvent(state, { ...nextBb, name: bb.name }, "bb", posted, pot));
  }

  return syncTableState({
    ...state,
    pot,
    currentBet: table.bigBlind,
    minRaise: table.bigBlind,
    streetRaises: 0,
    actionLog: [...state.actionLog, `Блайнды $${table.smallBlind}/$${table.bigBlind}.`],
    handEvents: [...(state.handEvents ?? []), ...blindEvents],
  });
}

export function assignPositions(tableState) {
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

export function getPositionLabels(total) {
  if (total <= 2) return ["BTN/SB", "BB"];
  if (total === 3) return ["BTN", "SB", "BB"];
  if (total === 4) return ["BTN", "SB", "BB", "CO"];
  if (total === 5) return ["BTN", "SB", "BB", "UTG", "CO"];
  return ["BTN", "SB", "BB", "UTG", "MP", "CO"];
}
