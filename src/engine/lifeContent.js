export const LIFE_LIMITS = {
  maxNeed: 100,
  maxFocus: 3,
  actionsPerDay: 3,
  rentIntervalDays: 7,
};

export const LIFE_ITEMS = [
  {
    id: "ITEM_WATER_BOTTLE",
    name: "Вода",
    type: "drink",
    price: 2,
    effect: { thirst: 30 },
  },
  {
    id: "ITEM_ENERGY_DRINK",
    name: "Энергетик",
    type: "drink",
    price: 5,
    effect: { thirst: 15, energy: 15, stress: 5 },
  },
  {
    id: "ITEM_SANDWICH",
    name: "Сэндвич",
    type: "food",
    price: 8,
    effect: { hunger: 35 },
  },
  {
    id: "ITEM_READY_MEAL",
    name: "Готовый обед",
    type: "food",
    price: 14,
    effect: { hunger: 60 },
  },
  {
    id: "ITEM_COFFEE_CAN",
    name: "Кофе",
    type: "drink",
    price: 4,
    effect: { energy: 10, stress: 3 },
  },
];

export const LIFE_CAFE_ORDERS = [
  {
    id: "CAFE_BREAKFAST",
    name: "Завтрак",
    price: 18,
    actionCost: 1,
    effect: { hunger: 70, energy: 10, stress: -5, thirst: 10 },
  },
  {
    id: "CAFE_COFFEE",
    name: "Кофе",
    price: 5,
    actionCost: 1,
    effect: { energy: 15, stress: 4, thirst: 5 },
  },
  {
    id: "CAFE_LUNCH",
    name: "Обед",
    price: 25,
    actionCost: 1,
    effect: { hunger: 90, stress: -8, thirst: 15 },
  },
];

export const LIFE_JOBS = [
  {
    id: "JOB_DELIVERY_SHIFT",
    name: "Delivery Shift",
    pay: 80,
    actionCost: 1,
    effect: { energy: -30, hunger: -15, thirst: -20, stress: 15 },
  },
  {
    id: "JOB_WAREHOUSE_SHIFT",
    name: "Warehouse Shift",
    pay: 120,
    actionCost: 2,
    effect: { energy: -45, hunger: -25, thirst: -25, stress: 20 },
  },
  {
    id: "JOB_CAFE_HELPER",
    name: "Cafe Helper",
    pay: 60,
    actionCost: 1,
    effect: { energy: -20, hunger: 30, stress: 8, thirst: -10 },
  },
];

export const LIFE_HOUSING = [
  {
    id: "HOUSING_CHEAP_ROOM",
    name: "Комната",
    rent: 250,
    intervalDays: 7,
    restEffect: { energy: 35, stress: -6, hunger: -6, thirst: -8 },
    purchasePrice: null,
  },
  {
    id: "HOUSING_SMALL_STUDIO",
    name: "Маленькая студия",
    rent: 500,
    intervalDays: 7,
    restEffect: { energy: 50, stress: -10, hunger: -5, thirst: -6 },
    purchasePrice: 25000,
  },
  {
    id: "HOUSING_APARTMENT",
    name: "Нормальная квартира",
    rent: 900,
    intervalDays: 7,
    restEffect: { energy: 65, stress: -15, hunger: -4, thirst: -5 },
    purchasePrice: 65000,
  },
];

export const LIFE_ASSETS = [
  {
    id: "ASSET_PHONE",
    name: "Нормальный телефон",
    price: 700,
    type: "tech",
    effect: { status: 1 },
  },
  {
    id: "ASSET_LAPTOP",
    name: "Ноутбук",
    price: 1200,
    type: "tech",
    effect: { status: 1 },
  },
  {
    id: "ASSET_WATCH",
    name: "Часы",
    price: 1500,
    type: "status",
    effect: { status: 1 },
  },
];

export const LIFE_VEHICLES = [
  {
    id: "VEHICLE_OLD_CAR",
    name: "Старая машина",
    price: 3500,
    effect: { stress: -5 },
  },
  {
    id: "VEHICLE_SEDAN",
    name: "Нормальный седан",
    price: 12000,
    effect: { stress: -8 },
  },
];

export function getLifeItem(itemId) {
  return LIFE_ITEMS.find((item) => item.id === itemId) ?? null;
}

export function getLifeCafeOrder(orderId) {
  return LIFE_CAFE_ORDERS.find((order) => order.id === orderId) ?? null;
}

export function getLifeJob(jobId) {
  return LIFE_JOBS.find((job) => job.id === jobId) ?? null;
}

export function getLifeHousing(housingId) {
  return LIFE_HOUSING.find((housing) => housing.id === housingId) ?? LIFE_HOUSING[0];
}

export function getLifeAsset(assetId) {
  return LIFE_ASSETS.find((asset) => asset.id === assetId) ?? null;
}

export function getLifeVehicle(vehicleId) {
  return LIFE_VEHICLES.find((vehicle) => vehicle.id === vehicleId) ?? null;
}
