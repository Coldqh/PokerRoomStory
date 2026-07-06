import { normalizeLifeState, spendLifeActionCost } from "./life.js?v=3.0.0";
import { JOBS, getJobById, getJobsForVenue } from "./jobContent.js?v=3.0.0";

export function createInitialJobsState() {
  return {
    currentJobId: null,
    jobXpById: {},
    totalShiftsWorked: 0,
    firedFromIds: [],
    lastWorkedDay: null,
    currentJobStartedDay: null,
    missedWorkDays: 0,
    lastMessage: null,
  };
}

export function normalizeJobsState(jobs = {}) {
  const base = createInitialJobsState();
  const xp = jobs.jobXpById && typeof jobs.jobXpById === "object" ? jobs.jobXpById : {};
  const cleanXp = {};
  for (const job of JOBS) cleanXp[job.id] = Math.max(0, Math.round(Number(xp[job.id] ?? 0) || 0));
  const currentJobId = getJobById(jobs.currentJobId)?.id ?? null;
  return {
    ...base,
    ...jobs,
    currentJobId,
    jobXpById: cleanXp,
    totalShiftsWorked: Math.max(0, Math.round(Number(jobs.totalShiftsWorked ?? 0) || 0)),
    firedFromIds: Array.isArray(jobs.firedFromIds) ? [...new Set(jobs.firedFromIds.map(String).filter((id) => getJobById(id)))] : [],
    lastWorkedDay: Number.isFinite(Number(jobs.lastWorkedDay)) ? Math.max(1, Math.round(Number(jobs.lastWorkedDay))) : null,
    currentJobStartedDay: Number.isFinite(Number(jobs.currentJobStartedDay)) ? Math.max(1, Math.round(Number(jobs.currentJobStartedDay))) : null,
    missedWorkDays: Math.max(0, Math.round(Number(jobs.missedWorkDays ?? 0) || 0)),
    lastMessage: typeof jobs.lastMessage === "string" ? jobs.lastMessage : null,
  };
}

export function getJobStage(job, xp = 0) {
  const stages = Array.isArray(job?.stages) && job.stages.length ? job.stages : [{ id: "base", title: job?.title ?? "Работа", minXp: 0, wage: job?.baseWage ?? 0 }];
  return stages
    .slice()
    .sort((a, b) => Number(a.minXp ?? 0) - Number(b.minXp ?? 0))
    .reduce((active, stage) => Number(xp ?? 0) >= Number(stage.minXp ?? 0) ? stage : active, stages[0]);
}

export function getNextJobStage(job, xp = 0) {
  const stages = Array.isArray(job?.stages) ? job.stages.slice().sort((a, b) => Number(a.minXp ?? 0) - Number(b.minXp ?? 0)) : [];
  return stages.find((stage) => Number(stage.minXp ?? 0) > Number(xp ?? 0)) ?? null;
}

export function getCurrentJobView(career = {}, player = {}) {
  const jobsState = normalizeJobsState(career.jobs);
  const job = getJobById(jobsState.currentJobId);
  if (!job) return null;
  const xp = jobsState.jobXpById[job.id] ?? 0;
  const stage = getJobStage(job, xp);
  const nextStage = getNextJobStage(job, xp);
  return buildJobView(job, career, player, { current: true, xp, stage, nextStage });
}

export function getJobRowsForVenue({ venueId = null, jobIds = [], career = {}, player = {} } = {}) {
  const jobsState = normalizeJobsState(career.jobs);
  const life = normalizeLifeState(career.life);
  const currentJobId = jobsState.currentJobId;
  return getJobsForVenue(venueId, jobIds).map((job) => {
    const xp = jobsState.jobXpById[job.id] ?? 0;
    const current = currentJobId === job.id;
    const employedElsewhere = Boolean(currentJobId && !current);
    return buildJobView(job, career, player, {
      current,
      employedElsewhere,
      xp,
      stage: getJobStage(job, xp),
      nextStage: getNextJobStage(job, xp),
      actionsLeft: Math.max(0, Number(life.actionsPerDay ?? 6) - Number(life.actionsUsed ?? life.actionsToday ?? 0)),
    });
  });
}

export function applyJobAction({ actionId = "", career = {}, player = {} } = {}) {
  const [type, jobId = null] = String(actionId).split(":");
  const job = getJobById(jobId);
  if (!job) return fail(career, player, "Работа не найдена.");

  const jobsState = normalizeJobsState(career.jobs);
  const life = normalizeLifeState(career.life);
  const nextPlayer = { ...player, bankroll: money(player.bankroll), xp: money(player.xp) };
  const xp = jobsState.jobXpById[job.id] ?? 0;
  const stage = getJobStage(job, xp);

  if (type === "takeJob") {
    if (jobsState.currentJobId === job.id) return fail(career, player, "Ты уже работаешь здесь.");
    if (jobsState.currentJobId) return fail(career, player, "Сначала уволься с текущей работы.");
    if (!meetsRequirements(job, player)) return fail(career, player, "Не хватает репутации для этой вакансии.");
    const time = spendLifeActionCost({ career: { ...career, jobs: jobsState }, player: nextPlayer, cost: 1, message: `Устроился: ${job.title} · ${job.companyName}. -1 action.` });
    if (!time.ok) return time;
    return {
      ...time,
      career: {
        ...time.career,
        jobs: normalizeJobsState({
          ...jobsState,
          currentJobId: job.id,
          currentJobStartedDay: normalizeLifeState(career.life).day,
          missedWorkDays: 0,
          lastMessage: `Текущая работа: ${job.title}.`,
        }),
      },
      message: `Устроился: ${job.title} · ${job.companyName}. -1 action.`,
    };
  }

  if (type === "quitJob") {
    if (jobsState.currentJobId !== job.id) return fail(career, player, "Это не текущая работа.");
    return {
      ok: true,
      career: {
        ...career,
        jobs: normalizeJobsState({ ...jobsState, currentJobId: null, currentJobStartedDay: null, missedWorkDays: 0, lastMessage: `Уволился: ${job.title}.` }),
      },
      player: nextPlayer,
      message: `Уволился: ${job.title}.`,
      nextScreen: null,
    };
  }

  if (type === "workJob") {
    if (jobsState.currentJobId !== job.id) return fail(career, player, "Сначала устройся на эту работу.");
    if (life.needs.energy < Number(job.minEnergy ?? 0)) return fail(career, player, "Слишком мало энергии для смены.");
    const effect = adjustEffectForStress(job.effect, life.needs.stress);
    nextPlayer.bankroll += Number(stage.wage ?? job.baseWage ?? 0);
    const nextLife = {
      ...life,
      needs: applyNeedEffect(life.needs, effect),
    };
    const updatedCareer = {
      ...career,
      life: nextLife,
      jobs: normalizeJobsState({
        ...jobsState,
        jobXpById: { ...jobsState.jobXpById, [job.id]: xp + 1 },
        totalShiftsWorked: jobsState.totalShiftsWorked + 1,
        lastWorkedDay: life.day,
        currentJobStartedDay: jobsState.currentJobStartedDay ?? life.day,
        missedWorkDays: 0,
        lastMessage: `Смена: ${stage.title}.`,
      }),
    };
    const time = spendLifeActionCost({
      career: updatedCareer,
      player: nextPlayer,
      cost: job.actionCost,
      message: `Смена: ${stage.title}. +$${Number(stage.wage ?? job.baseWage ?? 0)}. ${formatEffect(effect)}. -${job.actionCost} action.`,
    });
    if (!time.ok) return time;
    return {
      ...time,
      career: { ...time.career, jobs: updatedCareer.jobs },
      message: time.message,
    };
  }

  return fail(career, player, "Действие недоступно.");
}

function buildJobView(job, career = {}, player = {}, extra = {}) {
  const life = normalizeLifeState(career.life);
  const jobsState = normalizeJobsState(career.jobs);
  const xp = extra.xp ?? jobsState.jobXpById[job.id] ?? 0;
  const stage = extra.stage ?? getJobStage(job, xp);
  const nextStage = extra.nextStage ?? getNextJobStage(job, xp);
  const actionsLeft = extra.actionsLeft ?? Math.max(0, Number(life.actionsPerDay ?? 6) - Number(life.actionsUsed ?? life.actionsToday ?? 0));
  const current = Boolean(extra.current ?? jobsState.currentJobId === job.id);
  const employedElsewhere = Boolean(extra.employedElsewhere ?? (jobsState.currentJobId && jobsState.currentJobId !== job.id));
  const reqOk = meetsRequirements(job, player);
  return {
    kind: "employment",
    job,
    stage,
    nextStage,
    current,
    employedElsewhere,
    xp,
    canTake: !current && !employedElsewhere && reqOk && actionsLeft >= 1,
    canWork: current && actionsLeft >= Number(job.actionCost ?? 0) && life.needs.energy >= Number(job.minEnergy ?? 0),
    canQuit: current,
    blockedReason: !reqOk ? "Не хватает репутации" : employedElsewhere ? "Уже есть работа" : actionsLeft < 1 ? "Нет действий" : null,
  };
}

function meetsRequirements(job, player = {}) {
  return Number(player.reputation ?? 0) >= Number(job.minReputation ?? 0);
}

function adjustEffectForStress(effect = {}, stress = 0) {
  return Number(stress) >= 85 ? { ...effect, stress: Number(effect.stress ?? 0) + 5 } : effect;
}

function applyNeedEffect(needs, effect = {}) {
  return {
    hunger: clamp(Number(needs.hunger ?? 0) + Number(effect.hunger ?? 0), 0, 100),
    thirst: clamp(Number(needs.thirst ?? 0) + Number(effect.thirst ?? 0), 0, 100),
    energy: clamp(Number(needs.energy ?? 0) + Number(effect.energy ?? 0), 0, 100),
    stress: clamp(Number(needs.stress ?? 0) + Number(effect.stress ?? 0), 0, 100),
  };
}

function formatEffect(effect = {}) {
  const labels = { hunger: "Hunger", thirst: "Thirst", energy: "Energy", stress: "Stress" };
  return Object.entries(effect)
    .filter(([, value]) => Number(value) !== 0)
    .map(([key, value]) => `${labels[key] ?? key} ${Number(value) > 0 ? "+" : ""}${Number(value)}`)
    .join(" · ") || "—";
}

function fail(career, player, message) {
  return { ok: false, career, player, message, nextScreen: null };
}

function money(value) {
  return Math.max(0, Math.round(Number(value) || 0));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number.isFinite(Number(value)) ? Number(value) : min));
}
