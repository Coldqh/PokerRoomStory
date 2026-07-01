import { compareHands, evaluateBestHand } from "../cards.js?v=1.1.0";
import { getAllSeats, syncTableState } from "./seats.js?v=1.1.0";

export function resolveShowdown(tableState, table) {
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
    review: buildHandReview({ state, playerWinner, split, bankrollDelta, playerHand }),
  };
}

export function buildFoldResult(tableState, table) {
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
    review: buildHandReview({ state, playerWinner: false, folded: true, bankrollDelta: -state.playerInvested, playerHand: null }),
  };
}

export function buildSingleWinnerResult(tableState, table, winnerSeat) {
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
    review: buildHandReview({ state, playerWinner: isPlayer, folded: false, bankrollDelta: isPlayer ? state.pot - state.playerInvested : -state.playerInvested, playerHand: null }),
  };
}

export function buildHandReview({ state, playerWinner, split = false, folded = false, bankrollDelta = 0, playerHand = null }) {
  const invested = state.playerInvested ?? 0;
  const lastAction = state.lastPlayerAction ?? "";

  if (folded) {
    return {
      title: "Пас",
      text: invested > state.bigBlind * 3 ? "Проверь, не слишком дорого зашёл до фолда." : "Нормально. Иногда лучший ход — не платить дальше.",
    };
  }

  if (split) {
    return { title: "Сплит", text: "Банк поделён. Рука дошла до равного шоудауна." };
  }

  if (playerWinner) {
    return {
      title: "Плюс",
      text: lastAction === "raise" || lastAction === "bet" ? "Инициатива сработала. Следи, чтобы ставка была на вэлью." : "Банк забран. Проверь, где соперники оплатили руку.",
    };
  }

  if (bankrollDelta < 0) {
    const handName = playerHand?.categoryName ?? "руку";
    return { title: "Минус", text: `Проиграл ${handName}. Посмотри, сколько стоил последний колл.` };
  }

  return { title: "Разбор", text: "Раздача закрыта. Главное — банк, позиция, цена колла." };
}

export function buildResultLogs({ playerWinner, split, winners, best, bankrollDelta }) {
  if (split) {
    return [`Сплит: ${winners.map((entry) => entry.seat.name).join(" / ")} · ${best.hand.categoryName}.`, `Итог: ${formatDelta(bankrollDelta)}.`];
  }
  if (playerWinner) return [`Ты выиграл · ${best.hand.categoryName}.`, `Итог: ${formatDelta(bankrollDelta)}.`];
  return [`${winners[0].seat.name} выиграл · ${best.hand.categoryName}.`, `Итог: ${formatDelta(bankrollDelta)}.`];
}

export function formatDelta(value) {
  return value >= 0 ? `+$${value}` : `-$${Math.abs(value)}`;
}
