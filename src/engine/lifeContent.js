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

const HOUSING_ALIAS_IDS = {
  HOUSING_CHEAP_ROOM: "HOUSING_RU_MOS_BIRYULYOVO_ROOM_001",
  HOUSING_SMALL_STUDIO: "HOUSING_RU_MOS_NEKRASOVKA_STUDIO_001",
  HOUSING_APARTMENT: "HOUSING_RU_MOS_CHERTANOVO_1ROOM_001",
};

export const LIFE_HOUSING = [
  {
    id: "HOUSING_RU_MOS_BIRYULYOVO_ROOM_001",
    legacyIds: ["HOUSING_CHEAP_ROOM"],
    name: "Комната в Бирюлёво",
    district: "Бирюлёво Западное",
    address: "Булатниковский проезд, 6",
    rooms: 1,
    sqm: 14,
    capacity: 1,
    repair: "уставший косметический",
    tier: "outskirts_basic",
    rent: 250,
    intervalDays: 7,
    restEffect: { energy: 35, stress: -5, hunger: -6, thirst: -8 },
    purchasePrice: null,
  },
  {
    id: "HOUSING_RU_MOS_KAPOTNYA_ROOM_001",
    name: "Комната в Капотне",
    district: "Капотня",
    address: "2-й квартал Капотни, 17",
    rooms: 1,
    sqm: 12,
    capacity: 1,
    repair: "старый ремонт",
    tier: "outskirts_basic",
    rent: 300,
    intervalDays: 7,
    restEffect: { energy: 36, stress: -4, hunger: -6, thirst: -8 },
    purchasePrice: null,
  },
  {
    id: "HOUSING_RU_MOS_NEKRASOVKA_STUDIO_001",
    legacyIds: ["HOUSING_SMALL_STUDIO"],
    name: "Студия в Некрасовке",
    district: "Некрасовка",
    address: "Рождественская улица, 33",
    rooms: 1,
    sqm: 22,
    capacity: 1,
    repair: "простой ремонт от застройщика",
    tier: "budget_studio",
    rent: 500,
    intervalDays: 7,
    restEffect: { energy: 50, stress: -10, hunger: -5, thirst: -6 },
    purchasePrice: 25000,
  },
  {
    id: "HOUSING_RU_MOS_BUTOVO_STUDIO_001",
    name: "Студия в Южном Бутово",
    district: "Южное Бутово",
    address: "Скобелевская улица, 20",
    rooms: 1,
    sqm: 28,
    capacity: 1,
    repair: "аккуратный косметический",
    tier: "budget_studio",
    rent: 620,
    intervalDays: 7,
    restEffect: { energy: 53, stress: -11, hunger: -5, thirst: -6 },
    purchasePrice: 32000,
  },
  {
    id: "HOUSING_RU_MOS_CHERTANOVO_1ROOM_001",
    legacyIds: ["HOUSING_APARTMENT"],
    name: "Однушка в Чертаново",
    district: "Чертаново Центральное",
    address: "Кировоградская улица, 42",
    rooms: 1,
    sqm: 38,
    capacity: 2,
    repair: "нормальный косметический",
    tier: "standard_flat",
    rent: 900,
    intervalDays: 7,
    restEffect: { energy: 65, stress: -15, hunger: -4, thirst: -5 },
    purchasePrice: 65000,
  },
  {
    id: "HOUSING_RU_MOS_MITINO_2ROOM_001",
    name: "Двушка в Митино",
    district: "Митино",
    address: "Митинская улица, 36",
    rooms: 2,
    sqm: 52,
    capacity: 2,
    repair: "хороший косметический",
    tier: "standard_flat",
    rent: 1250,
    intervalDays: 7,
    restEffect: { energy: 70, stress: -18, hunger: -4, thirst: -5 },
    purchasePrice: 92000,
  },
  {
    id: "HOUSING_RU_MOS_DANILOVSKY_2ROOM_001",
    name: "Двушка в Даниловском",
    district: "Даниловский",
    address: "Автозаводская улица, 23",
    rooms: 2,
    sqm: 58,
    capacity: 2,
    repair: "современный ремонт",
    tier: "business_flat",
    rent: 1850,
    intervalDays: 7,
    restEffect: { energy: 76, stress: -22, hunger: -3, thirst: -4 },
    purchasePrice: 150000,
  },
  {
    id: "HOUSING_RU_MOS_PRESNYA_2ROOM_001",
    name: "Двушка на Пресне",
    district: "Пресненский",
    address: "Ходынский бульвар, 20А",
    rooms: 2,
    sqm: 64,
    capacity: 2,
    repair: "дорогой современный",
    tier: "premium_flat",
    rent: 2600,
    intervalDays: 7,
    restEffect: { energy: 82, stress: -26, hunger: -3, thirst: -4 },
    purchasePrice: 240000,
  },
  {
    id: "HOUSING_RU_MOS_KHAMOVNIKI_3ROOM_001",
    name: "Трёшка в Хамовниках",
    district: "Хамовники",
    address: "Усачёва улица, 11",
    rooms: 3,
    sqm: 92,
    capacity: 3,
    repair: "премиальный ремонт",
    tier: "elite_flat",
    rent: 4200,
    intervalDays: 7,
    restEffect: { energy: 88, stress: -32, hunger: -2, thirst: -3 },
    purchasePrice: 430000,
  },
  {
    id: "HOUSING_RU_MOS_KHAMOVNIKI_ELITE_001",
    name: "Элитная квартира в Хамовниках",
    district: "Хамовники",
    address: "1-й Зачатьевский переулок, 8",
    rooms: 4,
    sqm: 140,
    capacity: 4,
    repair: "дизайнерский ремонт",
    tier: "elite_luxury",
    rent: 7200,
    intervalDays: 7,
    restEffect: { energy: 95, stress: -40, hunger: -1, thirst: -2 },
    purchasePrice: 850000,
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
  const normalizedId = HOUSING_ALIAS_IDS[housingId] ?? housingId;
  return LIFE_HOUSING.find((housing) => housing.id === normalizedId || (housing.legacyIds ?? []).includes(housingId)) ?? LIFE_HOUSING[0];
}

export function getLifeAsset(assetId) {
  return LIFE_ASSETS.find((asset) => asset.id === assetId) ?? null;
}

export function getLifeVehicle(vehicleId) {
  return LIFE_VEHICLES.find((vehicle) => vehicle.id === vehicleId) ?? null;
}
