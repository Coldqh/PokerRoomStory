import { normalizeLifeState } from "./life.js?v=2.7.4";

const MAX_NEED = 100;

export function createSessionStats({ tableSession = {}, life = {} } = {}) {
  const normalizedLife = normalizeLifeState(life);
  const startStack = money(tableSession.startStack ?? tableSession.stack ?? tableSession.buyIn ?? 0);
  return {
    startedDay: normalizedLife.day,
    handsPlayed: 0,
    buyIn: money(tableSession.buyIn ?? startStack),
    startStack,
    currentStack: startStack,
    profit: 0,
    biggestPotWon: 0,
    showdowns: 0,
    folds: 0,
    allIns: 0,
    hungerSpent: 0,
    thirstSpent: 0,
    energySpent: 0,
    stressGained: 0,
  };
}

export function normalizeSessionStats(stats = {}, tableSession = {}, life = {}) {
  const base = createSessionStats({ tableSession, life });
  const currentStack = money(stats.currentStack ?? tableSession.stack ?? base.currentStack);
  const startStack = money(stats.startStack ?? base.startStack);
  return {
    ...base,
    ...stats,
    startedDay: int(stats.startedDay, base.startedDay, 1, 99999),
    handsPlayed: int(stats.handsPlayed, base.handsPlayed, 0, 99999),
    buyIn: money(stats.buyIn ?? base.buyIn),
    startStack,
    currentStack,
    profit: money(currentStack - startStack),
    biggestPotWon: money(stats.biggestPotWon ?? base.biggestPotWon),
    showdowns: int(stats.showdowns, base.showdowns, 0, 99999),
    folds: int(stats.folds, base.folds, 0, 99999),
    allIns: int(stats.allIns, base.allIns, 0, 99999),
    hungerSpent: int(stats.hungerSpent, base.hungerSpent, 0, 99999),
    thirstSpent: int(stats.thirstSpent, base.thirstSpent, 0, 99999),
    energySpent: int(stats.energySpent, base.energySpent, 0, 99999),
    stressGained: int(stats.stressGained, base.stressGained, 0, 99999),
  };
}

export function applySessionHandResult({ career = {}, tableSession = {}, tableState = {}, settledTableState = {}, result = {}, table = {} } = {}) {
  if (!tableSession) return { career, tableSession, impact: null, message: null };

  const life = normalizeLifeState(career.life);
  const previousStats = normalizeSessionStats(tableSession.sessionStats, tableSession, life);
  const nextHandCount = previousStats.handsPlayed + 1;
  const impact = getHandNeedImpact({ table, handsPlayed: nextHandCount });
  const nextLife = {
    ...life,
    needs: applyNeedImpact(life.needs, impact),
    lastMessage: formatNeedImpactMessage(impact),
  };
  const currentStack = money(settledTableState?.heroSeat?.stack ?? tableSession.stack ?? previousStats.currentStack);
  const heroFolded = Boolean(tableState?.heroSeat?.folded || tableState?.lastPlayerAction === "fold" || tableState?.phase === "folded");
  const heroAllIn = Boolean(tableState?.heroSeat?.allIn || settledTableState?.heroSeat?.allIn);
  const heroWonPot = result?.winner === "player" || (Array.isArray(result?.winners) && result.winners.includes("player"));
  const pot = money(result?.pot ?? tableState?.pot ?? 0);
  const stats = normalizeSessionStats({
    ...previousStats,
    handsPlayed: nextHandCount,
    currentStack,
    profit: currentStack - previousStats.startStack,
    biggestPotWon: heroWonPot ? Math.max(previousStats.biggestPotWon, pot) : previousStats.biggestPotWon,
    showdowns: previousStats.showdowns + (result?.showdown ? 1 : 0),
    folds: previousStats.folds + (heroFolded ? 1 : 0),
    allIns: previousStats.allIns + (heroAllIn ? 1 : 0),
    hungerSpent: previousStats.hungerSpent + Math.abs(Math.min(0, impact.hunger)),
    thirstSpent: previousStats.thirstSpent + Math.abs(Math.min(0, impact.thirst)),
    energySpent: previousStats.energySpent + Math.abs(Math.min(0, impact.energy)),
    stressGained: previousStats.stressGained + Math.max(0, impact.stress),
  }, { ...tableSession, stack: currentStack }, nextLife);

  return {
    career: { ...career, life: normalizeLifeState(nextLife) },
    tableSession: {
      ...tableSession,
      handsPlayed: stats.handsPlayed,
      stack: currentStack,
      sessionStats: stats,
    },
    impact,
    message: formatNeedImpactMessage(impact),
  };
}

export function buildSessionSummary({ tableSession = {}, returnedStack = null } = {}) {
  const stats = normalizeSessionStats(tableSession.sessionStats, tableSession, {});
  const currentStack = money(returnedStack ?? tableSession.stack ?? stats.currentStack);
  const profit = currentStack - stats.startStack;
  return {
    opened: true,
    handsPlayed: stats.handsPlayed,
    buyIn: stats.buyIn,
    startStack: stats.startStack,
    currentStack,
    profit,
    biggestPotWon: stats.biggestPotWon,
    showdowns: stats.showdowns,
    folds: stats.folds,
    allIns: stats.allIns,
    hungerSpent: stats.hungerSpent,
    thirstSpent: stats.thirstSpent,
    energySpent: stats.energySpent,
    stressGained: stats.stressGained,
  };
}

export function getPokerStartConditionWarning(career = {}) {
  const life = normalizeLifeState(career.life);
  if (life.needs.energy < 15) return "Ты вымотан. Лучше отдохнуть перед новой раздачей.";
  if (life.needs.hunger < 10 || life.needs.thirst < 10) return "Состояние плохое. Сходи поесть или выпить.";
  if (life.needs.stress >= 90) return "Стресс критический. Есть риск тильта.";
  return null;
}

export function getHandNeedImpact({ table = {}, handsPlayed = 1 } = {}) {
  const bigBlind = Number(table?.bigBlind ?? 0);
  const highStakesStress = bigBlind >= 10 ? 1 : 0;
  const longSessionEnergy = handsPlayed >= 10 && handsPlayed % 3 === 0 ? -1 : 0;
  return {
    hunger: -2,
    thirst: -2,
    energy: -1 + longSessionEnergy,
    stress: 1 + highStakesStress,
  };
}

function applyNeedImpact(needs = {}, impact = {}) {
  return {
    hunger: clamp(Number(needs.hunger ?? 0) + Number(impact.hunger ?? 0), 0, MAX_NEED),
    thirst: clamp(Number(needs.thirst ?? 0) + Number(impact.thirst ?? 0), 0, MAX_NEED),
    energy: clamp(Number(needs.energy ?? 0) + Number(impact.energy ?? 0), 0, MAX_NEED),
    stress: clamp(Number(needs.stress ?? 0) + Number(impact.stress ?? 0), 0, MAX_NEED),
  };
}

function formatNeedImpactMessage(impact = {}) {
  const parts = [];
  if (impact.hunger) parts.push(`Hunger ${signed(impact.hunger)}`);
  if (impact.thirst) parts.push(`Thirst ${signed(impact.thirst)}`);
  if (impact.energy) parts.push(`Energy ${signed(impact.energy)}`);
  if (impact.stress) parts.push(`Stress ${signed(impact.stress)}`);
  return parts.length ? `Сессия: ${parts.join(" · ")}.` : null;
}

function signed(value) {
  const clean = Number(value) || 0;
  return `${clean > 0 ? "+" : ""}${clean}`;
}

function money(value) {
  return Math.round(Number(value) || 0);
}

function int(value, fallback, min, max) {
  const number = Number.isFinite(Number(value)) ? Number(value) : fallback;
  return Math.round(clamp(number, min, max));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number.isFinite(Number(value)) ? value : min));
}
