export function normalizeClubProgress(content, clubProgress = {}) {
  const source = isPlainObject(clubProgress) ? clubProgress : {};
  const next = {};
  const clubs = content?.clubs ?? [];

  if (!clubs.length) {
    for (const [clubId, progress] of Object.entries(source)) {
      next[clubId] = normalizeSingleClubProgress(null, progress);
    }
    return next;
  }

  for (const club of clubs) {
    next[club.id] = normalizeSingleClubProgress(club, source[club.id]);
  }

  return next;
}

export function getClubProgressState(content, career = {}, clubId) {
  const club = content?.byId?.clubs?.[clubId];
  if (!club) return createFallbackClubProgress();
  const progress = normalizeClubProgress(content, career?.clubProgress ?? {});
  return progress[clubId] ?? createFallbackClubProgress();
}

export function getClubLevelInfo(content, career = {}, clubId) {
  const club = content?.byId?.clubs?.[clubId];
  const progression = getClubProgression(club);
  const progress = getClubProgressState(content, career, clubId);
  const currentLevel = clamp(progress.level, 1, progression.maxLevel);
  const nextLevel = currentLevel >= progression.maxLevel ? null : currentLevel + 1;
  const nextEntry = nextLevel ? progression.levels.find((entry) => entry.level === nextLevel) : null;
  const previousXp = getRequiredXpForLevel(progression, currentLevel);
  const nextXp = nextEntry?.xp ?? previousXp;
  const span = Math.max(1, nextXp - previousXp);
  const percent = nextLevel ? clamp(Math.round(((progress.xp - previousXp) / span) * 100), 0, 100) : 100;
  const nextReward = nextEntry?.reward ?? null;

  return {
    club,
    level: currentLevel,
    xp: progress.xp,
    maxLevel: progression.maxLevel,
    nextLevel,
    nextXp,
    previousXp,
    xpIntoLevel: nextLevel ? Math.max(0, progress.xp - previousXp) : 0,
    xpNeeded: nextLevel ? Math.max(0, nextXp - progress.xp) : 0,
    percent,
    unlockedRewards: progress.unlockedRewards ?? [],
    lastGain: progress.lastGain ?? null,
    nextReward,
  };
}

export function calculateClubXpGain({ tableState, result, challengeResult = null } = {}) {
  const pot = Number(result?.pot ?? tableState?.pot ?? 0);
  const winningKey = result?.winningHand?.categoryKey ?? "";
  let xp = 4;
  const reasons = ["hand +4"];

  if (result?.showdown) {
    xp += 4;
    reasons.push("showdown +4");
  }

  if (result?.winner === "player") {
    xp += 6;
    reasons.push("win +6");
  }

  if (pot >= 50) {
    xp += 4;
    reasons.push("pot50 +4");
  }
  if (pot >= 100) {
    xp += 8;
    reasons.push("pot100 +8");
  }
  if (pot >= 200) {
    xp += 12;
    reasons.push("pot200 +12");
  }

  const madeHandBonus = {
    straight: 6,
    flush: 7,
    full_house: 10,
    four_of_a_kind: 16,
    straight_flush: 24,
  }[winningKey] ?? 0;
  if (result?.winner === "player" && madeHandBonus > 0) {
    xp += madeHandBonus;
    reasons.push(`${winningKey} +${madeHandBonus}`);
  }

  const completedChallenges = challengeResult?.completedNow?.length ?? 0;
  if (completedChallenges > 0) {
    const bonus = Math.min(18, completedChallenges * 6);
    xp += bonus;
    reasons.push(`tasks +${bonus}`);
  }

  return {
    xp: Math.max(1, Math.round(xp)),
    reasons,
  };
}

export function applyClubProgression({ content, career, clubId, tableState, result, challengeResult = null }) {
  const club = content?.byId?.clubs?.[clubId];
  if (!club) {
    return {
      career,
      gain: { xp: 0, reasons: [] },
      levelInfo: null,
      levelUps: [],
      unlockedRewards: [],
      messages: [],
    };
  }

  const progression = getClubProgression(club);
  const normalizedProgress = normalizeClubProgress(content, career?.clubProgress ?? {});
  const current = normalizedProgress[clubId] ?? createFallbackClubProgress();
  const gain = calculateClubXpGain({ tableState, result, challengeResult });
  const nextXp = current.xp + gain.xp;
  const nextLevel = getLevelForXp(progression, nextXp);
  const levelUps = [];
  const unlockedRewards = [];
  const unlockedRewardIds = new Set(current.unlockedRewards ?? []);

  for (const entry of progression.levels ?? []) {
    if (entry.level <= current.level || entry.level > nextLevel) continue;
    levelUps.push(entry.level);
    if (entry.reward?.id && !unlockedRewardIds.has(entry.reward.id)) {
      unlockedRewardIds.add(entry.reward.id);
      unlockedRewards.push(normalizeReward(entry.reward));
    }
  }

  const nextClubProgress = {
    ...current,
    level: nextLevel,
    xp: nextXp,
    unlockedRewards: [...unlockedRewardIds],
    lastGain: {
      xp: gain.xp,
      at: new Date().toISOString(),
      levelUps,
      rewardIds: unlockedRewards.map((reward) => reward.id),
    },
  };

  const collectionUnlocks = unlockedRewards.map((reward) => reward.collectionId).filter(Boolean);
  const unlockedCollections = [...new Set([...(career?.unlockedCollections ?? []), ...collectionUnlocks])];

  const nextCareer = {
    ...career,
    unlockedCollections,
    clubProgress: {
      ...normalizedProgress,
      [clubId]: nextClubProgress,
    },
  };

  const messages = [`${club.name}: Club XP +${gain.xp}`];
  for (const level of levelUps) messages.push(`${club.name}: уровень ${level}`);
  for (const reward of unlockedRewards) messages.push(`Награда клуба: ${reward.name}`);

  return {
    career: nextCareer,
    gain,
    levelInfo: getClubLevelInfo(content, nextCareer, clubId),
    levelUps,
    unlockedRewards,
    messages,
  };
}

export function formatClubReward(reward = null) {
  if (!reward) return "Максимальный уровень";
  const typeLabels = {
    badge: "Бейдж",
    card_back: "Рубашка",
    challenge_pack: "Задания",
    table_felt: "Сукно",
    collection: "Коллекция",
    npc_pool: "Игроки",
    title: "Титул",
  };
  const type = typeLabels[reward.type] ?? "Награда";
  return `${type}: ${reward.name}`;
}

function normalizeSingleClubProgress(club, progress = {}) {
  const progression = getClubProgression(club);
  const xp = Math.max(0, Math.round(Number(progress?.xp ?? 0) || 0));
  const level = clamp(Number(progress?.level ?? getLevelForXp(progression, xp)) || 1, 1, progression.maxLevel);
  return {
    level: Math.max(level, getLevelForXp(progression, xp)),
    xp,
    unlockedRewards: safeArray(progress?.unlockedRewards),
    lastGain: isPlainObject(progress?.lastGain) ? progress.lastGain : null,
  };
}

function getClubProgression(club = {}) {
  const levels = Array.isArray(club.progression?.levels) ? club.progression.levels : [];
  const maxLevel = Math.max(1, Number(club.progression?.maxLevel ?? Math.max(1, ...levels.map((entry) => Number(entry.level ?? 1)))) || 10);
  return {
    maxLevel,
    levels: levels
      .map((entry) => ({ ...entry, level: Number(entry.level), xp: Number(entry.xp), reward: normalizeReward(entry.reward) }))
      .filter((entry) => Number.isFinite(entry.level) && Number.isFinite(entry.xp))
      .sort((a, b) => a.level - b.level),
  };
}

function normalizeReward(reward = null) {
  if (!reward) return null;
  return {
    id: String(reward.id ?? `${reward.type ?? "reward"}_${reward.name ?? "unknown"}`),
    type: String(reward.type ?? "reward"),
    name: String(reward.name ?? "Награда"),
    description: String(reward.description ?? ""),
    collectionId: reward.collectionId ?? null,
  };
}

function getLevelForXp(progression, xp) {
  let level = 1;
  for (const entry of progression.levels ?? []) {
    if (xp >= entry.xp) level = Math.max(level, entry.level);
  }
  return clamp(level, 1, progression.maxLevel);
}

function getRequiredXpForLevel(progression, level) {
  if (level <= 1) return 0;
  return progression.levels.find((entry) => entry.level === level)?.xp ?? 0;
}

function createFallbackClubProgress() {
  return {
    level: 1,
    xp: 0,
    unlockedRewards: [],
    lastGain: null,
  };
}

function safeArray(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Math.round(Number(value) || min)));
}
