import { describeCards, detectStartingHandUnlocks, estimatePreflopStrength, evaluateBestHand } from "../cards.js?v=3.5.0";
import { getArchetypeUnlockConditions } from "../npc.js?v=3.5.0";
import { PHASE_LABELS } from "./constants.js?v=3.5.0";
import { getToCall } from "./betting.js?v=3.5.0";

export function getPhaseLabel(phase) {
  return PHASE_LABELS[phase] ?? phase;
}

export function getHandHint(tableState) {
  if (!tableState || tableState.phase === "idle") return "Начни раздачу.";
  if (!tableState.playerHoleCards?.length) return "Карты не розданы.";
  if (tableState.awaitingPlayer) {
    const toCall = getToCall(tableState, tableState.heroSeat);
    if (toCall > 0) return `Доставить $${toCall} или сбросить.`;
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
  const heroFolded = Boolean(tableState?.heroSeat?.folded || tableState?.lastPlayerAction === "fold" || tableState?.phase === "folded");

  conditions.push(...detectStartingHandUnlocks(tableState.playerHoleCards));
  conditions.push(...getArchetypeUnlockConditions((tableState.npcSeats ?? []).map((seat) => seat.npc)));

  if (heroFolded) conditions.push("player_fold");
  if (result?.showdown) conditions.push("showdown_seen");
  if ((result?.pot ?? 0) >= 100) conditions.push("pot_100");
  if (result?.bankrollDelta < 0 && Math.abs(result.bankrollDelta) >= 30) conditions.push("big_loss");
  if (result?.winner === "player") {
    conditions.push("win_hand");
    if (result.playerHand?.category >= 1) conditions.push("win_with_pair_or_better");
  }
  if (result?.playerHand?.category >= 4 && result?.winner !== "player") conditions.push("lose_strong_hand");

  return [...new Set(conditions)];
}
