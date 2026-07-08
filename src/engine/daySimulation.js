import { getLifeHousing, getLifeVehicle } from "./lifeContent.js?v=3.6.0";
import { getBusinessDailyProfit, normalizeBusinessState } from "./businesses.js?v=3.6.0";
import { getBusinessTemplate } from "./businessContent.js?v=3.6.0";
import { getJobById } from "./jobContent.js?v=3.6.0";

const MAX_NEED = 100;
const RENT_INTERVAL_DAYS = 7;
const VEHICLE_UPKEEP_INTERVAL_DAYS = 7;

export function simulateDayRollover({ career = {}, player = {}, life = {}, sleptPreviousDay = false } = {}) {
  const nextPlayer = { ...player, bankroll: money(player.bankroll), xp: money(player.xp) };
  let nextLife = {
    ...life,
    needs: { ...(life.needs ?? {}) },
  };
  let nextBusinesses = normalizeBusinessState(career.businesses);
  let nextJobs = normalizeJobsStateLoose(career.jobs);
  const messages = [];
  const summary = {
    day: Number(nextLife.day ?? 1),
    lines: [],
    finances: [],
    needs: [],
    jobs: [],
    businesses: [],
  };

  applyDailyNeeds({ life: nextLife, sleptPreviousDay, messages, summary });
  applyRent({ life: nextLife, player: nextPlayer, messages, summary });
  applyVehicleUpkeep({ life: nextLife, player: nextPlayer, messages, summary });
  const businessResult = applyBusinessDay({ businesses: nextBusinesses, day: nextLife.day, summary });
  nextBusinesses = businessResult.businesses;
  applyJobAbsence({ jobs: nextJobs, day: nextLife.day, messages, summary });

  summary.lines = [
    ...summary.needs,
    ...summary.finances,
    ...summary.businesses,
    ...summary.jobs,
  ];

  nextLife.daySummary = summary;
  nextLife.lastDaySummary = summary;

  return {
    career: {
      ...career,
      life: nextLife,
      businesses: nextBusinesses,
      jobs: nextJobs,
    },
    player: nextPlayer,
    life: nextLife,
    businesses: nextBusinesses,
    jobs: nextJobs,
    messages,
    summary,
  };
}

function applyDailyNeeds({ life, sleptPreviousDay, messages, summary }) {
  if (sleptPreviousDay) {
    life.needs = applyNeedEffect(life.needs, { hunger: -20, thirst: -25, energy: 20, stress: -2 });
    life.sleepDebt = Math.max(0, Number(life.sleepDebt ?? 0) - 1);
    summary.needs.push("Сон: нормально. Energy +20 · Stress -2.");
  } else {
    life.needs = applyNeedEffect(life.needs, { hunger: -20, thirst: -25, energy: -25, stress: 15 });
    life.sleepDebt = clampInt(Number(life.sleepDebt ?? 0) + 1, 0, 999);
    messages.push("Сон пропущен. Energy -25 · Stress +15.");
    summary.needs.push("Сон пропущен. Energy -25 · Stress +15.");
  }

  summary.needs.push("Потребности: Hunger -20 · Thirst -25.");

  if (Number(life.needs.hunger ?? 0) <= 0) {
    life.needs.stress = clamp(Number(life.needs.stress ?? 0) + 15, 0, MAX_NEED);
    summary.needs.push("Голод на нуле. Stress +15.");
  }

  if (Number(life.needs.thirst ?? 0) <= 0) {
    life.needs.energy = clamp(Number(life.needs.energy ?? 0) - 20, 0, MAX_NEED);
    summary.needs.push("Жажда на нуле. Energy -20.");
  }
}

function applyRent({ life, player, messages, summary }) {
  const housing = getLifeHousing(life.housingId) ?? getLifeHousing("HOUSING_CHEAP_ROOM");
  const ownedHousingIds = Array.isArray(life.ownedHousingIds) ? life.ownedHousingIds : [];
  const ownsCurrentHousing = ownedHousingIds.includes(housing.id);

  if (ownsCurrentHousing || Number(life.rentAmount ?? 0) <= 0) {
    life.rentAmount = 0;
    life.rentDueDay = 9999;
    return;
  }

  if (Number(life.day ?? 1) < Number(life.rentDueDay ?? 7)) return;

  const rent = money(life.rentAmount || housing.rent || 0);
  if (money(player.bankroll) >= rent) {
    player.bankroll = money(player.bankroll) - rent;
    messages.push(`Аренда: -$${rent}.`);
    summary.finances.push(`Жильё: -$${rent}.`);
  } else {
    life.debt = money(life.debt) + rent;
    life.needs.stress = clamp(Number(life.needs.stress ?? 0) + 20, 0, MAX_NEED);
    messages.push(`Аренда не оплачена. Долг +$${rent}.`);
    summary.finances.push(`Жильё: долг +$${rent}. Stress +20.`);
  }

  const interval = Number(housing.intervalDays ?? RENT_INTERVAL_DAYS) || RENT_INTERVAL_DAYS;
  while (Number(life.rentDueDay ?? 0) <= Number(life.day ?? 1)) life.rentDueDay += interval;
}

function applyVehicleUpkeep({ life, player, messages, summary }) {
  const vehicle = getLifeVehicle(life.vehicleId);
  if (!vehicle) {
    life.vehicleUpkeepDueDay = null;
    return;
  }

  const upkeep = money(vehicle.upkeepPer7Days ?? 0);
  const dueDay = Number.isFinite(Number(life.vehicleUpkeepDueDay))
    ? Number(life.vehicleUpkeepDueDay)
    : Number(life.day ?? 1) + VEHICLE_UPKEEP_INTERVAL_DAYS;
  life.vehicleUpkeepDueDay = dueDay;

  if (upkeep <= 0 || Number(life.day ?? 1) < dueDay) return;

  if (money(player.bankroll) >= upkeep) {
    player.bankroll = money(player.bankroll) - upkeep;
    messages.push(`Обслуживание авто: -$${upkeep}.`);
    summary.finances.push(`Авто: ${vehicle.name} · -$${upkeep}.`);
  } else {
    life.debt = money(life.debt) + upkeep;
    life.needs.stress = clamp(Number(life.needs.stress ?? 0) + 10, 0, MAX_NEED);
    messages.push(`Обслуживание авто не оплачено. Долг +$${upkeep}.`);
    summary.finances.push(`Авто: долг +$${upkeep}. Stress +10.`);
  }

  while (Number(life.vehicleUpkeepDueDay ?? 0) <= Number(life.day ?? 1)) life.vehicleUpkeepDueDay += VEHICLE_UPKEEP_INTERVAL_DAYS;
}

function applyBusinessDay({ businesses, day, summary }) {
  const next = normalizeBusinessState(businesses);
  let totalPending = 0;
  let ownedCount = 0;

  for (const id of next.ownedIds) {
    const owned = next.byId[id];
    const template = getBusinessTemplate(id);
    if (!owned || !template) continue;
    ownedCount += 1;
    const uncollectedDays = Math.max(0, Number(day ?? 1) - Number(owned.lastCollectedDay ?? day));
    const dailyProfit = getBusinessDailyProfit(template, owned);
    totalPending += dailyProfit * uncollectedDays;
  }

  if (ownedCount > 0) {
    summary.businesses.push(`Бизнесы: ${ownedCount} · к сбору $${Math.max(0, Math.round(totalPending))}.`);
  }

  return { businesses: next };
}

function applyJobAbsence({ jobs, day, messages, summary }) {
  if (!jobs.currentJobId) return;
  const job = getJobById(jobs.currentJobId);
  if (!job) return;

  const anchorDay = Number.isFinite(Number(jobs.lastWorkedDay))
    ? Number(jobs.lastWorkedDay)
    : Number.isFinite(Number(jobs.currentJobStartedDay))
      ? Number(jobs.currentJobStartedDay)
      : Number(day ?? 1);
  const missedDays = Math.max(0, Number(day ?? 1) - anchorDay);
  jobs.missedWorkDays = missedDays;

  if (missedDays >= 7) {
    jobs.firedFromIds = [...new Set([...(jobs.firedFromIds ?? []), job.id])];
    jobs.currentJobId = null;
    jobs.lastMessage = `Уволен: ${job.title}. Пропущено ${missedDays} дн.`;
    messages.push(jobs.lastMessage);
    summary.jobs.push(jobs.lastMessage);
    return;
  }

  if (missedDays >= 5) {
    jobs.lastMessage = `Работа: ${job.title}. Риск увольнения, пропущено ${missedDays} дн.`;
    summary.jobs.push(jobs.lastMessage);
    return;
  }

  if (missedDays >= 3) {
    jobs.lastMessage = `Работа: ${job.title}. Предупреждение, пропущено ${missedDays} дн.`;
    summary.jobs.push(jobs.lastMessage);
  }
}

function normalizeJobsStateLoose(jobs = {}) {
  return {
    currentJobId: typeof jobs.currentJobId === "string" ? jobs.currentJobId : null,
    jobXpById: jobs.jobXpById && typeof jobs.jobXpById === "object" ? { ...jobs.jobXpById } : {},
    totalShiftsWorked: Math.max(0, Math.round(Number(jobs.totalShiftsWorked ?? 0) || 0)),
    firedFromIds: Array.isArray(jobs.firedFromIds) ? [...new Set(jobs.firedFromIds.map(String).filter(Boolean))] : [],
    lastWorkedDay: Number.isFinite(Number(jobs.lastWorkedDay)) ? Math.max(1, Math.round(Number(jobs.lastWorkedDay))) : null,
    currentJobStartedDay: Number.isFinite(Number(jobs.currentJobStartedDay)) ? Math.max(1, Math.round(Number(jobs.currentJobStartedDay))) : null,
    missedWorkDays: Math.max(0, Math.round(Number(jobs.missedWorkDays ?? 0) || 0)),
    lastMessage: typeof jobs.lastMessage === "string" ? jobs.lastMessage : null,
  };
}

function applyNeedEffect(needs = {}, effect = {}) {
  return {
    hunger: clamp(Number(needs.hunger ?? 0) + Number(effect.hunger ?? 0), 0, MAX_NEED),
    thirst: clamp(Number(needs.thirst ?? 0) + Number(effect.thirst ?? 0), 0, MAX_NEED),
    energy: clamp(Number(needs.energy ?? 0) + Number(effect.energy ?? 0), 0, MAX_NEED),
    stress: clamp(Number(needs.stress ?? 0) + Number(effect.stress ?? 0), 0, MAX_NEED),
  };
}

function money(value) {
  return Math.max(0, Math.round(Number(value) || 0));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number.isFinite(Number(value)) ? value : min));
}

function clampInt(value, min, max) {
  return Math.round(clamp(value, min, max));
}
