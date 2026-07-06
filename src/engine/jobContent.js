export const JOBS = [
  {
    id: "JOB_DELIVERY_SHIFT",
    title: "Курьер",
    companyName: "МосДоставка",
    venueIds: ["VENUE_RU_MOS_DELIVERY_OFFICE_001"],
    category: "delivery",
    actionCost: 2,
    baseWage: 90,
    minEnergy: 15,
    minReputation: 0,
    effect: { energy: -28, hunger: -14, thirst: -18, stress: 12 },
    stages: [
      { id: "courier", title: "Курьер", minXp: 0, wage: 90 },
      { id: "senior_courier", title: "Старший курьер", minXp: 5, wage: 115 },
      { id: "dispatcher", title: "Координатор доставки", minXp: 12, wage: 145 }
    ]
  },
  {
    id: "JOB_WAREHOUSE_SHIFT",
    title: "Складской рабочий",
    companyName: "Склад Север",
    venueIds: ["VENUE_RU_MOS_WAREHOUSE_YARD_001"],
    category: "warehouse",
    actionCost: 3,
    baseWage: 125,
    minEnergy: 20,
    minReputation: 0,
    effect: { energy: -45, hunger: -25, thirst: -25, stress: 20 },
    stages: [
      { id: "loader", title: "Рабочий склада", minXp: 0, wage: 125 },
      { id: "senior_loader", title: "Старший смены склада", minXp: 6, wage: 155 },
      { id: "warehouse_lead", title: "Бригадир склада", minXp: 14, wage: 195 }
    ]
  },
  {
    id: "JOB_CAFE_HELPER",
    title: "Помощник в кафе",
    companyName: "Cheap Cafe",
    venueIds: ["VENUE_RU_MOS_WAREHOUSE_YARD_001", "VENUE_RU_MOS_CHEAP_CAFE_001"],
    category: "cafe",
    actionCost: 2,
    baseWage: 70,
    minEnergy: 12,
    minReputation: 0,
    effect: { energy: -20, hunger: 20, thirst: -8, stress: 8 },
    stages: [
      { id: "helper", title: "Помощник в кафе", minXp: 0, wage: 70 },
      { id: "barista", title: "Бариста", minXp: 5, wage: 95 },
      { id: "admin", title: "Администратор кафе", minXp: 12, wage: 130 }
    ]
  },
  {
    id: "JOB_SECURITY_GUARD",
    title: "Охранник",
    companyName: "ЧОП Восток",
    venueIds: ["VENUE_RU_MOS_SECURITY_OFFICE_001"],
    category: "security",
    actionCost: 2,
    baseWage: 110,
    minEnergy: 20,
    minReputation: 0,
    effect: { energy: -25, hunger: -12, thirst: -12, stress: 16 },
    stages: [
      { id: "guard", title: "Охранник", minXp: 0, wage: 110 },
      { id: "senior_guard", title: "Старший охранник", minXp: 6, wage: 145 },
      { id: "shift_chief", title: "Начальник смены", minXp: 15, wage: 190 }
    ]
  },
  {
    id: "JOB_CAR_WASHER",
    title: "Автомойщик",
    companyName: "Южная мойка",
    venueIds: ["VENUE_RU_MOS_CAR_SERVICE_JOBS_001"],
    category: "service",
    actionCost: 2,
    baseWage: 85,
    minEnergy: 15,
    minReputation: 0,
    effect: { energy: -26, hunger: -12, thirst: -18, stress: 10 },
    stages: [
      { id: "washer", title: "Автомойщик", minXp: 0, wage: 85 },
      { id: "detailing", title: "Детейлинг-мастер", minXp: 5, wage: 120 },
      { id: "service_admin", title: "Администратор мойки", minXp: 13, wage: 160 }
    ]
  },
  {
    id: "JOB_OFFICE_CLERK",
    title: "Офисный клерк",
    companyName: "Пресня Офис",
    venueIds: ["VENUE_RU_MOS_OFFICE_JOBS_001"],
    category: "office",
    actionCost: 2.5,
    baseWage: 120,
    minEnergy: 10,
    minReputation: 2,
    effect: { energy: -18, hunger: -10, thirst: -10, stress: 14 },
    stages: [
      { id: "clerk", title: "Офисный клерк", minXp: 0, wage: 120 },
      { id: "assistant", title: "Ассистент отдела", minXp: 6, wage: 160 },
      { id: "office_manager", title: "Офис-менеджер", minXp: 15, wage: 220 }
    ]
  },
  {
    id: "JOB_GYM_TRAINER",
    title: "Помощник тренера",
    companyName: "Ринг Фитнес",
    venueIds: ["VENUE_RU_MOS_GYM_JOBS_001"],
    category: "sport",
    actionCost: 2,
    baseWage: 115,
    minEnergy: 25,
    minReputation: 5,
    effect: { energy: -30, hunger: -18, thirst: -22, stress: -2 },
    stages: [
      { id: "assistant_trainer", title: "Помощник тренера", minXp: 0, wage: 115 },
      { id: "trainer", title: "Тренер группы", minXp: 7, wage: 160 },
      { id: "head_trainer", title: "Старший тренер", minXp: 16, wage: 230 }
    ]
  },
  {
    id: "JOB_SHIFT_MANAGER",
    title: "Менеджер смены",
    companyName: "Городской маркет",
    venueIds: ["VENUE_RU_MOS_OFFICE_JOBS_001", "VENUE_RU_MOS_BUSINESS_BROKER_001"],
    category: "management",
    actionCost: 3,
    baseWage: 160,
    minEnergy: 20,
    minReputation: 8,
    effect: { energy: -26, hunger: -15, thirst: -15, stress: 24 },
    stages: [
      { id: "shift_manager", title: "Менеджер смены", minXp: 0, wage: 160 },
      { id: "store_admin", title: "Администратор точки", minXp: 8, wage: 220 },
      { id: "operations_manager", title: "Операционный менеджер", minXp: 18, wage: 310 }
    ]
  }
];

export const JOBS_BY_ID = Object.fromEntries(JOBS.map((job) => [job.id, job]));

export function getJobById(jobId) {
  return JOBS_BY_ID[jobId] ?? null;
}

export function getJobsForVenue(venueId, jobIds = []) {
  const explicit = jobIds.map(getJobById).filter(Boolean);
  if (explicit.length) return explicit;
  return JOBS.filter((job) => (job.venueIds ?? []).includes(venueId));
}
