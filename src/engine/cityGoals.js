const CITY_GOAL_VERSION = 1;

export const CITY_GOALS = [
  {
    id: "CITY_GOAL_MOS_ENTER_CITY",
    chapterId: "chapter_1",
    chapterTitle: "Глава 1 · Войти в город",
    category: "city",
    title: "Первый выход",
    description: "Посети первый городской объект.",
    target: 1,
    reward: { xp: 15, reputation: 0, bankroll: 50 },
    getValue: ({ career }) => safeArray(career?.city?.visitedVenueIds).length,
  },
  {
    id: "CITY_GOAL_MOS_PLAY_10_HANDS",
    chapterId: "chapter_1",
    chapterTitle: "Глава 1 · Войти в город",
    category: "poker",
    title: "Первые десять рук",
    description: "Сыграй 10 рук в московских клубах.",
    target: 10,
    reward: { xp: 25, reputation: 1, bankroll: 0 },
    getValue: ({ player }) => safeNumber(player?.handsPlayed),
  },
  {
    id: "CITY_GOAL_MOS_FIRST_WIN",
    chapterId: "chapter_1",
    chapterTitle: "Глава 1 · Войти в город",
    category: "poker",
    title: "Первый банк",
    description: "Выиграй первую руку.",
    target: 1,
    reward: { xp: 25, reputation: 1, bankroll: 75 },
    getValue: ({ player }) => safeNumber(player?.handsWon),
  },
  {
    id: "CITY_GOAL_MOS_TAKE_JOB",
    chapterId: "chapter_2",
    chapterTitle: "Глава 2 · Удержаться на плаву",
    category: "work",
    title: "Первая работа",
    description: "Устройся на постоянную работу.",
    target: 1,
    reward: { xp: 20, reputation: 0, bankroll: 100 },
    getValue: ({ career }) => career?.jobs?.currentJobId || safeNumber(career?.jobs?.totalShiftsWorked) > 0 ? 1 : 0,
  },
  {
    id: "CITY_GOAL_MOS_WORK_3_SHIFTS",
    chapterId: "chapter_2",
    chapterTitle: "Глава 2 · Удержаться на плаву",
    category: "work",
    title: "Три смены",
    description: "Отработай 3 смены.",
    target: 3,
    reward: { xp: 30, reputation: 1, bankroll: 150 },
    getValue: ({ career }) => safeNumber(career?.jobs?.totalShiftsWorked),
  },
  {
    id: "CITY_GOAL_MOS_NO_DEBT_7_DAYS",
    chapterId: "chapter_2",
    chapterTitle: "Глава 2 · Удержаться на плаву",
    category: "life",
    title: "Неделя без долгов",
    description: "Доживи до 7 дня без долга.",
    target: 1,
    reward: { xp: 25, reputation: 1, bankroll: 100 },
    getValue: ({ career }) => safeNumber(career?.life?.day) >= 7 && safeNumber(career?.life?.debt) <= 0 ? 1 : 0,
  },
  {
    id: "CITY_GOAL_MOS_BETTER_HOME",
    chapterId: "chapter_3",
    chapterTitle: "Глава 3 · Первый стабильный доход",
    category: "housing",
    title: "Жильё лучше комнаты",
    description: "Сними или купи жильё лучше стартовой комнаты.",
    target: 1,
    reward: { xp: 35, reputation: 1, bankroll: 150 },
    getValue: ({ career }) => career?.life?.housingId && career.life.housingId !== "HOUSING_CHEAP_ROOM" ? 1 : 0,
  },
  {
    id: "CITY_GOAL_MOS_FIRST_CAR",
    chapterId: "chapter_3",
    chapterTitle: "Глава 3 · Первый стабильный доход",
    category: "property",
    title: "Первая машина",
    description: "Купи первый автомобиль.",
    target: 1,
    reward: { xp: 35, reputation: 1, bankroll: 200 },
    getValue: ({ career }) => career?.life?.vehicleId ? 1 : 0,
  },
  {
    id: "CITY_GOAL_MOS_BUY_BUSINESS",
    chapterId: "chapter_4",
    chapterTitle: "Глава 4 · Купить актив",
    category: "business",
    title: "Первый бизнес",
    description: "Купи первый бизнес в Москве.",
    target: 1,
    reward: { xp: 45, reputation: 2, bankroll: 250 },
    getValue: ({ career }) => safeArray(career?.businesses?.ownedIds).length,
  },
  {
    id: "CITY_GOAL_MOS_BUSINESS_PROFIT_1000",
    chapterId: "chapter_4",
    chapterTitle: "Глава 4 · Купить актив",
    category: "business",
    title: "Первая тысяча с бизнеса",
    description: "Собери $1000 суммарной прибыли с бизнесов.",
    target: 1000,
    reward: { xp: 55, reputation: 2, bankroll: 300 },
    getValue: ({ career }) => Object.values(career?.businesses?.byId ?? {}).reduce((sum, business) => sum + safeNumber(business?.totalProfit), 0),
  },
  {
    id: "CITY_GOAL_MOS_RIVER_STORY_DONE",
    chapterId: "chapter_5",
    chapterTitle: "Глава 5 · Подняться в клубе",
    category: "club",
    title: "Закрыть первый маршрут",
    description: "Заверши первую линию River Room.",
    target: 1,
    reward: { xp: 60, reputation: 3, bankroll: 300 },
    getValue: ({ career }) => career?.storyProgress?.STORY_RU_BRR_FIRST_NIGHT?.completed ? 1 : 0,
  },
  {
    id: "CITY_GOAL_MOS_UNLOCK_UNDERGROUND",
    chapterId: "chapter_5",
    chapterTitle: "Глава 5 · Подняться в клубе",
    category: "club",
    title: "Вход в Underground",
    description: "Открой Moscow Underground Club.",
    target: 1,
    reward: { xp: 75, reputation: 3, bankroll: 500 },
    getValue: ({ career }) => safeArray(career?.unlockedClubs).includes("CLUB_RU_MOSCOW_UNDERGROUND_001") ? 1 : 0,
  },
  {
    id: "CITY_GOAL_MOS_BANKROLL_10000",
    chapterId: "chapter_6",
    chapterTitle: "Глава 6 · Выйти на новый уровень",
    category: "money",
    title: "Банкролл $10 000",
    description: "Доведи банкролл до $10 000.",
    target: 10000,
    reward: { xp: 90, reputation: 4, bankroll: 750 },
    getValue: ({ player }) => safeNumber(player?.bankroll),
  },
  {
    id: "CITY_GOAL_MOS_REPUTATION_25",
    chapterId: "chapter_6",
    chapterTitle: "Глава 6 · Выйти на новый уровень",
    category: "reputation",
    title: "Репутация 25",
    description: "Доведи репутацию до 25.",
    target: 25,
    reward: { xp: 100, reputation: 5, bankroll: 1000 },
    getValue: ({ player }) => safeNumber(player?.reputation),
  },
];

export function createInitialCityGoalsState() {
  return {
    version: CITY_GOAL_VERSION,
    completedGoalIds: [],
    completedLog: [],
    lastCompletedIds: [],
    lastMessage: null,
    pendingBankrollReward: 0,
  };
}

export function normalizeCityGoalsState(value = {}) {
  const base = createInitialCityGoalsState();
  return {
    ...base,
    ...value,
    version: CITY_GOAL_VERSION,
    completedGoalIds: safeUniqueIds(value.completedGoalIds),
    completedLog: Array.isArray(value.completedLog) ? value.completedLog.filter((entry) => entry?.id).slice(-100) : [],
    lastCompletedIds: safeUniqueIds(value.lastCompletedIds),
    lastMessage: typeof value.lastMessage === "string" ? value.lastMessage : null,
    pendingBankrollReward: Math.max(0, Math.round(safeNumber(value.pendingBankrollReward, 0))),
  };
}

export function getCityGoalRoadmap({ content = null, career = {}, player = {} } = {}) {
  const state = normalizeCityGoalsState(career.cityGoals);
  const completed = new Set(state.completedGoalIds);
  const rows = CITY_GOALS.map((goal) => buildGoalRow(goal, { content, career, player, completed }));
  const chapters = [];
  for (const row of rows) {
    let chapter = chapters.find((entry) => entry.id === row.chapterId);
    if (!chapter) {
      chapter = { id: row.chapterId, title: row.chapterTitle, goals: [], completed: 0, total: 0, active: false };
      chapters.push(chapter);
    }
    chapter.goals.push(row);
    chapter.total += 1;
    if (row.completed) chapter.completed += 1;
  }

  const firstOpen = chapters.find((chapter) => chapter.completed < chapter.total) ?? chapters.at(-1) ?? null;
  for (const chapter of chapters) chapter.active = chapter.id === firstOpen?.id;

  const activeGoals = rows.filter((row) => !row.completed).slice(0, 4);
  const completedGoals = rows.filter((row) => row.completed);

  return {
    state,
    rows,
    chapters,
    activeGoals,
    completedGoals,
    mainGoal: activeGoals[0] ?? rows.at(-1) ?? null,
    completedCount: completedGoals.length,
    totalCount: rows.length,
  };
}

export function applyCityGoalProgress({ content = null, career = {}, player = {}, deferBankrollRewards = false } = {}) {
  const state = normalizeCityGoalsState(career.cityGoals);
  const completed = new Set(state.completedGoalIds);
  const completedNow = [];
  const log = [...state.completedLog];
  let deferredBankrollReward = 0;
  const nextPlayer = {
    ...player,
    bankroll: safeNumber(player.bankroll),
    xp: safeNumber(player.xp),
    reputation: safeNumber(player.reputation),
  };

  for (const goal of CITY_GOALS) {
    if (completed.has(goal.id)) continue;
    const row = buildGoalRow(goal, { content, career, player: nextPlayer, completed });
    if (!row.completed) continue;
    completed.add(goal.id);
    completedNow.push(goal.id);
    const bankrollReward = safeNumber(goal.reward?.bankroll);
    if (deferBankrollRewards) deferredBankrollReward += bankrollReward;
    else nextPlayer.bankroll += bankrollReward;
    nextPlayer.xp += safeNumber(goal.reward?.xp);
    nextPlayer.reputation += safeNumber(goal.reward?.reputation);
    log.push({
      id: goal.id,
      completedAtDay: safeNumber(career.life?.day, 1),
      reward: { ...goal.reward },
    });
  }

  const messages = completedNow.map((id) => {
    const goal = CITY_GOALS.find((entry) => entry.id === id);
    return `Цель Москвы: ${goal?.title ?? id} · ${formatReward(goal?.reward)}`;
  });

  const nextCareer = {
    ...career,
    cityGoals: normalizeCityGoalsState({
      ...state,
      completedGoalIds: [...completed],
      completedLog: log.slice(-100),
      lastCompletedIds: completedNow,
      lastMessage: messages.at(-1) ?? state.lastMessage,
      pendingBankrollReward: state.pendingBankrollReward + deferredBankrollReward,
    }),
  };

  return {
    career: nextCareer,
    player: nextPlayer,
    completedNow,
    messages,
    rewardToast: completedNow.length ? buildRewardToast(completedNow) : null,
  };
}

export function getPendingCityGoalBankrollReward(career = {}) {
  return Math.max(0, Math.round(safeNumber(career?.cityGoals?.pendingBankrollReward, 0)));
}

export function clearPendingCityGoalBankrollReward(career = {}) {
  const state = normalizeCityGoalsState(career.cityGoals);
  return {
    ...career,
    cityGoals: normalizeCityGoalsState({
      ...state,
      pendingBankrollReward: 0,
    }),
  };
}

function buildGoalRow(goal, { content, career, player, completed }) {
  const target = Math.max(1, safeNumber(goal.target, 1));
  const value = Math.max(0, safeNumber(goal.getValue?.({ content, career, player }) ?? 0));
  const done = completed.has(goal.id) || value >= target;
  return {
    ...goal,
    current: Math.min(value, target),
    target,
    percent: Math.max(0, Math.min(100, Math.round((Math.min(value, target) / target) * 100))),
    completed: done,
    rewardLabel: formatReward(goal.reward),
  };
}

function buildRewardToast(ids = []) {
  const goal = CITY_GOALS.find((entry) => entry.id === ids[0]);
  if (!goal) return null;
  const extra = ids.length > 1 ? ` + ещё ${ids.length - 1}` : "";
  return {
    kicker: "Цель Москвы",
    title: `${goal.title}${extra}`,
    reward: formatReward(goal.reward),
  };
}

function formatReward(reward = {}) {
  const parts = [];
  if (reward.bankroll) parts.push(`$${reward.bankroll}`);
  if (reward.xp) parts.push(`XP +${reward.xp}`);
  if (reward.reputation) parts.push(`Rep +${reward.reputation}`);
  return parts.join(" · ") || "—";
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeUniqueIds(value = []) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((entry) => String(entry)).filter(Boolean))];
}

function safeNumber(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}
