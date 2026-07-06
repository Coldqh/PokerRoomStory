import {
  LIFE_ASSETS,
  LIFE_CAFE_ORDERS,
  LIFE_HOUSING,
  LIFE_ITEMS,
  LIFE_JOBS,
  LIFE_LIMITS,
  LIFE_VEHICLES,
  getLifeAsset,
  getLifeCafeOrder,
  getLifeHousing,
  getLifeItem,
  getLifeJob,
  getLifeVehicle,
} from "./lifeContent.js?v=2.9.0";

const MAX_NEED = LIFE_LIMITS.maxNeed;
const MAX_FOCUS = LIFE_LIMITS.maxFocus;
const ACTIONS_PER_DAY = LIFE_LIMITS.actionsPerDay;
const DEFAULT_RENT_INTERVAL_DAYS = LIFE_LIMITS.rentIntervalDays;

export function createInitialLifeState() {
  const housing = getLifeHousing("HOUSING_CHEAP_ROOM");
  return {
    day: 1,
    actionsToday: 0,
    actionsUsed: 0,
    actionsPerDay: ACTIONS_PER_DAY,
    sleptToday: false,
    sleepDebt: 0,
    needs: {
      hunger: 70,
      thirst: 70,
      energy: 80,
      stress: 20,
    },
    focusTokens: 0,
    inventory: [],
    housingId: housing.id,
    ownedHousingIds: [],
    vehicleId: null,
    assetIds: [],
    rentDueDay: 7,
    rentAmount: housing.rent,
    debt: 0,
    lastMessage: null,
  };
}

export function normalizeLifeState(life = {}) {
  const base = createInitialLifeState();
  const needs = life.needs && typeof life.needs === "object"
    ? life.needs
    : {
        hunger: 70,
        thirst: 70,
        energy: life.energy ?? base.needs.energy,
        stress: life.stress ?? base.needs.stress,
      };
  const housing = getLifeHousing(life.housingId ?? base.housingId);
  const ownedHousingIds = normalizeHousingIds(life.ownedHousingIds);
  const ownsCurrentHousing = ownedHousingIds.includes(housing.id);
  const rentAmount = ownsCurrentHousing ? 0 : clampInt(life.rentAmount ?? housing.rent, housing.rent, 0, 999999);
  const rawActions = Number.isFinite(Number(life.actionsUsed)) ? life.actionsUsed : life.actionsToday;
  const actionsUsed = clampNumber(rawActions, base.actionsUsed, 0, ACTIONS_PER_DAY);

  return {
    ...base,
    ...life,
    day: clampInt(life.day, base.day, 1, 9999),
    actionsToday: actionsUsed,
    actionsUsed,
    actionsPerDay: ACTIONS_PER_DAY,
    sleptToday: Boolean(life.sleptToday),
    sleepDebt: clampInt(life.sleepDebt, base.sleepDebt, 0, 999),
    needs: {
      hunger: clampInt(needs.hunger, base.needs.hunger, 0, MAX_NEED),
      thirst: clampInt(needs.thirst, base.needs.thirst, 0, MAX_NEED),
      energy: clampInt(needs.energy, base.needs.energy, 0, MAX_NEED),
      stress: clampInt(needs.stress, base.needs.stress, 0, MAX_NEED),
    },
    focusTokens: clampInt(life.focusTokens, base.focusTokens, 0, MAX_FOCUS),
    inventory: normalizeInventory(life.inventory),
    housingId: housing.id,
    ownedHousingIds,
    vehicleId: getLifeVehicle(life.vehicleId)?.id ?? null,
    assetIds: safeUniqueIds(life.assetIds),
    rentDueDay: ownsCurrentHousing ? 9999 : clampInt(life.rentDueDay, base.rentDueDay, 1, 9999),
    rentAmount,
    debt: clampInt(life.debt, base.debt, 0, 999999),
    lastMessage: typeof life.lastMessage === "string" ? life.lastMessage : null,
  };
}

export function getLifeView(career = {}, player = {}) {
  const life = normalizeLifeState(career.life);
  const currentHousing = getLifeHousing(life.housingId);
  const ownsCurrentHousing = life.ownedHousingIds.includes(currentHousing.id);
  const daysUntilRent = life.rentAmount > 0 ? Math.max(0, life.rentDueDay - life.day) : null;
  const actionsUsed = Number(life.actionsUsed ?? life.actionsToday ?? 0);
  const actionsLeft = roundOne(Math.max(0, life.actionsPerDay - actionsUsed));
  const bankroll = money(player.bankroll);
  const warnings = [];

  if (life.needs.hunger <= 20) warnings.push("Голод низкий.");
  if (life.needs.thirst <= 20) warnings.push("Жажда низкая.");
  if (life.needs.energy < 25) warnings.push("Мало энергии.");
  if (life.needs.stress >= 80) warnings.push("Стресс высокий.");
  if (life.rentAmount > 0 && bankroll < life.rentAmount && daysUntilRent <= 1) warnings.push("Аренда близко, денег может не хватить.");
  if (!life.sleptToday && actionsUsed >= life.actionsPerDay * 0.7) warnings.push("Сон не отмечен. При смене дня будет штраф.");
  if (life.sleepDebt > 0) warnings.push(`Недосып: ${life.sleepDebt}. Energy ниже, stress выше.`);

  return {
    life,
    currentHousing,
    ownsCurrentHousing,
    items: LIFE_ITEMS.map((item) => ({ ...item, ownedQty: getInventoryQty(life, item.id), canBuy: bankroll >= item.price })),
    inventory: life.inventory.map((entry) => ({ ...entry, item: getLifeItem(entry.itemId) })).filter((entry) => entry.item),
    cafeOrders: LIFE_CAFE_ORDERS.map((order) => ({ ...order, canUse: bankroll >= order.price && actionsLeft >= order.actionCost })),
    jobs: LIFE_JOBS.map((job) => ({ ...job, canWork: actionsLeft >= job.actionCost && life.needs.energy > 0 })),
    housing: LIFE_HOUSING.map((housing) => {
      const owned = life.ownedHousingIds.includes(housing.id);
      const current = housing.id === life.housingId;
      return {
        ...housing,
        current,
        owned,
        canRent: bankroll >= housing.rent && !current && !owned,
        canMove: owned && !current,
        canBuy: Boolean(housing.purchasePrice && bankroll >= housing.purchasePrice && !owned),
        rentLabel: owned ? "owned" : `$${housing.rent} / 7 дней`,
      };
    }),
    assets: LIFE_ASSETS.map((asset) => ({ ...asset, owned: life.assetIds.includes(asset.id), canBuy: bankroll >= asset.price && !life.assetIds.includes(asset.id) })),
    vehicles: LIFE_VEHICLES.map((vehicle) => ({ ...vehicle, owned: life.vehicleId === vehicle.id, canBuy: bankroll >= vehicle.price && life.vehicleId !== vehicle.id })),
    actionsLeft,
    actionsUsed: roundOne(actionsUsed),
    daysUntilRent,
    warnings,
    canRest: actionsLeft >= 1,
    canPlayClub: life.needs.energy >= 5,
  };
}

export function applyLifeAction({ actionId, career = {}, player = {} } = {}) {
  const life = normalizeLifeState(career.life);
  const nextPlayer = { ...player, bankroll: money(player.bankroll), xp: money(player.xp) };
  const parsed = parseLifeAction(actionId);

  if (!parsed.type) return fail(career, player, "Действие не найдено.");

  let nextLife = {
    ...life,
    needs: { ...life.needs },
    inventory: [...life.inventory],
    assetIds: [...life.assetIds],
    ownedHousingIds: [...life.ownedHousingIds],
  };
  let message = "";
  let nextScreen = null;
  let actionCost = 0;

  if (parsed.type === "buy") {
    const item = getLifeItem(parsed.id);
    if (!item) return failWithLife(career, player, nextLife, "Товар не найден.");
    if (nextPlayer.bankroll < item.price) return failWithLife(career, player, nextLife, "Недостаточно денег.");
    nextPlayer.bankroll -= item.price;
    nextLife.inventory = addInventoryItem(nextLife.inventory, item.id, 1);
    message = `Куплено: ${item.name}. -$${item.price}.`;
  }

  if (parsed.type === "use") {
    const item = getLifeItem(parsed.id);
    if (!item) return failWithLife(career, player, nextLife, "Предмет не найден.");
    if (getInventoryQty(nextLife, item.id) <= 0) return failWithLife(career, player, nextLife, "Предмета нет в инвентаре.");
    nextLife.inventory = removeInventoryItem(nextLife.inventory, item.id, 1);
    nextLife.needs = applyNeedEffect(nextLife.needs, item.effect);
    message = `Использовано: ${item.name}. ${formatEffect(item.effect)}.`;
  }

  if (parsed.type === "cafe") {
    const order = getLifeCafeOrder(parsed.id);
    if (!order) return failWithLife(career, player, nextLife, "Заказ не найден.");
    if (!hasActions(nextLife, order.actionCost)) return failWithLife(career, player, nextLife, "Недостаточно действий сегодня.");
    if (nextPlayer.bankroll < order.price) return failWithLife(career, player, nextLife, "Недостаточно денег.");
    nextPlayer.bankroll -= order.price;
    nextLife.needs = applyNeedEffect(nextLife.needs, order.effect);
    actionCost = order.actionCost;
    message = `Кафе: ${order.name}. -$${order.price}. ${formatEffect(order.effect)}.`;
  }

  if (parsed.type === "job") {
    const job = getLifeJob(parsed.id);
    if (!job) return failWithLife(career, player, nextLife, "Работа не найдена.");
    if (!hasActions(nextLife, job.actionCost)) return failWithLife(career, player, nextLife, "Недостаточно действий сегодня.");
    if (nextLife.needs.energy <= 0) return failWithLife(career, player, nextLife, "Нет энергии.");
    nextPlayer.bankroll += job.pay;
    nextLife.needs = applyNeedEffect(nextLife.needs, job.effect);
    actionCost = job.actionCost;
    message = `Смена: ${job.name}. +$${job.pay}. ${formatEffect(job.effect)}.`;
  }

  if (parsed.type === "rest") {
    const housing = getLifeHousing(nextLife.housingId);
    if (!hasActions(nextLife, 1)) return failWithLife(career, player, nextLife, "Недостаточно действий сегодня.");
    nextLife.needs = applyNeedEffect(nextLife.needs, housing.restEffect);
    nextLife.sleptToday = true;
    nextLife.sleepDebt = Math.max(0, Number(nextLife.sleepDebt ?? 0) - 1);
    actionCost = 1;
    message = `Сон / отдых: ${housing.name}. ${formatEffect(housing.restEffect)}.`;
  }

  if (parsed.type === "moveHousing") {
    const housing = getLifeHousing(parsed.id);
    if (!housing) return failWithLife(career, player, nextLife, "Жильё не найдено.");
    if (!nextLife.ownedHousingIds.includes(housing.id)) return failWithLife(career, player, nextLife, "Жильё не куплено.");
    if (nextLife.housingId === housing.id) return failWithLife(career, player, nextLife, "Это текущее жильё.");
    if (!hasActions(nextLife, 1)) return failWithLife(career, player, nextLife, "Недостаточно действий сегодня.");
    actionCost = 1;
    nextLife.housingId = housing.id;
    nextLife.rentAmount = 0;
    nextLife.rentDueDay = 9999;
    message = `Переезд: ${housing.name}. ${housing.district}. ${housing.rooms}к · ${housing.sqm} м².`;
  }

  if (parsed.type === "rentHousing") {
    const housing = getLifeHousing(parsed.id);
    if (!housing) return failWithLife(career, player, nextLife, "Жильё не найдено.");
    if (nextLife.housingId === housing.id) return failWithLife(career, player, nextLife, "Это жильё уже выбрано.");
    if (!hasActions(nextLife, 1)) return failWithLife(career, player, nextLife, "Недостаточно действий сегодня.");
    actionCost = 1;
    if (nextLife.ownedHousingIds.includes(housing.id)) {
      nextLife.housingId = housing.id;
      nextLife.rentAmount = 0;
      nextLife.rentDueDay = 9999;
      message = `Переезд: ${housing.name}. ${housing.district}. ${housing.rooms}к · ${housing.sqm} м².`;
    } else {
      if (nextPlayer.bankroll < housing.rent) return failWithLife(career, player, nextLife, "Недостаточно денег.");
      nextPlayer.bankroll -= housing.rent;
      nextLife.housingId = housing.id;
      nextLife.rentAmount = housing.rent;
      nextLife.rentDueDay = nextLife.day + (housing.intervalDays ?? DEFAULT_RENT_INTERVAL_DAYS);
      message = `Аренда: ${housing.name}. ${housing.district}. -$${housing.rent}. ${housing.rooms}к · ${housing.sqm} м².`;
    }
  }

  if (parsed.type === "buyHousing") {
    const housing = getLifeHousing(parsed.id);
    if (!housing?.purchasePrice) return failWithLife(career, player, nextLife, "Покупка недоступна.");
    if (nextLife.ownedHousingIds.includes(housing.id)) return failWithLife(career, player, nextLife, "Жильё уже куплено.");
    if (!hasActions(nextLife, 1)) return failWithLife(career, player, nextLife, "Недостаточно действий сегодня.");
    if (nextPlayer.bankroll < housing.purchasePrice) return failWithLife(career, player, nextLife, "Недостаточно денег.");
    actionCost = 1;
    nextPlayer.bankroll -= housing.purchasePrice;
    nextLife.ownedHousingIds = normalizeHousingIds([...nextLife.ownedHousingIds, housing.id]);
    nextLife.housingId = housing.id;
    nextLife.rentAmount = 0;
    nextLife.rentDueDay = 9999;
    message = `Куплено жильё: ${housing.name}. ${housing.district}. -$${housing.purchasePrice}. ${housing.rooms}к · ${housing.sqm} м².`;
  }

  if (parsed.type === "buyAsset") {
    const asset = getLifeAsset(parsed.id);
    if (!asset) return failWithLife(career, player, nextLife, "Имущество не найдено.");
    if (nextLife.assetIds.includes(asset.id)) return failWithLife(career, player, nextLife, "Уже куплено.");
    if (!hasActions(nextLife, 1)) return failWithLife(career, player, nextLife, "Недостаточно действий сегодня.");
    if (nextPlayer.bankroll < asset.price) return failWithLife(career, player, nextLife, "Недостаточно денег.");
    actionCost = 1;
    nextPlayer.bankroll -= asset.price;
    nextLife.assetIds = safeUniqueIds([...nextLife.assetIds, asset.id]);
    message = `Куплено: ${asset.name}. -$${asset.price}.`;
  }

  if (parsed.type === "buyVehicle") {
    const vehicle = getLifeVehicle(parsed.id);
    if (!vehicle) return failWithLife(career, player, nextLife, "Транспорт не найден.");
    if (nextLife.vehicleId === vehicle.id) return failWithLife(career, player, nextLife, "Транспорт уже выбран.");
    if (!hasActions(nextLife, 1)) return failWithLife(career, player, nextLife, "Недостаточно действий сегодня.");
    if (nextPlayer.bankroll < vehicle.price) return failWithLife(career, player, nextLife, "Недостаточно денег.");
    actionCost = 1;
    nextPlayer.bankroll -= vehicle.price;
    nextLife.vehicleId = vehicle.id;
    message = `Куплено: ${vehicle.name}. -$${vehicle.price}.`;
  }

  if (parsed.type === "playClub") {
    if (nextLife.needs.energy < 5) return failWithLife(career, player, nextLife, "Мало энергии.");
    nextLife.needs = applyNeedEffect(nextLife.needs, { energy: -5, stress: 3, hunger: -2, thirst: -2 });
    nextScreen = "locations";
    message = "Переход: карта клубов.";
  }

  if (actionCost > 0) {
    const dayResult = spendActionsAndAdvance(nextLife, nextPlayer, actionCost, { slept: parsed.type === "rest" });
    nextLife = dayResult.life;
    Object.assign(nextPlayer, dayResult.player);
    message = [message, ...dayResult.messages].filter(Boolean).join(" ");
  }

  nextLife.lastMessage = message;
  return {
    career: { ...career, life: normalizeLifeState(nextLife) },
    player: nextPlayer,
    ok: true,
    message,
    nextScreen,
  };
}

export function getLifeActionsLeft(career = {}) {
  const life = normalizeLifeState(career.life);
  return roundOne(Math.max(0, life.actionsPerDay - Number(life.actionsToday ?? life.actionsUsed ?? 0)));
}

export function hasLifeActions(career = {}, cost = 0) {
  return hasActions(normalizeLifeState(career.life), cost);
}

export function spendLifeActionCost({ career = {}, player = {}, cost = 0, slept = false, message = null } = {}) {
  const life = normalizeLifeState(career.life);
  const nextPlayer = { ...player, bankroll: money(player.bankroll), xp: money(player.xp) };
  const cleanCost = roundOne(Math.max(0, Number(cost) || 0));
  if (cleanCost > 0 && !hasActions(life, cleanCost)) {
    return {
      ok: false,
      career: { ...career, life },
      player: nextPlayer,
      messages: ["Недостаточно действий сегодня."],
      message: "Недостаточно действий сегодня.",
    };
  }
  const result = spendActionsAndAdvance(life, nextPlayer, cleanCost, { slept });
  const messages = [message, ...result.messages].filter(Boolean);
  const nextLife = {
    ...result.life,
    lastMessage: messages.join(" ") || result.life.lastMessage,
  };

  return {
    ok: true,
    career: { ...career, life: normalizeLifeState(nextLife) },
    player: result.player,
    messages,
    message: messages.join(" "),
  };
}

function spendActionsAndAdvance(life, player, cost, options = {}) {
  const messages = [];
  let nextLife = { ...normalizeLifeState(life), needs: { ...normalizeLifeState(life).needs } };
  const nextPlayer = { ...player, bankroll: money(player.bankroll), xp: money(player.xp) };
  const cleanCost = roundOne(Math.max(0, Number(cost) || 0));

  if (options.slept) {
    nextLife.sleptToday = true;
    nextLife.sleepDebt = Math.max(0, Number(nextLife.sleepDebt ?? 0) - 1);
  }

  nextLife.actionsToday = roundOne(Number(nextLife.actionsToday ?? nextLife.actionsUsed ?? 0) + cleanCost);
  nextLife.actionsUsed = nextLife.actionsToday;

  while (nextLife.actionsToday >= nextLife.actionsPerDay) {
    const sleptPreviousDay = Boolean(nextLife.sleptToday);
    nextLife.actionsToday = roundOne(nextLife.actionsToday - nextLife.actionsPerDay);
    nextLife.actionsUsed = nextLife.actionsToday;
    nextLife.day += 1;

    if (sleptPreviousDay) {
      nextLife.needs = applyNeedEffect(nextLife.needs, { hunger: -20, thirst: -25, energy: 20, stress: -2 });
      nextLife.sleepDebt = Math.max(0, Number(nextLife.sleepDebt ?? 0) - 1);
    } else {
      nextLife.needs = applyNeedEffect(nextLife.needs, { hunger: -20, thirst: -25, energy: -25, stress: 15 });
      nextLife.sleepDebt = clampInt(Number(nextLife.sleepDebt ?? 0) + 1, 0, 0, 999);
      messages.push("Сон пропущен. Energy -25 · Stress +15.");
    }

    messages.push(`День ${nextLife.day}.`);
    nextLife.sleptToday = false;

    if (nextLife.needs.hunger <= 0) nextLife.needs.stress = clamp(nextLife.needs.stress + 15, 0, MAX_NEED);
    if (nextLife.needs.thirst <= 0) nextLife.needs.energy = clamp(nextLife.needs.energy - 20, 0, MAX_NEED);

    const housing = getLifeHousing(nextLife.housingId);
    const ownsCurrentHousing = nextLife.ownedHousingIds.includes(housing.id);
    if (!ownsCurrentHousing && nextLife.rentAmount > 0 && nextLife.day >= nextLife.rentDueDay) {
      const rent = nextLife.rentAmount || housing.rent;
      if (money(nextPlayer.bankroll) >= rent) {
        nextPlayer.bankroll = money(nextPlayer.bankroll) - rent;
        messages.push(`Аренда: -$${rent}.`);
      } else {
        nextLife.debt += rent;
        nextLife.needs.stress = clamp(nextLife.needs.stress + 20, 0, MAX_NEED);
        messages.push(`Аренда не оплачена. Долг +$${rent}.`);
      }
      nextLife.rentDueDay += housing.intervalDays ?? DEFAULT_RENT_INTERVAL_DAYS;
    }
  }

  return { life: nextLife, player: nextPlayer, messages };
}

function parseLifeAction(actionId = "") {
  const [type, id = null] = String(actionId).split(":");
  return { type, id };
}

function hasActions(life, cost) {
  const safe = normalizeLifeState(life);
  return Number(safe.actionsToday ?? safe.actionsUsed ?? 0) + Number(cost ?? 0) <= safe.actionsPerDay + 0.0001;
}

function applyNeedEffect(needs, effect = {}) {
  return {
    hunger: clamp(Number(needs.hunger ?? 0) + Number(effect.hunger ?? 0), 0, MAX_NEED),
    thirst: clamp(Number(needs.thirst ?? 0) + Number(effect.thirst ?? 0), 0, MAX_NEED),
    energy: clamp(Number(needs.energy ?? 0) + Number(effect.energy ?? 0), 0, MAX_NEED),
    stress: clamp(Number(needs.stress ?? 0) + Number(effect.stress ?? 0), 0, MAX_NEED),
  };
}

function formatEffect(effect = {}) {
  const labels = {
    hunger: "Hunger",
    thirst: "Thirst",
    energy: "Energy",
    stress: "Stress",
  };
  return Object.entries(effect)
    .filter(([, value]) => Number(value) !== 0)
    .map(([key, value]) => `${labels[key] ?? key} ${Number(value) > 0 ? "+" : ""}${Number(value)}`)
    .join(" · ");
}

function addInventoryItem(inventory, itemId, qty) {
  const next = normalizeInventory(inventory);
  const index = next.findIndex((entry) => entry.itemId === itemId);
  if (index >= 0) next[index] = { ...next[index], qty: next[index].qty + qty };
  else next.push({ itemId, qty });
  return next.filter((entry) => entry.qty > 0);
}

function removeInventoryItem(inventory, itemId, qty) {
  return normalizeInventory(inventory)
    .map((entry) => entry.itemId === itemId ? { ...entry, qty: entry.qty - qty } : entry)
    .filter((entry) => entry.qty > 0);
}

function getInventoryQty(life, itemId) {
  return normalizeInventory(life.inventory).find((entry) => entry.itemId === itemId)?.qty ?? 0;
}

function normalizeInventory(inventory = []) {
  if (!Array.isArray(inventory)) return [];
  return inventory
    .map((entry) => ({ itemId: String(entry.itemId ?? ""), qty: clampInt(entry.qty, 0, 0, 999) }))
    .filter((entry) => entry.itemId && entry.qty > 0);
}

function normalizeHousingIds(value = []) {
  if (!Array.isArray(value)) return [];
  return safeUniqueIds(value.map((entry) => getLifeHousing(entry)?.id).filter(Boolean));
}

function safeUniqueIds(value = []) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((entry) => String(entry)).filter(Boolean))];
}

function fail(career, player, message) {
  return { career, player, ok: false, message, nextScreen: null };
}

function failWithLife(career, player, life, message) {
  return { career: { ...career, life: normalizeLifeState(life) }, player, ok: false, message, nextScreen: null };
}

function money(value) {
  return Math.max(0, Math.round(Number(value) || 0));
}

function roundOne(value) {
  return Math.round((Number(value) || 0) * 10) / 10;
}

function clampNumber(value, fallback, min, max) {
  return roundOne(clamp(Number.isFinite(Number(value)) ? Number(value) : fallback, min, max));
}

function clampInt(value, fallback, min, max) {
  return Math.round(clamp(Number.isFinite(Number(value)) ? Number(value) : fallback, min, max));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number.isFinite(Number(value)) ? Number(value) : min));
}
