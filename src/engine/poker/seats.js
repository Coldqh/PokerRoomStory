export function applyContribution(seat, amount) {
  const contribution = clampMoney(Math.min(amount, seat.stack));
  const nextStack = clampMoney(seat.stack - contribution);
  return {
    ...seat,
    stack: nextStack,
    currentBet: clampMoney((seat.currentBet ?? 0) + contribution),
    invested: clampMoney((seat.invested ?? 0) + contribution),
    allIn: nextStack <= 0,
  };
}

export function getSeatById(tableState, seatId) {
  return getAllSeats(tableState).find((seat) => seat.id === seatId) ?? null;
}

export function getSeatByRelativePosition(tableState, relativePosition) {
  const total = getAllSeats(tableState).length;
  const targetIndex = normalizeIndex((tableState.buttonSeatIndex ?? 0) + relativePosition, total);
  return getAllSeats(tableState).find((seat) => seat.seatIndex === targetIndex) ?? null;
}

export function getNextSeatId(tableState, fromSeatIndex) {
  return getNextActiveSeatAfter(tableState, fromSeatIndex)?.id ?? null;
}

export function getNextActiveSeatAfter(tableState, fromSeatIndex) {
  const seats = getAllSeats(tableState);
  if (!seats.length) return null;
  const total = seats.length;
  for (let offset = 1; offset <= total; offset += 1) {
    const index = normalizeIndex(fromSeatIndex + offset, total);
    const seat = seats.find((entry) => entry.seatIndex === index);
    if (seat && !seat.folded && !seat.allIn) return seat;
  }
  return null;
}

export function setCurrentActor(tableState, seatId) {
  const seat = getSeatById(tableState, seatId);
  const canAct = seat && !seat.folded && !seat.allIn;
  return syncTableState({
    ...tableState,
    currentActorId: canAct ? seat.id : null,
    currentActorName: canAct ? seat.name : null,
  });
}

export function setSeat(tableState, seat) {
  if (seat.id === "player") return syncTableState({ ...tableState, heroSeat: seat });
  const npcSeats = (tableState.npcSeats ?? []).map((entry) => (entry.id === seat.id ? seat : entry));
  return syncTableState({ ...tableState, npcSeats });
}

export function setAllSeats(tableState, seats) {
  const heroSeat = seats.find((seat) => seat.id === "player") ?? tableState.heroSeat;
  const npcSeats = seats.filter((seat) => seat.id !== "player");
  return syncTableState({ ...tableState, heroSeat, npcSeats });
}

export function getAllSeats(tableState) {
  return [tableState.heroSeat, ...(tableState.npcSeats ?? [])].filter(Boolean).sort((a, b) => a.seatIndex - b.seatIndex);
}

export function getOnlyActiveSeat(tableState) {
  const active = getAllSeats(tableState).filter((seat) => !seat.folded);
  return active.length === 1 ? active[0] : null;
}

export function getActiveNpcSeats(tableState) {
  return (tableState.npcSeats ?? []).filter((seat) => !seat.folded);
}

export function syncTableState(tableState) {
  const heroSeat = tableState.heroSeat ? { ...tableState.heroSeat } : null;
  const npcSeats = (tableState.npcSeats ?? []).map((seat) => ({ ...seat, npc: seat.npc }));
  const allSeats = [heroSeat, ...npcSeats].filter(Boolean);
  const currentActor = allSeats.find((seat) => seat.id === tableState.currentActorId) ?? null;
  const currentActorCanAct = Boolean(currentActor && !currentActor.folded && !currentActor.allIn);

  return {
    ...tableState,
    heroSeat,
    npcSeats,
    currentActorId: currentActorCanAct ? tableState.currentActorId : null,
    currentActorName: currentActorCanAct ? tableState.currentActorName : null,
    playerHoleCards: heroSeat?.holeCards ?? tableState.playerHoleCards ?? [],
    activeNpcSeats: npcSeats.filter((seat) => !seat.folded).map((seat) => seat.id),
    playerInvested: heroSeat?.invested ?? tableState.playerInvested ?? 0,
    handEvents: Array.isArray(tableState.handEvents) ? tableState.handEvents : [],
  };
}

export function buildHeroSeat({ holeCards, stack, seatIndex }) {
  return {
    id: "player",
    type: "player",
    name: "Ты",
    npc: null,
    holeCards,
    folded: false,
    allIn: false,
    acted: false,
    invested: 0,
    currentBet: 0,
    stack,
    seatIndex,
    position: "—",
    lastAction: "ready",
    lastAmount: 0,
    isDealer: false,
    isSmallBlind: false,
    isBigBlind: false,
  };
}

export function buildNpcSeat({ npc, holeCards, stack, seatIndex, mood = "calm" }) {
  return {
    id: npc.id,
    type: "npc",
    name: npc.name,
    npc,
    holeCards,
    folded: false,
    allIn: false,
    acted: false,
    invested: 0,
    currentBet: 0,
    stack,
    seatIndex,
    position: "—",
    lastAction: "ready",
    lastAmount: 0,
    isDealer: false,
    isSmallBlind: false,
    isBigBlind: false,
    mood,
  };
}

export function findBlindSeat(tableState, type) {
  return getAllSeats(tableState).find((seat) => (type === "small" ? seat.isSmallBlind : seat.isBigBlind)) ?? null;
}

export function clampMoney(value) {
  return Math.max(0, Math.round(Number(value) || 0));
}

function normalizeIndex(index, total) {
  return ((index % total) + total) % total;
}
