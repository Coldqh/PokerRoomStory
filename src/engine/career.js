const RANKS = [
  { id: "newcomer", label: "Новичок", minRep: 0, minBankroll: 0, color: "common" },
  { id: "local_regular", label: "Местный игрок", minRep: 6, minBankroll: 0, color: "green" },
  { id: "dangerous_amateur", label: "Опасный любитель", minRep: 18, minBankroll: 700, color: "blue" },
  { id: "club_shark", label: "Акула клуба", minRep: 40, minBankroll: 1200, color: "gold" },
];

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
    showdownsSeen: 0,
    foldsMade: 0,
    biggestPotWon: 0,
    biggestPotLost: 0,
    biggestPotSeen: 0,
    favoriteHand: null,
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
    completedChallenges: [],
    unlockedGlossary: ["TERM_POKER_BANKROLL"],
    unlockedCollections: [],
  };
}

export function normalizeCareer(career = {}) {
  const base = createNewCareer();
  return {
    ...base,
    ...career,
    unlockedCountries: safeArray(career.unlockedCountries, base.unlockedCountries),
    unlockedCities: safeArray(career.unlockedCities, base.unlockedCities),
    unlockedClubs: safeArray(career.unlockedClubs, base.unlockedClubs),
    unlockedTables: safeArray(career.unlockedTables, base.unlockedTables),
    knownNpcIds: safeArray(career.knownNpcIds),
    rivalries: safeArray(career.rivalries),
    achievements: safeArray(career.achievements),
    completedChallenges: safeArray(career.completedChallenges),
    unlockedGlossary: safeArray(career.unlockedGlossary, base.unlockedGlossary),
    unlockedCollections: safeArray(career.unlockedCollections),
  };
}

export function normalizePlayer(player = {}) {
  const base = createNewPlayer();
  const next = { ...base, ...player };
  next.bankroll = safeNumber(next.bankroll, base.bankroll);
  next.reputation = safeNumber(next.reputation, base.reputation);
  next.xp = safeNumber(next.xp, base.xp);
  next.handsPlayed = safeNumber(next.handsPlayed, base.handsPlayed);
  next.handsWon = safeNumber(next.handsWon, base.handsWon);
  next.showdownsSeen = safeNumber(next.showdownsSeen, base.showdownsSeen);
  next.foldsMade = safeNumber(next.foldsMade, base.foldsMade);
  next.biggestPotWon = safeNumber(next.biggestPotWon, base.biggestPotWon);
  next.biggestPotLost = safeNumber(next.biggestPotLost, base.biggestPotLost);
  next.biggestPotSeen = safeNumber(next.biggestPotSeen, base.biggestPotSeen);
  next.pokerLevel = Math.max(1, Math.floor(next.xp / 100) + 1);
  next.knowledgeLevel = Math.max(1, Math.floor(next.xp / 120) + 1);
  next.rank = getRank(next);
  return next;
}

export function applyHandResult(player, result, tableState = null) {
  const next = normalizePlayer(player);
  const bankrollDelta = safeNumber(result?.bankrollDelta, 0);
  const pot = safeNumber(result?.pot, 0);
  const heroFolded = Boolean(tableState?.heroSeat?.folded || tableState?.lastPlayerAction === "fold" || tableState?.phase === "folded");

  next.bankroll += bankrollDelta;
  next.handsPlayed += 1;
  next.xp += safeNumber(result?.xp, 0);
  next.biggestPotSeen = Math.max(next.biggestPotSeen, pot);

  if (result?.showdown) next.showdownsSeen += 1;
  if (heroFolded) next.foldsMade += 1;

  if (bankrollDelta > 0) {
    next.handsWon += 1;
    next.reputation += safeNumber(result?.reputationGain, 0);
    next.biggestPotWon = Math.max(next.biggestPotWon, pot);
  } else {
    next.biggestPotLost = Math.max(next.biggestPotLost, pot);
  }

  return normalizePlayer(next);
}

export function addPlayerRewards(player, rewards = {}) {
  const next = normalizePlayer(player);
  next.xp += safeNumber(rewards.xp, 0);
  next.reputation += safeNumber(rewards.reputation, 0);
  return normalizePlayer(next);
}

export function applyChallenges({ content, career, player, tableState, result, unlockConditions = [] }) {
  const normalizedCareer = normalizeCareer(career);
  const completed = new Set(normalizedCareer.completedChallenges);
  const messages = [];
  const completedNow = [];
  let xpReward = 0;
  let reputationReward = 0;

  for (const challenge of content.challenges ?? []) {
    if (completed.has(challenge.id)) continue;
    const progress = getChallengeProgress(challenge, { player, tableState, result, unlockConditions });
    if (!progress.completed) continue;

    completed.add(challenge.id);
    completedNow.push(challenge.id);
    xpReward += safeNumber(challenge.reward?.xp, 0);
    reputationReward += safeNumber(challenge.reward?.reputation, 0);
    messages.push(`Челлендж: ${challenge.name}`);
  }

  return {
    career: {
      ...normalizedCareer,
      completedChallenges: [...completed],
    },
    messages,
    completedNow,
    xpReward,
    reputationReward,
  };
}

export function updateCareerUnlocks(player, career, content) {
  const normalizedCareer = normalizeCareer(career);
  const unlockedTables = new Set(normalizedCareer.unlockedTables);

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

  return { ...normalizedCareer, unlockedTables: [...unlockedTables] };
}

export function getXpProgress(player) {
  const safe = normalizePlayer(player);
  const currentLevelXp = (safe.pokerLevel - 1) * 100;
  const nextLevelXp = safe.pokerLevel * 100;
  return clampPercent(((safe.xp - currentLevelXp) / Math.max(nextLevelXp - currentLevelXp, 1)) * 100);
}

export function getRankLabel(rank) {
  return RANKS.find((entry) => entry.id === rank)?.label ?? rank ?? "Новичок";
}

export function getRankInfo(player) {
  const safe = normalizePlayer(player);
  const currentIndex = Math.max(0, RANKS.findIndex((entry) => entry.id === safe.rank));
  const current = RANKS[currentIndex] ?? RANKS[0];
  const next = RANKS[currentIndex + 1] ?? null;
  return { current, next };
}

export function getRankProgress(player) {
  const safe = normalizePlayer(player);
  const { current, next } = getRankInfo(safe);
  if (!next) return { percent: 100, current, next: null, missing: [] };

  const repSpan = Math.max(1, next.minRep - current.minRep);
  const bankrollSpan = Math.max(1, next.minBankroll - current.minBankroll);
  const repProgress = clamp01((safe.reputation - current.minRep) / repSpan);
  const bankrollProgress = next.minBankroll <= current.minBankroll ? 1 : clamp01((safe.bankroll - current.minBankroll) / bankrollSpan);
  const percent = clampPercent(((repProgress + bankrollProgress) / 2) * 100);
  const missing = [];
  if (safe.reputation < next.minRep) missing.push(`Rep +${next.minRep - safe.reputation}`);
  if (safe.bankroll < next.minBankroll) missing.push(`$${next.minBankroll - safe.bankroll}`);
  return { percent, current, next, missing };
}

export function getChallengeProgress(challenge, context = {}) {
  const { player = {}, tableState = {}, result = {}, unlockConditions = [] } = context;
  const goal = challenge.goal ?? {};

  if (goal.condition) {
    const completed = unlockConditions.includes(goal.condition);
    return { current: completed ? 1 : 0, target: 1, completed };
  }

  const target = Math.max(1, safeNumber(goal.target, 1));
  const current = getGoalCurrentValue(goal, { player, tableState, result, unlockConditions });
  return { current: Math.min(current, target), target, completed: current >= target };
}

function getGoalCurrentValue(goal, { player, result }) {
  if (goal.stat) return safeNumber(player?.[goal.stat], 0);
  if (goal.resultStat === "pot") return safeNumber(result?.pot, 0);
  if (goal.resultStat === "bankrollDeltaPositive") return Math.max(0, safeNumber(result?.bankrollDelta, 0));
  return 0;
}

function getRank(player) {
  const safe = { bankroll: safeNumber(player?.bankroll, 0), reputation: safeNumber(player?.reputation, 0) };
  let rank = RANKS[0].id;
  for (const entry of RANKS) {
    if (safe.reputation >= entry.minRep && safe.bankroll >= entry.minBankroll) rank = entry.id;
  }
  return rank;
}

function safeArray(value, fallback = []) {
  return Array.isArray(value) ? value : [...fallback];
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function clampPercent(value) {
  return Math.round(Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0)));
}
