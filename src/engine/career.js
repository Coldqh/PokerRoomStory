export function createNewPlayer() {
  return {
    id: "PLAYER_001",
    name: "Новичок",
    bankroll: 1000,
    reputation: 0,
    xp: 0,
    knowledgeLevel: 1,
    pokerLevel: 1,
    blackjackLevel: 0,
    rank: "newcomer",
    handsPlayed: 0,
    handsWon: 0,
    biggestPotWon: 0,
    biggestPotLost: 0,
  };
}

export function createNewCareer() {
  return {
    unlockedCountries: ["COUNTRY_RUSSIA"],
    unlockedCities: ["CITY_RU_NORTH_DISTRICT"],
    unlockedClubs: ["CLUB_RU_BASEMENT_RIVER_001"],
    unlockedTables: ["TABLE_RU_BRR_LOW_001"],
    knownNpcIds: [],
    rivalries: [],
    achievements: [],
    unlockedGlossary: ["TERM_POKER_BANKROLL"],
    unlockedCollections: [],
  };
}

export function applyHandResult(player, result) {
  const next = { ...player };
  next.bankroll += result.bankrollDelta;
  next.handsPlayed += 1;
  next.xp += result.xp;

  if (result.bankrollDelta > 0) {
    next.handsWon += 1;
    next.reputation += result.reputationGain;
    next.biggestPotWon = Math.max(next.biggestPotWon, result.pot);
  } else {
    next.biggestPotLost = Math.max(next.biggestPotLost, result.pot);
  }

  next.pokerLevel = Math.max(1, Math.floor(next.xp / 100) + 1);
  next.knowledgeLevel = Math.max(1, Math.floor(next.xp / 120) + 1);
  next.rank = getRank(next);

  return next;
}

export function updateCareerUnlocks(player, career, content) {
  const unlockedTables = new Set(career.unlockedTables);

  for (const table of content.tables) {
    const req = table.unlockRequirement;
    if (!req) {
      unlockedTables.add(table.id);
      continue;
    }

    const bankrollOk = !req.bankroll || player.bankroll >= req.bankroll;
    const reputationOk = !req.reputation || player.reputation >= req.reputation;
    if (bankrollOk && reputationOk) unlockedTables.add(table.id);
  }

  return { ...career, unlockedTables: [...unlockedTables] };
}

export function getXpProgress(player) {
  const currentLevelXp = (player.pokerLevel - 1) * 100;
  const nextLevelXp = player.pokerLevel * 100;
  return Math.round(((player.xp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100);
}

function getRank(player) {
  if (player.reputation >= 40 && player.bankroll >= 1200) return "club_shark";
  if (player.reputation >= 18 && player.bankroll >= 700) return "dangerous_amateur";
  if (player.reputation >= 6) return "local_regular";
  return "newcomer";
}
