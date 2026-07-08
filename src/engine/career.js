import { FALLBACK_START_LOCATION } from "./selectors.js?v=3.7.0";
import { normalizeClubProgress } from "./progression.js?v=3.7.0";
import { createInitialLifeState, normalizeLifeState } from "./life.js?v=3.7.0";
import { createInitialBusinessState, normalizeBusinessState } from "./businesses.js?v=3.7.0";
import { createInitialJobsState, normalizeJobsState } from "./jobs.js?v=3.7.0";
import { createInitialCityGoalsState, normalizeCityGoalsState } from "./cityGoals.js?v=3.7.0";

const RANKS = [
  { id: "newcomer", label: "Новичок", minRep: 0, minBankroll: 0, color: "common" },
  { id: "local_regular", label: "Местный игрок", minRep: 6, minBankroll: 0, color: "green" },
  { id: "dangerous_amateur", label: "Опасный любитель", minRep: 18, minBankroll: 700, color: "blue" },
  { id: "club_shark", label: "Акула клуба", minRep: 40, minBankroll: 1200, color: "gold" },
];

const ACTIVE_CHALLENGE_LIMIT = 6;

export function createNewPlayer() {
  return {
    id: "PLAYER_001",
    name: "Новичок",
    bankroll: 1000,
    reputation: 0,
    xp: 0,
    knowledgeLevel: 1,
    pokerLevel: 1,
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
    unlockedCountries: [FALLBACK_START_LOCATION.countryId],
    unlockedCities: [FALLBACK_START_LOCATION.cityId],
    unlockedClubs: [FALLBACK_START_LOCATION.clubId],
    unlockedTables: [...FALLBACK_START_LOCATION.starterTableIds],
    knownNpcIds: [],
    rivalries: [],
    achievements: [],
    activeChallenges: [],
    completedChallenges: [],
    completedChallengeLog: [],
    unlockedGlossary: ["TERM_POKER_BANKROLL"],
    unlockedCollections: [],
    clubProgress: {},
    storyProgress: {},
    life: createInitialLifeState(),
    city: { activeVenueId: null, visitedVenueIds: [] },
    businesses: createInitialBusinessState(),
    jobs: createInitialJobsState(),
    cityGoals: createInitialCityGoalsState(),
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
    activeChallenges: safeArray(career.activeChallenges),
    completedChallenges: safeArray(career.completedChallenges),
    completedChallengeLog: safeArray(career.completedChallengeLog),
    unlockedGlossary: safeArray(career.unlockedGlossary, base.unlockedGlossary),
    unlockedCollections: safeArray(career.unlockedCollections),
    clubProgress: normalizeClubProgress(null, career.clubProgress ?? base.clubProgress),
    storyProgress: career.storyProgress && typeof career.storyProgress === "object" ? career.storyProgress : {},
    life: normalizeLifeState(career.life ?? base.life),
    city: normalizeCityState(career.city ?? base.city),
    businesses: normalizeBusinessState(career.businesses ?? base.businesses),
    jobs: normalizeJobsState(career.jobs ?? base.jobs),
    cityGoals: normalizeCityGoalsState(career.cityGoals ?? base.cityGoals),
  };
}

export function ensureActiveChallenges(content, career, limit = ACTIVE_CHALLENGE_LIMIT) {
  const normalized = normalizeCareer(career);
  return {
    ...normalized,
    activeChallenges: getActiveChallengeIds(content, normalized, limit),
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
  const normalizedCareer = ensureActiveChallenges(content, career);
  const completed = new Set(normalizedCareer.completedChallenges);
  const activeIds = new Set(getActiveChallengeIds(content, normalizedCareer));
  const messages = [];
  const completedNow = [];
  const completedLog = [...normalizedCareer.completedChallengeLog];
  let xpReward = 0;
  let reputationReward = 0;

  for (const challenge of content.challenges ?? []) {
    if (!activeIds.has(challenge.id)) continue;
    if (completed.has(challenge.id)) continue;

    const progress = getChallengeProgress(challenge, { player, tableState, result, unlockConditions });
    if (!progress.completed) continue;

    completed.add(challenge.id);
    completedNow.push(challenge.id);

    const xp = safeNumber(challenge.reward?.xp, 0);
    const reputation = safeNumber(challenge.reward?.reputation, 0);
    xpReward += xp;
    reputationReward += reputation;

    completedLog.push({
      id: challenge.id,
      completedAt: new Date().toISOString(),
      xp,
      reputation,
      difficulty: challenge.difficulty ?? "easy",
    });

    messages.push(`Задание: ${challenge.name} · ${formatReward({ xp, reputation })}`);
  }

  const nextCareer = {
    ...normalizedCareer,
    completedChallenges: [...completed],
    completedChallengeLog: completedLog.slice(-80),
  };

  return {
    career: {
      ...nextCareer,
      activeChallenges: getActiveChallengeIds(content, nextCareer),
    },
    messages,
    completedNow,
    xpReward,
    reputationReward,
  };
}

export function updateCareerUnlocks(player, career, content) {
  const normalizedCareer = ensureActiveChallenges(content, career);
  const unlockedTables = new Set(normalizedCareer.unlockedTables);
  const unlockedClubs = new Set(normalizedCareer.unlockedClubs);
  const unlockedCities = new Set(normalizedCareer.unlockedCities);

  for (const club of content.clubs ?? []) {
    const req = club.unlockRequirement;
    const alreadyUnlocked = unlockedClubs.has(club.id);
    const bankrollOk = !req?.bankroll || player.bankroll >= req.bankroll;
    const reputationOk = !req?.reputation || player.reputation >= req.reputation;
    const storyOk = !req?.storyCompleted || Boolean(normalizedCareer.storyProgress?.[req.storyCompleted]?.completed);
    if (req?.storyCompleted && !storyOk) {
      unlockedClubs.delete(club.id);
      continue;
    }
    if (!req || alreadyUnlocked || (bankrollOk && reputationOk)) {
      unlockedClubs.add(club.id);
      if (club.cityId) unlockedCities.add(club.cityId);
    }
  }

  for (const table of content.tables) {
    const req = table.unlockRequirement;
    const clubUnlocked = unlockedClubs.has(table.clubId);
    if (!req && clubUnlocked) {
      unlockedTables.add(table.id);
      continue;
    }

    const bankrollOk = !req?.bankroll || player.bankroll >= req.bankroll;
    const reputationOk = !req?.reputation || player.reputation >= req.reputation;
    if (clubUnlocked && bankrollOk && reputationOk) unlockedTables.add(table.id);
  }

  return ensureActiveChallenges(content, {
    ...normalizedCareer,
    unlockedCities: [...unlockedCities],
    unlockedClubs: [...unlockedClubs],
    unlockedTables: [...unlockedTables],
  });
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

export function getActiveChallenges(content, career, limit = ACTIVE_CHALLENGE_LIMIT) {
  const normalized = normalizeCareer(career);
  return getActiveChallengeIds(content, normalized, limit).map((id) => content.byId?.challenges?.[id] ?? (content.challenges ?? []).find((challenge) => challenge.id === id)).filter(Boolean);
}

export function getCompletedChallenges(content, career) {
  const normalizedCareer = normalizeCareer(career);
  const completed = new Set(normalizedCareer.completedChallenges);
  return (content.challenges ?? []).filter((challenge) => completed.has(challenge.id));
}

export function getChallengeDifficultyLabel(difficulty) {
  const labels = {
    easy: "Лёгкое",
    medium: "Среднее",
    hard: "Сложное",
    rare: "Редкое",
  };
  return labels[difficulty] ?? "Лёгкое";
}

export function getChallengeProgress(challenge, context = {}) {
  const { player = {}, result = {}, unlockConditions = [] } = context;
  const goal = challenge.goal ?? {};

  if (goal.condition) {
    const completed = unlockConditions.includes(goal.condition);
    return { current: completed ? 1 : 0, target: 1, completed };
  }

  if (challenge.type === "unlock") {
    const completed = (unlockConditions ?? []).includes(challenge.unlockKey);
    return { current: completed ? 1 : 0, target: 1, completed };
  }
  if (challenge.type === "win_hand") {
    const completed = result?.winner === "player";
    return { current: completed ? 1 : 0, target: 1, completed };
  }
  if (challenge.type === "reach_showdown") {
    const completed = Boolean(result?.showdown);
    return { current: completed ? 1 : 0, target: 1, completed };
  }
  if (challenge.type === "fold_count") {
    const target = Math.max(1, safeNumber(challenge.target, 1));
    const current = safeNumber(player?.foldsMade, 0);
    return { current: Math.min(current, target), target, completed: current >= target };
  }
  if (challenge.type === "big_pot") {
    const target = Math.max(1, safeNumber(challenge.target, 1));
    const current = result?.winner === "player" ? safeNumber(result?.pot, 0) : 0;
    return { current: Math.min(current, target), target, completed: current >= target };
  }
  if (challenge.type === "hands_played") {
    const target = Math.max(1, safeNumber(challenge.target, 1));
    const current = safeNumber(player?.handsPlayed, 0);
    return { current: Math.min(current, target), target, completed: current >= target };
  }

  const target = Math.max(1, safeNumber(goal.target, 1));
  const current = getGoalCurrentValue(goal, { player, result, unlockConditions });
  return { current: Math.min(current, target), target, completed: current >= target };
}

function getActiveChallengeIds(content, career, limit = ACTIVE_CHALLENGE_LIMIT) {
  const normalizedCareer = normalizeCareer(career);
  const completed = new Set(normalizedCareer.completedChallenges ?? []);
  const knownIds = new Set((content.challenges ?? []).map((challenge) => challenge.id));
  const existing = (normalizedCareer.activeChallenges ?? []).filter((id) => knownIds.has(id) && !completed.has(id));
  const selected = [...existing];

  for (const challenge of content.challenges ?? []) {
    if (selected.length >= limit) break;
    if (completed.has(challenge.id) || selected.includes(challenge.id)) continue;
    selected.push(challenge.id);
  }

  return selected.slice(0, limit);
}

function getGoalCurrentValue(goal, { player, result, unlockConditions }) {
  if (goal.condition) return unlockConditions.includes(goal.condition) ? 1 : 0;
  if (goal.stat) return safeNumber(player?.[goal.stat], 0);
  if (goal.resultStat === "pot") return safeNumber(result?.pot, 0);
  if (goal.resultStat === "bankrollDeltaPositive") return Math.max(0, safeNumber(result?.bankrollDelta, 0));
  if (goal.resultStat === "playerWinPot") return result?.winner === "player" ? safeNumber(result?.pot, 0) : 0;
  if (goal.playerWon) return result?.winner === "player" ? 1 : 0;
  if (goal.playerHandCategoryAtLeast) return safeNumber(result?.playerHand?.category, -1) >= safeNumber(goal.playerHandCategoryAtLeast, 99) ? 1 : 0;
  if (goal.playerHandCategoryExact) return safeNumber(result?.playerHand?.category, -1) === safeNumber(goal.playerHandCategoryExact, 99) ? 1 : 0;
  if (goal.playerWinCategoryAtLeast) return result?.winner === "player" && safeNumber(result?.playerHand?.category, -1) >= safeNumber(goal.playerWinCategoryAtLeast, 99) ? 1 : 0;
  if (goal.playerStraight) {
    const category = safeNumber(result?.playerHand?.category, -1);
    return category === 4 || category === 8 ? 1 : 0;
  }
  if (goal.playerFlushSuit) return hasPlayerFlushSuit(result, goal.playerFlushSuit) ? 1 : 0;
  return 0;
}

function hasPlayerFlushSuit(result, suit) {
  const hand = result?.playerHand;
  if (!hand || !Array.isArray(hand.cards)) return false;
  if (![5, 8].includes(hand.category)) return false;
  return hand.cards.length >= 5 && hand.cards.every((card) => card.suit === suit);
}

function getRank(player) {
  let rank = RANKS[0].id;
  for (const candidate of RANKS) {
    if (player.reputation >= candidate.minRep && player.bankroll >= candidate.minBankroll) rank = candidate.id;
  }
  return rank;
}

function formatReward({ xp, reputation }) {
  const parts = [];
  if (xp) parts.push(`XP +${xp}`);
  if (reputation) parts.push(`Rep +${reputation}`);
  return parts.join(" · ") || "без награды";
}

function normalizeCityState(city = {}) {
  return {
    activeVenueId: typeof city.activeVenueId === "string" ? city.activeVenueId : null,
    visitedVenueIds: safeArray(city.visitedVenueIds),
  };
}

function safeArray(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function safeNumber(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function clampPercent(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}
