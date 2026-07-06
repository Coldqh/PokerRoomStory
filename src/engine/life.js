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
} from "./lifeContent.js?v=2.7.0";

const MAX_NEED = LIFE_LIMITS.maxNeed;
const MAX_FOCUS = LIFE_LIMITS.maxFocus;
const ACTIONS_PER_DAY = LIFE_LIMITS.actionsPerDay;
const DEFAULT_RENT_INTERVAL_DAYS = LIFE_LIMITS.rentIntervalDays;

export function createInitialLifeState() {
  const housing = getLifeHousing("HOUSING_CHEAP_ROOM");
  return {
    day: 1,
    actionsToday: 0,
    actionsPerDay: ACTIONS_PER_DAY,
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

  return {
    ...base,
    ...life,
    day: clampInt(life.day, base.day, 1, 9999),
    actionsToday: clampInt(life.actionsToday, base.actionsToday, 0, ACTIONS_PER_DAY),
    actionsPerDay: ACTIONS_PER_DAY,
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
  const actionsLeft = Math.max(0, life.actionsPerDay - life.actionsToday);
  const bankroll = money(player.bankroll);
  const warnings = [];

  if (life.needs.hunger <= 20) warnings.push("Голод низкий.");
  if (life.needs.thirst <= 20) warnings.push("Жажда низкая.");
  if (life.needs.energy < 25) warnings.push("Мало энергии.");
  if (life.needs.stress >= 80) warnings.push("Стресс высокий.");
  if (life.rentAmount > 0 && bankroll < life.rentAmount && daysUntilRent <= 1) warnings.push("Аренда близко, денег может не хватить.");

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
    if (!hasActions(nextLife, order.actionCost)) return failWithLife(career, player, nextLife, "Нет действий на сегодня.");
    if (nextPlayer.bankroll < order.price) return failWithLife(career, player, nextLife, "Недостаточно денег.");
    nextPlayer.bankroll -= order.price;
    nextLife.needs = applyNeedEffect(nextLife.needs, order.effect);
    actionCost = order.actionCost;
    message = `Кафе: ${order.name}. -$${order.price}. ${formatEffect(order.effect)}.`;
  }

  if (parsed.type === "job") {
    const job = getLifeJob(parsed.id);
    if (!job) return failWithLife(career, player, nextLife, "Работа не найдена.");
    if (!hasActions(nextLife, job.actionCost)) return failWithLife(career, player, nextLife, "Нет действий на сегодня.");
    if (nextLife.needs.energy <= 0) return failWithLife(career, player, nextLife, "Нет энергии.");
    nextPlayer.bankroll += job.pay;
    nextLife.needs = applyNeedEffect(nextLife.needs, job.effect);
    actionCost = job.actionCost;
    message = `Смена: ${job.name}. +$${job.pay}. ${formatEffect(job.effect)}.`;
  }

  if (parsed.type === "rest") {
    const housing = getLifeHousing(nextLife.housingId);
    if (!hasActions(nextLife, 1)) return failWithLife(career, player, nextLife, "Нет действий на сегодня.");
    nextLife.needs = applyNeedEffect(nextLife.needs, housing.restEffect);
    actionCost = 1;
    message = `Отдых: ${housing.name}. ${formatEffect(housing.restEffect)}.`;
  }

  if (parsed.type === "moveHousing") {
    const housing = getLifeHousing(parsed.id);
    if (!housing) return failWithLife(career, player, nextLife, "Жильё не найдено.");
    if (!nextLife.ownedHousingIds.includes(housing.id)) return failWithLife(career, player, nextLife, "Жильё не куплено.");
    if (nextLife.housingId === housing.id) return failWithLife(career, player, nextLife, "Это текущее жильё.");
    nextLife.housingId = housing.id;
    nextLife.rentAmount = 0;
    nextLife.rentDueDay = 9999;
    message = `Переезд: ${housing.name}. ${housing.district}. ${housing.rooms}к · ${housing.sqm} м².`;
  }

  if (parsed.type === "rentHousing") {
    const housing = getLifeHousing(parsed.id);
    if (!housing) return failWithLife(career, player, nextLife, "Жильё не найдено.");
    if (nextLife.housingId === housing.id) return failWithLife(career, player, nextLife, "Это жильё уже выбрано.");
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
    if (nextPlayer.bankroll < housing.purchasePrice) return failWithLife(career, player, nextLife, "Недостаточно денег.");
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
    if (nextPlayer.bankroll < asset.price) return failWithLife(career, player, nextLife, "Недостаточно денег.");
    nextPlayer.bankroll -= asset.price;
    nextLife.assetIds = safeUniqueIds([...nextLife.assetIds, asset.id]);
    message = `Куплено: ${asset.name}. -$${asset.price}.`;
  }

  if (parsed.type === "buyVehicle") {
    const vehicle = getLifeVehicle(parsed.id);
    if (!vehicle) return failWithLife(career, player, nextLife, "Транспорт не найден.");
    if (nextLife.vehicleId === vehicle.id) return failWithLife(career, player, nextLife, "Транспорт уже выбран.");
    if (nextPlayer.bankroll < vehicle.price) return failWithLife(career, player, nextLife, "Недостаточно денег.");
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
    nextLife.actionsToday += actionCost;
    const dayResult = advanceDayIfNeeded(nextLife, nextPlayer);
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

function advanceDayIfNeeded(life, player) {
  const messages = [];
  let nextLife = { ...life, needs: { ...life.needs } };
  const nextPlayer = { ...player };

  while (nextLife.actionsToday >= nextLife.actionsPerDay) {
    nextLife.actionsToday -= nextLife.actionsPerDay;
    nextLife.day += 1;
    nextLife.needs = applyNeedEffect(nextLife.needs, { hunger: -20, thirst: -25, energy: 20, stress: -2 });
    messages.push(`День ${nextLife.day}.`);

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
  return life.actionsToday + cost <= life.actionsPerDay;
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

function clampInt(value, fallback, min, max) {
  return Math.round(clamp(Number.isFinite(Number(value)) ? Number(value) : fallback, min, max));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number.isFinite(Number(value)) ? Number(value) : min));
}
