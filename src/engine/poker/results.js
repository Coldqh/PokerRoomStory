import { compareHands, evaluateBestHand } from "../cards.js?v=1.4.0";
import { getAllSeats, syncTableState } from "./seats.js?v=1.4.0";

export function resolveShowdown(tableState, table) {
  const state = syncTableState(tableState);
  const activeSeats = getAllSeats(state).filter((seat) => !seat.folded);
  const hands = activeSeats.map((seat) => ({
    seat,
    hand: evaluateBestHand([...seat.holeCards, ...state.communityCards]),
  }));

  hands.sort((a, b) => compareHands(a.hand, b.hand)).reverse();

  if (!hands.length) {
    const fallback = buildSingleWinnerResult(state, table, state.heroSeat ?? { id: "table", name: "Стол" });
    return { ...fallback, showdown: true, showdownHands: [] };
  }

  const potAwards = awardPots(buildPotsFromContributions(getAllSeats(state)), hands);
  const payouts = aggregateAwardPayouts(potAwards);
  const heroPayout = payouts.player ?? 0;
  const bankrollDelta = heroPayout - state.playerInvested;
  const playerHand = hands.find((entry) => entry.seat.id === "player")?.hand ?? null;
  const playerNetWinner = bankrollDelta > 0;
  const displayAward = getDisplayAward(potAwards, hands[0]);
  const displayWinnerIds = displayAward?.winnerIds ?? [hands[0].seat.id];
  const displayWinnerNames = displayAward?.winnerNames ?? [hands[0].seat.name];
  const split = potAwards.some((award) => (award.winnerIds?.length ?? 0) > 1);
  const winningHand = displayAward?.hand ?? hands[0].hand;

  return {
    winner: displayWinnerIds.includes("player") ? "player" : displayWinnerIds[0],
    winnerId: displayWinnerIds.join(","),
    winnerName: displayWinnerIds.length > 1 ? `Сплит: ${displayWinnerNames.join(" / ")}` : displayWinnerNames[0],
    winningHand,
    pot: state.pot,
    split,
    splitAmount: displayAward?.winnerIds?.length > 1 ? Math.floor((displayAward?.amount ?? state.pot) / displayAward.winnerIds.length) : null,
    showdown: true,
    bankrollDelta,
    reputationGain: playerNetWinner ? table.difficulty + 2 : 0,
    xp: playerNetWinner ? 20 + table.difficulty * 5 : 8 + table.difficulty * 3,
    playerHand,
    winnerHand: winningHand,
    potAwards,
    showdownHands: hands.map((entry) => ({
      id: entry.seat.id,
      name: entry.seat.name,
      hand: entry.hand,
      cards: entry.seat.holeCards,
    })),
    logs: buildResultLogs({ playerWinner: playerNetWinner, split, winners: displayWinnerNames, best: { hand: winningHand }, state, bankrollDelta, potAwards }),
    review: buildHandReview({ state, playerWinner: playerNetWinner, split, bankrollDelta, playerHand }),
  };
}

export function buildFoldResult(tableState, table) {
  const state = syncTableState(tableState);
  const activeNpcs = state.npcSeats.filter((seat) => !seat.folded);
  const winnerSeat = activeNpcs[0] ?? state.npcSeats[0];
  const potAwards = winnerSeat ? [buildFlatAward(state.pot, winnerSeat)] : [];
  return {
    winner: winnerSeat?.id ?? "table",
    winnerId: winnerSeat?.id ?? "table",
    winnerName: winnerSeat?.name ?? "Стол",
    pot: state.pot,
    potAwards,
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
  const potAwards = [buildFlatAward(state.pot, winnerSeat)];
  return {
    winner: winnerSeat.id,
    winnerId: winnerSeat.id,
    winnerName: winnerSeat.name,
    winningHand: null,
    pot: state.pot,
    potAwards,
    bankrollDelta: isPlayer ? state.pot - state.playerInvested : -state.playerInvested,
    reputationGain: isPlayer ? table.difficulty + 1 : 0,
    xp: isPlayer ? 16 + table.difficulty * 4 : 6 + table.difficulty * 2,
    playerHand: null,
    showdown: false,
    logs: [isPlayer ? `Все сбросили · +$${state.pot - state.playerInvested}.` : `${winnerSeat.name} забирает банк.`],
    review: buildHandReview({ state, playerWinner: isPlayer, folded: false, bankrollDelta: isPlayer ? state.pot - state.playerInvested : -state.playerInvested, playerHand: null }),
  };
}

export function buildPotsFromContributions(seats = []) {
  const normalized = seats
    .filter(Boolean)
    .map((seat) => ({
      id: seat.id,
      name: seat.name,
      folded: Boolean(seat.folded),
      invested: Math.max(0, Math.round(Number(seat.invested ?? 0) || 0)),
    }))
    .filter((seat) => seat.id && seat.invested > 0);
  const levels = [...new Set(normalized.map((seat) => seat.invested))].sort((a, b) => a - b);
  const pots = [];
  let previousLevel = 0;

  for (const level of levels) {
    const contributors = normalized.filter((seat) => seat.invested >= level);
    const amount = (level - previousLevel) * contributors.length;
    const eligibleSeatIds = contributors.filter((seat) => !seat.folded).map((seat) => seat.id);

    if (amount > 0 && eligibleSeatIds.length > 0) {
      const index = pots.length;
      pots.push({
        id: index === 0 ? "main" : `side_${index}`,
        name: index === 0 ? "Main pot" : `Side pot ${index}`,
        amount,
        contributionLevel: level,
        eligibleSeatIds,
      });
    }

    previousLevel = level;
  }

  return pots;
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

export function buildResultLogs({ playerWinner, split, winners, best, bankrollDelta, potAwards = [] }) {
  if (potAwards.length > 1) {
    const awards = potAwards.map((award) => `${award.name}: $${award.amount} → ${award.winnerNames.join(" / ")}`).join("; ");
    return [`Side pots · ${awards}.`, `Итог: ${formatDelta(bankrollDelta)}.`];
  }
  if (split) return [`Сплит: ${winners.join(" / ")} · ${best.hand.categoryName}.`, `Итог: ${formatDelta(bankrollDelta)}.`];
  if (playerWinner) return [`Ты выиграл · ${best.hand.categoryName}.`, `Итог: ${formatDelta(bankrollDelta)}.`];
  return [`${Array.isArray(winners) ? winners[0] : winners} выиграл · ${best.hand.categoryName}.`, `Итог: ${formatDelta(bankrollDelta)}.`];
}

export function formatDelta(value) {
  return value >= 0 ? `+$${value}` : `-$${Math.abs(value)}`;
}

function awardPots(pots, hands) {
  const handBySeatId = new Map(hands.map((entry) => [entry.seat.id, entry]));

  return pots.map((pot) => {
    const contestants = pot.eligibleSeatIds
      .map((id) => handBySeatId.get(id))
      .filter(Boolean)
      .sort((a, b) => compareHands(a.hand, b.hand))
      .reverse();
    const best = contestants[0];
    const winners = best ? contestants.filter((entry) => compareHands(entry.hand, best.hand) === 0) : [];
    const basePayout = winners.length ? Math.floor(pot.amount / winners.length) : 0;
    const remainder = winners.length ? pot.amount - basePayout * winners.length : 0;
    const payouts = {};

    winners.forEach((entry, index) => {
      payouts[entry.seat.id] = basePayout + (index < remainder ? 1 : 0);
    });

    return {
      ...pot,
      winnerIds: winners.map((entry) => entry.seat.id),
      winnerNames: winners.map((entry) => entry.seat.name),
      hand: best?.hand ?? null,
      payouts,
    };
  });
}

function aggregateAwardPayouts(potAwards = []) {
  const payouts = {};
  for (const award of potAwards) {
    for (const [id, amount] of Object.entries(award.payouts ?? {})) {
      payouts[id] = (payouts[id] ?? 0) + amount;
    }
  }
  return payouts;
}

function getDisplayAward(potAwards, fallbackHand) {
  const awards = potAwards.filter((award) => (award.winnerIds?.length ?? 0) > 0);
  if (!awards.length) return fallbackHand ? { amount: 0, winnerIds: [fallbackHand.seat.id], winnerNames: [fallbackHand.seat.name], hand: fallbackHand.hand } : null;
  return awards.reduce((best, award) => (award.amount > best.amount ? award : best), awards[0]);
}

function buildFlatAward(amount, winnerSeat) {
  const safeAmount = Math.max(0, Math.round(Number(amount ?? 0) || 0));
  return {
    id: "main",
    name: "Main pot",
    amount: safeAmount,
    contributionLevel: null,
    eligibleSeatIds: [winnerSeat.id],
    winnerIds: [winnerSeat.id],
    winnerNames: [winnerSeat.name],
    hand: null,
    payouts: { [winnerSeat.id]: safeAmount },
  };
}
