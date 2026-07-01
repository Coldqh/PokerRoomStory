import { clampMoney } from "./seats.js?v=1.0.1";

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
export function getBetSizeOptions(tableState, table = null) {
  const hero = tableState?.heroSeat;
  if (!hero || hero.folded || hero.allIn || ["idle", "finished", "folded"].includes(tableState?.phase)) return [];
  if (!canRaise(tableState, hero)) return [];

  const safeTable = table ?? { bigBlind: tableState.bigBlind || tableState.minRaise || 20 };
  const bigBlind = Math.max(1, Number(safeTable.bigBlind ?? tableState.bigBlind ?? 2));
  const toCall = getToCall(tableState, hero);
  const pot = Math.max(0, Number(tableState.pot ?? 0));
  const baseBet = hero.currentBet ?? 0;

  const raw = [
    { id: "min", label: "Min", target: getMinRaiseTarget(tableState, safeTable, hero) },
    { id: "bb25", label: "2.5 BB", target: Math.round(bigBlind * 2.5) },
    { id: "half", label: "1/2 Pot", target: baseBet + toCall + Math.ceil(Math.max(pot, bigBlind) / 2) },
    { id: "pot", label: "Pot", target: baseBet + toCall + Math.max(pot, bigBlind) },
  ];

  const seen = new Set();
  return raw
    .map((option) => ({ ...option, target: getLegalRaiseTarget(tableState, safeTable, hero, option.target) }))
    .filter((option) => {
      if (!Number.isFinite(option.target) || option.target <= (hero.currentBet ?? 0)) return false;
      if (seen.has(option.target)) return false;
      seen.add(option.target);
      return true;
    })
    .map((option) => ({
      ...option,
      cost: Math.max(0, option.target - (hero.currentBet ?? 0)),
      actionLabel: (tableState.currentBet ?? 0) > 0 ? `Raise $${option.target}` : `Bet $${option.target}`,
    }));
}
