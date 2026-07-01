import { clampMoney } from "./seats.js?v=0.9.6";

export function getToCall(tableState, seat) {
  return Math.max(0, (tableState.currentBet ?? 0) - (seat?.currentBet ?? 0));
}

export function canRaise(tableState, seat) {
  if (!seat || seat.folded || seat.allIn) return false;
  if ((tableState.streetRaises ?? 0) >= 2) return false;
  const target = getDefaultRaiseTarget(tableState, { bigBlind: tableState.bigBlind || tableState.minRaise || 20 }, seat);
  return seat.stack >= Math.max(1, target - seat.currentBet);
}

export function getDefaultRaiseTarget(tableState, table, seat) {
  const bigBlind = table.bigBlind || tableState.minRaise || 20;
  const currentBet = tableState.currentBet ?? 0;
  if (currentBet <= 0) return getLegalRaiseTarget(tableState, table, seat, bigBlind * 2);
  return getMinRaiseTarget(tableState, table, seat);
}

export function getMinRaiseTarget(tableState, table, seat) {
  const bigBlind = table.bigBlind || tableState.minRaise || 20;
  const currentBet = tableState.currentBet ?? 0;
  const minRaise = tableState.minRaise || bigBlind;
  const minTarget = currentBet <= 0 ? bigBlind : currentBet + minRaise;
  return Math.min(seat.currentBet + seat.stack, minTarget);
}

export function getLegalRaiseTarget(tableState, table, seat, requestedTarget) {
  const minTarget = getMinRaiseTarget(tableState, table, seat);
  const maxTarget = seat.currentBet + seat.stack;
  const requested = Math.round(Number(requestedTarget));
  if (!Number.isFinite(requested)) return minTarget;
  return clampMoney(Math.max(Math.min(requested, maxTarget), minTarget));
}

export function normalizeAction(action, state, seat, table) {
  const toCall = getToCall(state, seat);
  if (action === "raise") return "raise";
  if (action === "call" && toCall > 0) return "call";
  if (action === "check" && toCall <= 0) return "check";
  if (action === "fold") return "fold";
  if (toCall > 0) return "call";
  return "check";
}
