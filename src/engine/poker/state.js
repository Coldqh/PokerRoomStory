export function createInitialTableState() {
  return {
    phase: "idle",
    handNumber: 0,
    deck: [],
    communityCards: [],
    playerHoleCards: [],
    heroSeat: null,
    npcSeats: [],
    activeNpcSeats: [],
    pot: 0,
    smallBlind: 0,
    bigBlind: 0,
    currentBet: 0,
    minRaise: 0,
    streetRaises: 0,
    currentActorId: null,
    currentActorName: null,
    buttonSeatIndex: null,
    playerInvested: 0,
    lastPlayerAction: null,
    lastResult: null,
    actionLog: [],
    handEvents: [],
    awaitingPlayer: false,
    animation: createAnimationState(),
  };
}

export function createAnimationState(patch = {}) {
  return {
    isPlaying: false,
    index: 0,
    total: 0,
    currentEvent: null,
    recentEvents: [],
    revealedCommunityCount: 0,
    showWinner: false,
    ...patch,
  };
}

export function getRevealCountForPhase(phase, tableState = null) {
  if (phase === "flop") return 3;
  if (phase === "turn") return 4;
  if (phase === "river" || phase === "showdown" || phase === "finished") return 5;
  return tableState?.communityCards?.length ?? 0;
}
