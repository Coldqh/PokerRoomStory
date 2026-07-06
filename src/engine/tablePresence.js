import { createInitialTableState, startNewHand } from "./poker.js?v=2.8.0";

export function createObservedTableState({ content, table, club, player, previousTableState = null, clubSnapshot = null } = {}) {
  if (!content || !table || !club) {
    return {
      ...createInitialTableState(),
      observedHand: true,
      waitingHero: true,
      awaitingPlayer: false,
      actionLog: ["Ты ждёшь следующей раздачи."],
    };
  }

  const previewPlayer = {
    ...(player ?? {}),
    bankroll: Math.max(Number(player?.bankroll ?? 0), Number(table.maxBuyIn ?? table.recommendedBuyIn ?? table.minBuyIn ?? 0)),
    tableStack: Math.max(Number(player?.tableStack ?? player?.bankroll ?? 0), Number(table.recommendedBuyIn ?? table.minBuyIn ?? table.bigBlind * 100 ?? 0)),
  };

  const preview = startNewHand({
    content,
    table,
    club,
    player: previewPlayer,
    previousTableState,
    clubSnapshot,
  });

  const waitingStack = clampMoney(player?.tableStack ?? player?.bankroll ?? table.minBuyIn ?? 0);
  const npcSeats = (preview.npcSeats ?? []).map((seat) => ({
    ...seat,
    folded: false,
    allIn: false,
  }));
  const npcPot = npcSeats.reduce((sum, seat) => sum + Number(seat.invested ?? seat.currentBet ?? 0), 0);
  const npcCurrentBet = npcSeats.reduce((max, seat) => Math.max(max, Number(seat.currentBet ?? 0)), 0);
  const activeNpc = npcSeats.find((seat) => !seat.folded && !seat.allIn) ?? npcSeats[0] ?? null;

  return {
    ...preview,
    observedHand: true,
    waitingHero: true,
    phase: preview.phase ?? "preflop",
    pot: npcPot,
    currentBet: npcCurrentBet,
    currentActorId: preview.currentActorId === "player" ? activeNpc?.id ?? null : preview.currentActorId,
    currentActorName: preview.currentActorId === "player" ? activeNpc?.name ?? null : preview.currentActorName,
    awaitingPlayer: false,
    playerHoleCards: [],
    playerInvested: 0,
    heroSeat: {
      ...(preview.heroSeat ?? {}),
      id: "player",
      name: "Ты",
      stack: waitingStack,
      currentBet: 0,
      invested: 0,
      holeCards: [],
      folded: false,
      allIn: false,
      inHand: false,
      sittingOut: true,
      waitingForNextHand: true,
      position: "Wait",
      lastAction: "waiting",
      lastAmount: 0,
      isDealer: false,
      isSmallBlind: false,
      isBigBlind: false,
    },
    npcSeats,
    lastPlayerAction: null,
    lastResult: null,
    actionLog: [
      `Ты сел за стол ${table.name ?? ""}.`,
      "Текущая раздача уже идёт.",
      "Ты войдёшь со следующей руки.",
    ],
    handEvents: [],
    animation: {
      ...(preview.animation ?? {}),
      isPlaying: false,
      currentEvent: null,
      recentEvents: [],
      showWinner: false,
    },
  };
}

export function isObservedWaitingTable(tableState = null) {
  return Boolean(tableState?.observedHand || tableState?.waitingHero || tableState?.heroSeat?.waitingForNextHand);
}

function clampMoney(value) {
  return Math.max(0, Math.round(Number(value) || 0));
}
