export function getClubStorylines(content, career = {}, clubId) {
  const storylines = (content?.storylines ?? []).filter((storyline) => storyline.clubId === clubId);
  const progress = normalizeStoryProgress(career?.storyProgress);
  return storylines.map((storyline) => buildStoryView(storyline, progress[storyline.id])).filter(Boolean);
}

export function applyStorylineProgress({ content, career = {}, clubId, table = null, tableState = null, result = null, player = null } = {}) {
  const storylines = getClubStorylines(content, career, clubId).filter((story) => !story.completed);
  if (!storylines.length) {
    return {
      career,
      messages: [],
      completedNow: [],
      xpReward: 0,
      reputationReward: 0,
    };
  }

  const progress = normalizeStoryProgress(career?.storyProgress);
  const messages = [];
  const completedNow = [];
  let xpReward = 0;
  let reputationReward = 0;
  let nextCareer = { ...career };

  for (const story of storylines) {
    const saved = progress[story.id] ?? createStorySave();
    if (saved.completed) continue;

    const step = story.steps[saved.stepIndex] ?? null;
    if (!step) {
      progress[story.id] = { ...saved, completed: true };
      continue;
    }

    const current = Math.max(0, Math.round(Number(saved.current ?? 0) || 0));
    const nextCurrent = getNextStepValue(step, current, { career: nextCareer, clubId, table, tableState, result, player });
    const stepCompleted = nextCurrent >= step.target;
    const completedSteps = [...new Set([...(saved.completedSteps ?? []), ...(stepCompleted ? [step.id] : [])])];
    const nextStepIndex = stepCompleted ? saved.stepIndex + 1 : saved.stepIndex;
    const storyCompleted = nextStepIndex >= story.steps.length;
    const unlock = stepCompleted ? (step.unlocks ?? (storyCompleted ? story.unlocks : null)) : null;

    progress[story.id] = {
      ...saved,
      started: true,
      current: stepCompleted ? 0 : Math.min(nextCurrent, step.target),
      stepIndex: Math.min(nextStepIndex, story.steps.length - 1),
      completedSteps,
      completed: storyCompleted,
      unlocked: storyCompleted ? (unlock ?? saved.unlocked ?? null) : (saved.unlocked ?? null),
      updatedAt: new Date().toISOString(),
    };

    if (!stepCompleted) continue;

    const reward = step.reward ?? {};
    completedNow.push(`${story.id}:${step.id}`);
    xpReward += Math.max(0, Math.round(Number(reward.xp ?? 0) || 0));
    reputationReward += Math.max(0, Math.round(Number(reward.reputation ?? 0) || 0));
    messages.push(`Story: ${story.title} · ${step.title} · ${formatStoryReward(reward)}`);
    if (step.completeMessage) messages.push(step.completeMessage);
    if (unlock) {
      nextCareer = applyStoryUnlock(content, nextCareer, unlock);
      if (unlock.clubLabel) messages.push(`Новая локация: ${unlock.clubLabel}`);
    }
  }

  return {
    career: {
      ...nextCareer,
      storyProgress: progress,
    },
    messages,
    completedNow,
    xpReward,
    reputationReward,
  };
}

function buildStoryView(storyline, saved = null) {
  const progress = saved ?? createStorySave();
  const stepIndex = Math.min(Math.max(0, Number(progress.stepIndex ?? 0) || 0), Math.max(0, storyline.steps.length - 1));
  const currentStep = storyline.steps[stepIndex] ?? null;
  if (!currentStep) return null;
  const current = Math.max(0, Math.round(Number(progress.current ?? 0) || 0));
  const completed = Boolean(progress.completed);
  const visibleCurrent = completed ? currentStep.target : Math.min(current, currentStep.target);

  return {
    ...storyline,
    stepIndex,
    completed,
    unlocked: progress.unlocked ?? (completed ? storyline.unlocks : null),
    currentStep: {
      ...currentStep,
      current: visibleCurrent,
      completed: completed || visibleCurrent >= currentStep.target,
      percent: currentStep.target > 0 ? Math.round((visibleCurrent / currentStep.target) * 100) : 100,
    },
    completedSteps: progress.completedSteps ?? [],
  };
}

function getNextStepValue(step, current, { career, clubId, table, result, player }) {
  const stepClubId = step.clubId ?? null;
  if (stepClubId && stepClubId !== clubId) return current;
  if (step.tableId && table?.id !== step.tableId) return current;
  if (!step.tableId && table?.clubId && table.clubId !== clubId) return current;

  if (step.type === "club_hands") return current + 1;
  if (step.type === "table_hands") return current + 1;
  if (step.type === "club_wins") return result?.winner === "player" ? current + 1 : current;
  if (step.type === "table_wins") return result?.winner === "player" ? current + 1 : current;
  if (step.type === "club_showdowns") return result?.showdown ? current + 1 : current;
  if (step.type === "club_big_pot") return result?.winner === "player" ? Math.max(current, Math.round(Number(result?.pot ?? 0) || 0)) : current;
  if (step.type === "player_reputation") return Math.max(current, Math.round(Number(player?.reputation ?? 0) || 0));
  if (step.type === "player_bankroll") return Math.max(current, Math.round(Number(player?.bankroll ?? 0) || 0));
  if (step.type === "room_mastery_level") return Math.max(current, getClubMasteryLevel(career, clubId));

  return current;
}

function applyStoryUnlock(content, career = {}, unlock = {}) {
  const unlockedCountries = new Set(career.unlockedCountries ?? []);
  const unlockedCities = new Set(career.unlockedCities ?? []);
  const unlockedClubs = new Set(career.unlockedClubs ?? []);
  const unlockedTables = new Set(career.unlockedTables ?? []);

  if (unlock.countryId) unlockedCountries.add(unlock.countryId);
  if (unlock.cityId) unlockedCities.add(unlock.cityId);
  if (unlock.clubId) {
    const club = content?.byId?.clubs?.[unlock.clubId];
    unlockedClubs.add(unlock.clubId);
    if (club?.cityId) unlockedCities.add(club.cityId);
    for (const tableId of club?.tables ?? []) {
      const table = content?.byId?.tables?.[tableId];
      if (!table?.unlockRequirement) unlockedTables.add(tableId);
    }
  }
  for (const tableId of unlock.tableIds ?? []) unlockedTables.add(tableId);

  return {
    ...career,
    unlockedCountries: [...unlockedCountries],
    unlockedCities: [...unlockedCities],
    unlockedClubs: [...unlockedClubs],
    unlockedTables: [...unlockedTables],
  };
}

function getClubMasteryLevel(career = {}, clubId) {
  const value = career?.clubProgress?.[clubId]?.level ?? career?.clubProgress?.[clubId]?.progression?.level ?? 0;
  return Math.max(0, Math.round(Number(value ?? 0) || 0));
}

function normalizeStoryProgress(progress = {}) {
  const source = progress && typeof progress === "object" && !Array.isArray(progress) ? progress : {};
  const next = {};
  for (const [storyId, value] of Object.entries(source)) {
    next[storyId] = {
      started: value?.started !== false,
      current: Math.max(0, Math.round(Number(value?.current ?? 0) || 0)),
      stepIndex: Math.max(0, Math.round(Number(value?.stepIndex ?? 0) || 0)),
      completedSteps: Array.isArray(value?.completedSteps) ? value.completedSteps : [],
      completed: Boolean(value?.completed),
      unlocked: value?.unlocked ?? null,
      updatedAt: value?.updatedAt ?? null,
    };
  }
  return next;
}

function createStorySave() {
  return {
    started: true,
    current: 0,
    stepIndex: 0,
    completedSteps: [],
    completed: false,
    unlocked: null,
    updatedAt: null,
  };
}

function formatStoryReward(reward = {}) {
  const parts = [];
  if (reward.xp) parts.push(`XP +${reward.xp}`);
  if (reward.reputation) parts.push(`Rep +${reward.reputation}`);
  return parts.length ? parts.join(" · ") : "без награды";
}
