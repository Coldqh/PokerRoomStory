const MAX_ENERGY = 100;
const MAX_STRESS = 100;
const MAX_FOCUS = 3;
const ACTIONS_PER_DAY = 3;
const RENT_INTERVAL_DAYS = 7;
const RENT_AMOUNT = 250;

export const LIFE_ACTIONS = [
  {
    id: "work_shift",
    label: "Подработка",
    kicker: "Money",
    description: "Отработать смену и пополнить банкролл. Усталость и стресс растут.",
    effect: "+$100 · Energy -25 · Stress +12",
  },
  {
    id: "study_poker",
    label: "Изучать покер",
    kicker: "Study",
    description: "Разобрать базовые линии, диапазоны и частые ошибки.",
    effect: "Focus +1 · XP +25 · Energy -18",
  },
  {
    id: "review_hands",
    label: "Разобрать руки",
    kicker: "Review",
    description: "Спокойно пройти последние банки и убрать лишний тильт.",
    effect: "Focus +1 · XP +15 · Stress -8",
  },
  {
    id: "rest",
    label: "Отдохнуть",
    kicker: "Recovery",
    description: "Вернуть энергию и сбросить давление перед следующей сессией.",
    effect: "Energy +35 · Stress -18",
  },
  {
    id: "walk_gym",
    label: "Зал / прогулка",
    kicker: "Body",
    description: "Держать голову чистой и не разваливаться от гринда.",
    effect: "Energy -14 · Stress -12 · XP +8",
  },
  {
    id: "play_club",
    label: "Играть в клубе",
    kicker: "Poker night",
    description: "Подготовиться и перейти к карте клубов.",
    effect: "Energy -5 · Stress +3 · переход на карту",
    nextScreen: "locations",
  },
];

export function createInitialLifeState() {
  return {
    day: 1,
    energy: 80,
    stress: 15,
    focusTokens: 0,
    rentDueDay: 7,
    rentAmount: RENT_AMOUNT,
    debt: 0,
    actionsToday: 0,
    actionsPerDay: ACTIONS_PER_DAY,
    lastMessage: null,
  };
}

export function normalizeLifeState(life = {}) {
  const base = createInitialLifeState();
  return {
    ...base,
    ...life,
    day: clampInt(life.day, base.day, 1, 9999),
    energy: clampInt(life.energy, base.energy, 0, MAX_ENERGY),
    stress: clampInt(life.stress, base.stress, 0, MAX_STRESS),
    focusTokens: clampInt(life.focusTokens, base.focusTokens, 0, MAX_FOCUS),
    rentDueDay: clampInt(life.rentDueDay, base.rentDueDay, 1, 9999),
    rentAmount: clampInt(life.rentAmount, base.rentAmount, 1, 999999),
    debt: clampInt(life.debt, base.debt, 0, 999999),
    actionsToday: clampInt(life.actionsToday, base.actionsToday, 0, ACTIONS_PER_DAY),
    actionsPerDay: ACTIONS_PER_DAY,
    lastMessage: typeof life.lastMessage === "string" ? life.lastMessage : null,
  };
}

export function getLifeView(career = {}, player = {}) {
  const life = normalizeLifeState(career.life);
  const daysUntilRent = Math.max(0, life.rentDueDay - life.day);
  const actionsLeft = Math.max(0, life.actionsPerDay - life.actionsToday);
  const warnings = [];
  if (life.energy < 25) warnings.push("Мало энергии. Перед длинной сессией лучше восстановиться.");
  if (life.stress >= 80) warnings.push("Стресс высокий. Играть можно, но риск тильта уже заметный.");
  if (Number(player.bankroll ?? 0) < life.rentAmount && daysUntilRent <= 1) warnings.push("Аренда близко, банкролла может не хватить.");

  return {
    life,
    actions: LIFE_ACTIONS.map((action) => ({
      ...action,
      disabled: !canTakeLifeAction(life, action),
      disabledReason: getActionDisabledReason(life, action),
    })),
    actionsLeft,
    daysUntilRent,
    warnings,
    energyPercent: life.energy,
    stressPercent: life.stress,
    focusPercent: Math.round((life.focusTokens / MAX_FOCUS) * 100),
  };
}

export function applyLifeAction({ actionId, career = {}, player = {} } = {}) {
  const action = LIFE_ACTIONS.find((entry) => entry.id === actionId);
  if (!action) {
    return { career, player, ok: false, message: "Действие не найдено.", nextScreen: null };
  }

  const life = normalizeLifeState(career.life);
  if (!canTakeLifeAction(life, action)) {
    return { career: { ...career, life }, player, ok: false, message: getActionDisabledReason(life, action), nextScreen: null };
  }

  let nextLife = { ...life };
  let nextPlayer = { ...player };
  const messages = [];

  if (action.id === "work_shift") {
    nextPlayer.bankroll = money(nextPlayer.bankroll) + 100;
    nextLife.energy = clamp(nextLife.energy - 25, 0, MAX_ENERGY);
    nextLife.stress = clamp(nextLife.stress + 12, 0, MAX_STRESS);
    messages.push("Подработка: +$100.");
  }

  if (action.id === "study_poker") {
    nextPlayer.xp = money(nextPlayer.xp) + 25;
    nextLife.focusTokens = clamp(nextLife.focusTokens + 1, 0, MAX_FOCUS);
    nextLife.energy = clamp(nextLife.energy - 18, 0, MAX_ENERGY);
    nextLife.stress = clamp(nextLife.stress + 4, 0, MAX_STRESS);
    messages.push("Учёба: Focus +1, XP +25.");
  }

  if (action.id === "review_hands") {
    nextPlayer.xp = money(nextPlayer.xp) + 15;
    nextLife.focusTokens = clamp(nextLife.focusTokens + 1, 0, MAX_FOCUS);
    nextLife.energy = clamp(nextLife.energy - 12, 0, MAX_ENERGY);
    nextLife.stress = clamp(nextLife.stress - 8, 0, MAX_STRESS);
    messages.push("Разбор рук: Focus +1, стресс ниже.");
  }

  if (action.id === "rest") {
    nextLife.energy = clamp(nextLife.energy + 35, 0, MAX_ENERGY);
    nextLife.stress = clamp(nextLife.stress - 18, 0, MAX_STRESS);
    messages.push("Отдых: энергия восстановлена.");
  }

  if (action.id === "walk_gym") {
    nextPlayer.xp = money(nextPlayer.xp) + 8;
    nextLife.energy = clamp(nextLife.energy - 14, 0, MAX_ENERGY);
    nextLife.stress = clamp(nextLife.stress - 12, 0, MAX_STRESS);
    messages.push("Зал / прогулка: голова чище.");
  }

  if (action.id === "play_club") {
    nextLife.energy = clamp(nextLife.energy - 5, 0, MAX_ENERGY);
    nextLife.stress = clamp(nextLife.stress + 3, 0, MAX_STRESS);
    messages.push("Пора в клуб.");
  }

  nextLife.actionsToday += 1;
  const dayResult = advanceDayIfNeeded(nextLife, nextPlayer);
  nextLife = dayResult.life;
  nextPlayer = dayResult.player;
  messages.push(...dayResult.messages);
  nextLife.lastMessage = messages.join(" ");

  return {
    career: { ...career, life: nextLife },
    player: nextPlayer,
    ok: true,
    message: nextLife.lastMessage,
    nextScreen: action.nextScreen ?? null,
  };
}

function advanceDayIfNeeded(life, player) {
  const messages = [];
  let nextLife = { ...life };
  let nextPlayer = { ...player };

  if (nextLife.actionsToday < nextLife.actionsPerDay) {
    return { life: nextLife, player: nextPlayer, messages };
  }

  nextLife.day += 1;
  nextLife.actionsToday = 0;
  nextLife.energy = clamp(nextLife.energy + 8, 0, MAX_ENERGY);
  messages.push(`День ${nextLife.day}.`);

  if (nextLife.day >= nextLife.rentDueDay) {
    const rent = nextLife.rentAmount;
    if (money(nextPlayer.bankroll) >= rent) {
      nextPlayer.bankroll = money(nextPlayer.bankroll) - rent;
      messages.push(`Аренда: -$${rent}.`);
    } else {
      nextLife.debt += rent;
      nextLife.stress = clamp(nextLife.stress + 20, 0, MAX_STRESS);
      messages.push(`Аренда не оплачена. Долг +$${rent}.`);
    }
    nextLife.rentDueDay += RENT_INTERVAL_DAYS;
  }

  return { life: nextLife, player: nextPlayer, messages };
}

function canTakeLifeAction(life, action) {
  if (["rest"].includes(action.id)) return true;
  if (life.energy <= 0) return false;
  if (["work_shift"].includes(action.id) && life.energy < 20) return false;
  if (["study_poker", "review_hands", "walk_gym"].includes(action.id) && life.energy < 12) return false;
  if (action.id === "play_club" && life.energy < 5) return false;
  return true;
}

function getActionDisabledReason(life, action) {
  if (canTakeLifeAction(life, action)) return null;
  return "Не хватает энергии. Сначала отдохни.";
}

function money(value) {
  return Math.max(0, Math.round(Number(value) || 0));
}

function clampInt(value, fallback, min, max) {
  return Math.round(clamp(Number.isFinite(Number(value)) ? Number(value) : fallback, min, max));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number.isFinite(Number(value)) ? Number(value) : min));
}
