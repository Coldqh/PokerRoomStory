export function getClubGoals(content, career = {}, clubId) {
  const club = content?.byId?.clubs?.[clubId];
  if (!club) return [];

  const tables = getClubTables(content, club).filter(Boolean);
  const progress = normalizeGoalProgress(career?.clubGoalProgress);
  const goals = buildUniversalGoals({ club, tables });

  return goals.map((goal) => {
    const saved = progress[goal.id] ?? {};
    const current = Math.max(0, Math.round(Number(saved.current ?? 0) || 0));
    const completed = Boolean(saved.completed) || current >= goal.target;
    return {
      ...goal,
      current: Math.min(current, goal.target),
      completed,
      percent: goal.target > 0 ? Math.round((Math.min(current, goal.target) / goal.target) * 100) : 100,
    };
  });
}

export function applyClubGoals({ content, career = {}, clubId, table = null, tableState = null, result = null } = {}) {
  const club = content?.byId?.clubs?.[clubId];
  if (!club) {
    return {
      career,
      messages: [],
      completedNow: [],
      xpReward: 0,
      reputationReward: 0,
    };
  }

  const goals = getClubGoals(content, career, clubId);
  const progress = normalizeGoalProgress(career?.clubGoalProgress);
  const messages = [];
  const completedNow = [];
  let xpReward = 0;
  let reputationReward = 0;

  for (const goal of goals) {
    const previous = progress[goal.id] ?? { current: 0, completed: false };
    if (previous.completed) continue;

    const current = Math.max(0, Math.round(Number(previous.current ?? 0) || 0));
    const nextCurrent = getNextGoalValue(goal, current, { clubId, table, tableState, result });
    const completed = nextCurrent >= goal.target;

    progress[goal.id] = {
      current: Math.min(nextCurrent, goal.target),
      completed,
      completedAt: completed ? new Date().toISOString() : previous.completedAt ?? null,
    };

    if (!completed) continue;

    completedNow.push(goal.id);
    xpReward += Math.max(0, Math.round(Number(goal.reward?.xp ?? 0) || 0));
    reputationReward += Math.max(0, Math.round(Number(goal.reward?.reputation ?? 0) || 0));
    messages.push(`Club Goal: ${goal.name} · ${formatGoalReward(goal.reward)}`);
  }

  return {
    career: {
      ...career,
      clubGoalProgress: progress,
    },
    messages,
    completedNow,
    xpReward,
    reputationReward,
  };
}

function buildUniversalGoals({ club, tables }) {
  const shortTable = tables.find((table) => Number(table?.seatProfile?.maxPlayers ?? table?.seats ?? 6) <= 4);
  const highestBigBlind = Math.max(2, ...tables.map((table) => Number(table?.bigBlind ?? 2) || 2));
  const biggestTarget = Math.max(60, Math.min(250, highestBigBlind * 24));
  const clubName = String(club?.name ?? "Club");

  const goals = [
    {
      id: `${club.id}:hands:5`,
      clubId: club.id,
      type: "club_hands",
      name: "Первые руки",
      description: `Сыграй 5 рук в ${clubName}.`,
      target: 5,
      reward: { xp: 40, reputation: 2 },
    },
    {
      id: `${club.id}:wins:2`,
      clubId: club.id,
      type: "club_wins",
      name: "Забрать банки",
      description: `Выиграй 2 руки в ${clubName}.`,
      target: 2,
      reward: { xp: 60, reputation: 3 },
    },
    {
      id: `${club.id}:showdowns:2`,
      clubId: club.id,
      type: "club_showdowns",
      name: "Дойти до вскрытия",
      description: `Увидь 2 шоудауна в ${clubName}.`,
      target: 2,
      reward: { xp: 55, reputation: 2 },
    },
    {
      id: `${club.id}:big_pot:${biggestTarget}`,
      clubId: club.id,
      type: "club_big_pot",
      name: "Крупный банк",
      description: `Выиграй банк $${biggestTarget}+ в ${clubName}.`,
      target: biggestTarget,
      reward: { xp: 80, reputation: 4 },
    },
  ];

  if (shortTable) {
    goals.push({
      id: `${club.id}:table_hands:${shortTable.id}:3`,
      clubId: club.id,
      tableId: shortTable.id,
      type: "table_hands",
      name: "Короткий стол",
      description: `Сыграй 3 руки за ${shortTable.name}.`,
      target: 3,
      reward: { xp: 45, reputation: 2 },
    });
  }

  return goals;
}

function getNextGoalValue(goal, current, { clubId, table, result }) {
  const tableClubId = table?.clubId ?? clubId;
  if (tableClubId !== goal.clubId) return current;

  if (goal.type === "club_hands") return current + 1;
  if (goal.type === "club_wins") return result?.winner === "player" ? current + 1 : current;
  if (goal.type === "club_showdowns") return result?.showdown ? current + 1 : current;
  if (goal.type === "club_big_pot") return result?.winner === "player" ? Math.max(current, Math.round(Number(result?.pot ?? 0) || 0)) : current;
  if (goal.type === "table_hands") return table?.id === goal.tableId ? current + 1 : current;

  return current;
}

function getClubTables(content, club) {
  return (club?.tables ?? []).map((id) => content?.byId?.tables?.[id]).filter(Boolean);
}

function normalizeGoalProgress(progress = {}) {
  const source = progress && typeof progress === "object" && !Array.isArray(progress) ? progress : {};
  const next = {};
  for (const [id, value] of Object.entries(source)) {
    next[id] = {
      current: Math.max(0, Math.round(Number(value?.current ?? 0) || 0)),
      completed: Boolean(value?.completed),
      completedAt: value?.completedAt ?? null,
    };
  }
  return next;
}

function formatGoalReward(reward = {}) {
  const parts = [];
  if (reward.xp) parts.push(`XP +${reward.xp}`);
  if (reward.reputation) parts.push(`Rep +${reward.reputation}`);
  return parts.length ? parts.join(" · ") : "без награды";
}
