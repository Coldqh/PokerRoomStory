import { BUSINESS_LIMITS, BUSINESS_TEMPLATES as BASE_BUSINESS_TEMPLATES } from "./businessContent.js?v=3.7.0";
import { INTERNATIONAL_BUSINESS_TEMPLATES } from "./internationalBusinessContent.js?v=3.7.0";

const BUSINESS_TEMPLATES = [...BASE_BUSINESS_TEMPLATES, ...INTERNATIONAL_BUSINESS_TEMPLATES];
const DEFAULT_CITY_ID = "CITY_RU_NORTH_DISTRICT";
const MAX_LEVEL = BUSINESS_LIMITS.maxLevel;

function getBusinessTemplate(id) {
  return BUSINESS_TEMPLATES.find((template) => template.id === id) ?? null;
}

function getBusinessTemplates(ids = []) {
  const set = new Set(ids);
  return BUSINESS_TEMPLATES.filter((template) => set.has(template.id));
}

export function createInitialBusinessState() {
  return {
    ownedIds: [],
    ownedIdsByCityId: {},
    byId: {},
  };
}

export function normalizeBusinessState(value = {}) {
  const legacyOwnedIds = safeUniqueIds(value.ownedIds);
  const ownedIdsByCityId = normalizeOwnedIdsByCityMap(value.ownedIdsByCityId);
  const byId = {};

  for (const id of legacyOwnedIds) {
    const template = getBusinessTemplate(id);
    if (!template) continue;
    const cityId = template.cityId ?? DEFAULT_CITY_ID;
    ownedIdsByCityId[cityId] = safeUniqueIds([...(ownedIdsByCityId[cityId] ?? []), id]);
  }

  const ownedIds = [...new Set(Object.values(ownedIdsByCityId).flat())];
  for (const id of ownedIds) {
    const template = getBusinessTemplate(id);
    if (!template) continue;
    const raw = value.byId?.[id] ?? {};
    byId[id] = normalizeOwnedBusiness(template, raw);
  }

  const cleanOwnedIdsByCityId = {};
  for (const [cityId, ids] of Object.entries(ownedIdsByCityId)) {
    const cleanIds = safeUniqueIds(ids).filter((id) => byId[id]);
    if (cleanIds.length) cleanOwnedIdsByCityId[cityId] = cleanIds;
  }

  return { ownedIds: Object.keys(byId), ownedIdsByCityId: cleanOwnedIdsByCityId, byId };
}

export function getBusinessView(career = {}, player = {}, cityId = null) {
  const state = normalizeBusinessState(career.businesses);
  const day = getCareerDay(career);
  const bankroll = money(player.bankroll);
  const ownedAll = state.ownedIds.map((id) => buildBusinessRow(getBusinessTemplate(id), state, day, bankroll)).filter(Boolean);
  const all = BUSINESS_TEMPLATES.map((template) => buildBusinessRow(template, state, day, bankroll)).filter(Boolean);
  const resolvedCityId = cityId ? String(cityId) : null;
  const ownedCurrentCity = resolvedCityId ? ownedAll.filter((row) => row.template.cityId === resolvedCityId) : ownedAll;
  const ownedOtherCities = resolvedCityId ? ownedAll.filter((row) => row.template.cityId !== resolvedCityId) : [];
  return {
    state,
    owned: ownedCurrentCity,
    ownedAll,
    ownedCurrentCity,
    ownedOtherCities,
    all: resolvedCityId ? all.filter((row) => row.template.cityId === resolvedCityId) : all,
  };
}

export function getBusinessBrokerRows(businessIds = [], career = {}, player = {}, cityId = null) {
  const state = normalizeBusinessState(career.businesses);
  const day = getCareerDay(career);
  const bankroll = money(player.bankroll);
  return getBusinessTemplates(businessIds)
    .filter((template) => !cityId || template.cityId === cityId || !template.cityId)
    .map((template) => buildBusinessRow(template, state, day, bankroll))
    .filter(Boolean);
}

export function applyBusinessAction({ actionId, career = {}, player = {}, cityId = null } = {}) {
  const [type, id] = String(actionId ?? "").split(":");
  const template = getBusinessTemplate(id);
  if (!template) return fail(career, player, "Бизнес не найден.");

  const resolvedCityId = String(cityId || template.cityId || DEFAULT_CITY_ID);
  if (template.cityId && template.cityId !== resolvedCityId) return fail(career, player, "Этот бизнес находится в другом городе.");

  const state = normalizeBusinessState(career.businesses);
  const nextPlayer = { ...player, bankroll: money(player.bankroll) };
  const day = getCareerDay(career);
  const owned = state.byId[id] ?? null;

  if (type === "buyBusiness") {
    if (owned) return fail(career, player, "Бизнес уже куплен.");
    if (nextPlayer.bankroll < template.buyPrice) return fail(career, player, "Недостаточно денег.");
    nextPlayer.bankroll -= template.buyPrice;
    const nextState = normalizeBusinessState({
      ownedIds: [...state.ownedIds, id],
      ownedIdsByCityId: {
        ...state.ownedIdsByCityId,
        [resolvedCityId]: [...(state.ownedIdsByCityId[resolvedCityId] ?? []), id],
      },
      byId: {
        ...state.byId,
        [id]: createOwnedBusiness(template, day),
      },
    });
    return ok(career, nextPlayer, nextState, `Куплен бизнес: ${template.name}. -$${template.buyPrice}.`);
  }

  if (!owned) return fail(career, player, "Бизнес не куплен.");

  if (type === "collectBusiness") {
    const days = getCollectableDays(owned, day);
    if (days <= 0) return fail(career, player, "Прибыль сегодня уже собрана.");
    const profit = getBusinessDailyProfit(template, owned) * days;
    nextPlayer.bankroll += profit;
    const nextOwned = {
      ...owned,
      lastCollectedDay: day,
      totalProfit: money(owned.totalProfit + profit),
    };
    return ok(career, nextPlayer, mergeBusiness(state, id, nextOwned), `Прибыль: ${template.name}. +$${profit}. Дней: ${days}.`);
  }

  if (type === "upgradeBusiness") {
    if (owned.level >= MAX_LEVEL) return fail(career, player, "Максимальный уровень.");
    const cost = getBusinessUpgradeCost(template, owned);
    if (nextPlayer.bankroll < cost) return fail(career, player, "Недостаточно денег.");
    nextPlayer.bankroll -= cost;
    const nextOwned = {
      ...owned,
      level: Math.min(MAX_LEVEL, owned.level + 1),
      condition: Math.min(100, owned.condition + BUSINESS_LIMITS.upgradeConditionGain),
    };
    return ok(career, nextPlayer, mergeBusiness(state, id, nextOwned), `Апгрейд: ${template.name}. -$${cost}. Lv.${nextOwned.level}.`);
  }

  return fail(career, player, "Действие недоступно.");
}

function buildBusinessRow(template, state, day, bankroll) {
  if (!template) return null;
  const owned = state.byId[template.id] ?? null;
  const dailyProfit = getBusinessDailyProfit(template, owned);
  const collectableDays = owned ? getCollectableDays(owned, day) : 0;
  const collectableProfit = owned ? dailyProfit * collectableDays : 0;
  const upgradeCost = owned ? getBusinessUpgradeCost(template, owned) : null;
  return {
    template,
    owned,
    dailyProfit,
    collectableDays,
    collectableProfit,
    upgradeCost,
    canBuy: !owned && bankroll >= template.buyPrice,
    canCollect: Boolean(owned && collectableDays > 0),
    canUpgrade: Boolean(owned && owned.level < MAX_LEVEL && bankroll >= upgradeCost),
  };
}

function createOwnedBusiness(template, day) {
  return {
    id: template.id,
    level: 1,
    condition: clampInt(template.condition, 50, 0, 100),
    staff: 0,
    lastCollectedDay: day,
    totalProfit: 0,
  };
}

function normalizeOwnedBusiness(template, raw = {}) {
  return {
    id: template.id,
    level: clampInt(raw.level, 1, 1, MAX_LEVEL),
    condition: clampInt(raw.condition, template.condition, 0, 100),
    staff: clampInt(raw.staff, 0, 0, template.staffSlots ?? 0),
    lastCollectedDay: clampInt(raw.lastCollectedDay, 1, 1, 9999),
    totalProfit: money(raw.totalProfit),
  };
}

export function getBusinessDailyProfit(template, owned = null) {
  const level = owned?.level ?? 1;
  const condition = owned?.condition ?? template.condition ?? 50;
  const conditionFactor = 0.75 + condition / 200;
  const levelBonus = 1 + (level - 1) * 0.16;
  const gross = Math.round(Number(template.dailyRevenue ?? 0) * conditionFactor * levelBonus);
  const expenses = Math.round(Number(template.dailyExpenses ?? 0) * (1 + (level - 1) * 0.07));
  return Math.max(0, gross - expenses);
}

function getBusinessUpgradeCost(template, owned) {
  const level = owned?.level ?? 1;
  return Math.max(250, Math.round(Number(template.buyPrice ?? 0) * (0.08 + level * 0.035)));
}

function getCollectableDays(owned, day) {
  return Math.max(0, Number(day ?? 1) - Number(owned?.lastCollectedDay ?? day));
}

function getCareerDay(career = {}) {
  return Math.max(1, Math.round(Number(career.life?.day ?? 1) || 1));
}

function mergeBusiness(state, id, owned) {
  const template = getBusinessTemplate(id);
  const cityId = template?.cityId ?? DEFAULT_CITY_ID;
  return normalizeBusinessState({
    ownedIds: state.ownedIds,
    ownedIdsByCityId: {
      ...state.ownedIdsByCityId,
      [cityId]: [...new Set([...(state.ownedIdsByCityId[cityId] ?? []), id])],
    },
    byId: { ...state.byId, [id]: owned },
  });
}

function ok(career, player, businessState, message) {
  return {
    ok: true,
    player,
    career: {
      ...career,
      businesses: businessState,
    },
    message,
    nextScreen: null,
  };
}

function fail(career, player, message) {
  return { ok: false, career, player, message, nextScreen: null };
}

function normalizeOwnedIdsByCityMap(value = {}) {
  const out = {};
  for (const [cityId, ids] of Object.entries(value && typeof value === "object" ? value : {})) {
    const cleanIds = safeUniqueIds(ids).filter((id) => getBusinessTemplate(id));
    if (cleanIds.length) out[cityId] = cleanIds;
  }
  return out;
}

function safeUniqueIds(value = []) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((entry) => String(entry)).filter(Boolean))];
}

function money(value) {
  return Math.max(0, Math.round(Number(value) || 0));
}

function clampInt(value, fallback, min, max) {
  const number = Number.isFinite(Number(value)) ? Number(value) : fallback;
  return Math.round(Math.max(min, Math.min(max, number)));
}
