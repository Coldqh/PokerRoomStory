export const CITY_PROGRESSION = [
  city(1, "CITY_RU_NORTH_DISTRICT", "COUNTRY_RUSSIA", "Москва", "Russia Starter", 0, 0, 0, 1, 2, 10, "CITY_RU_SAINT_PETERSBURG_001"),
  city(2, "CITY_RU_SAINT_PETERSBURG_001", "COUNTRY_RUSSIA", "Санкт-Петербург", "Russia Starter", 4000, 15, 420, 2, 5, 20, "CITY_RU_SOCHI_001"),
  city(3, "CITY_RU_SOCHI_001", "COUNTRY_RUSSIA", "Сочи", "Russia Starter", 8000, 25, 540, 5, 10, 20, "CITY_RU_VLADIVOSTOK_001"),
  city(4, "CITY_RU_VLADIVOSTOK_001", "COUNTRY_RUSSIA", "Владивосток", "Russia Starter", 15000, 40, 780, 5, 10, 50, "CITY_ES_BARCELONA_001"),
  city(5, "CITY_ES_BARCELONA_001", "COUNTRY_SPAIN", "Barcelona", "Europe Test", 25000, 55, 1200, 10, 20, 50, "CITY_DE_BERLIN_001"),
  city(6, "CITY_DE_BERLIN_001", "COUNTRY_GERMANY", "Berlin", "Europe Test", 35000, 65, 1350, 10, 20, 50, "CITY_UK_MANCHESTER_001"),
  city(7, "CITY_UK_MANCHESTER_001", "COUNTRY_UK", "Manchester", "Europe Test", 45000, 75, 1500, 10, 20, 100, "CITY_FR_PARIS_001"),
  city(8, "CITY_FR_PARIS_001", "COUNTRY_FRANCE", "Paris", "Europe Test", 60000, 85, 1800, 25, 50, 100, "CITY_KR_SEOUL_001"),
  city(9, "CITY_KR_SEOUL_001", "COUNTRY_SOUTH_KOREA", "Seoul", "Asia Discipline", 70000, 95, 1950, 25, 50, 100, "CITY_JP_OSAKA_001"),
  city(10, "CITY_JP_OSAKA_001", "COUNTRY_JAPAN", "Osaka", "Asia Discipline", 80000, 105, 2100, 25, 50, 100, "CITY_JP_TOKYO_001"),
  city(11, "CITY_JP_TOKYO_001", "COUNTRY_JAPAN", "Tokyo", "Asia Discipline", 95000, 115, 2300, 25, 50, 200, "CITY_US_MIAMI_001"),
  city(12, "CITY_US_MIAMI_001", "COUNTRY_USA", "Miami", "America Pressure", 110000, 125, 2600, 50, 100, 200, "CITY_US_NEW_YORK_001"),
  city(13, "CITY_US_NEW_YORK_001", "COUNTRY_USA", "New York", "America Pressure", 130000, 135, 2800, 50, 100, 200, "CITY_UK_LONDON_001"),
  city(14, "CITY_UK_LONDON_001", "COUNTRY_UK", "London", "Europe Elite", 150000, 145, 3000, 50, 100, 200, "CITY_CN_SHENZHEN_001"),
  city(15, "CITY_CN_SHENZHEN_001", "COUNTRY_GREATER_CHINA", "Shenzhen", "Asia Money", 175000, 155, 3400, 50, 100, 400, "CITY_CN_SHANGHAI_001"),
  city(16, "CITY_CN_SHANGHAI_001", "COUNTRY_GREATER_CHINA", "Shanghai", "Asia Money", 200000, 165, 3800, 100, 200, 400, "CITY_HK_HONG_KONG_001"),
  city(17, "CITY_HK_HONG_KONG_001", "COUNTRY_GREATER_CHINA", "Hong Kong", "Asia Money", 240000, 180, 4200, 100, 200, 600, "CITY_US_LA_001"),
  city(18, "CITY_US_LA_001", "COUNTRY_USA", "Los Angeles", "America Pressure", 300000, 200, 4800, 100, 200, 600, "CITY_US_LAS_VEGAS_001"),
  city(19, "CITY_US_LAS_VEGAS_001", "COUNTRY_USA", "Las Vegas", "World Stage", 400000, 230, 5600, 200, 400, 1000, "CITY_MC_MONACO_001"),
  city(20, "CITY_MC_MONACO_001", "COUNTRY_MONACO", "Monaco", "Endgame Luxury", 600000, 260, 7200, 300, 600, 2000, "CITY_MO_MACAU_001"),
  city(21, "CITY_MO_MACAU_001", "COUNTRY_GREATER_CHINA", "Macau", "Endgame Cash", 1000000, 300, 9500, 500, 1000, 4000, null),
];

export const CITY_PROGRESSION_BY_ID = Object.fromEntries(CITY_PROGRESSION.map((entry) => [entry.cityId, entry]));

export function getCityProgression(cityId) {
  return CITY_PROGRESSION_BY_ID[cityId] ?? null;
}

export function getPreviousCityProgression(cityId) {
  const current = getCityProgression(cityId);
  if (!current || current.order <= 1) return null;
  return CITY_PROGRESSION.find((entry) => entry.order === current.order - 1) ?? null;
}

export function getNextCityProgression(cityId) {
  const current = getCityProgression(cityId);
  if (!current) return CITY_PROGRESSION[0] ?? null;
  return CITY_PROGRESSION.find((entry) => entry.order === current.order + 1) ?? null;
}

export function getCityProgressionRoute() {
  return [...CITY_PROGRESSION];
}

export function getCityProgressionStatus({ career = {}, player = {}, cityId = null } = {}) {
  const progression = getCityProgression(cityId);
  if (!progression) return { progression: null, status: "open", ok: true, reason: null };
  const visited = new Set(career?.travel?.visitedCityIds ?? career?.unlockedCities ?? []);
  const bankroll = Math.max(0, Math.round(Number(player?.bankroll ?? 0) || 0));
  const reputation = Math.max(0, Math.round(Number(player?.reputation ?? 0) || 0));
  const previous = getPreviousCityProgression(cityId);
  const previousVisited = !previous || visited.has(previous.cityId) || (career?.unlockedCities ?? []).includes(previous.cityId);
  const currentVisited = visited.has(cityId) || (career?.unlockedCities ?? []).includes(cityId);

  if (currentVisited || progression.order === 1) return { progression, status: currentVisited ? "visited" : "open", ok: true, reason: null };
  if (!previousVisited) return { progression, status: "locked", ok: false, reason: `Сначала доберись до предыдущего города: ${previous?.name ?? "маршрут"}.` };
  if (bankroll < progression.bankrollGate) return { progression, status: "locked", ok: false, reason: `Нужен банкролл $${progression.bankrollGate}.` };
  if (reputation < progression.reputationGate) return { progression, status: "locked", ok: false, reason: `Нужно ${progression.reputationGate} репутации.` };
  return { progression, status: "available", ok: true, reason: null };
}

export function getBalancedClubProfile(cityId, clubIndex = 0) {
  const progression = getCityProgression(cityId);
  if (!progression) return null;
  return progression.clubProfiles[Math.max(0, Math.min(progression.clubProfiles.length - 1, clubIndex))] ?? null;
}

export function applyCityProgressionBalance(registry) {
  const clubsByCity = groupBy(registry.clubs ?? [], "cityId");
  const tablesByClub = groupBy(registry.tables ?? [], "clubId");

  registry.cities = (registry.cities ?? []).filter(Boolean).map((cityEntry) => {
    const progression = getCityProgression(cityEntry.id);
    if (!progression) return cityEntry;
    return {
      ...cityEntry,
      routeOrder: progression.order,
      routeStage: progression.order,
      act: progression.act,
      bankrollGate: progression.bankrollGate,
      reputationGate: progression.reputationGate,
      travelPrice: progression.travelPrice,
      averageLimit: `$${progression.baseSmallBlind}/$${progression.baseBigBlind} → $${Math.max(1, Math.round(progression.topBigBlind / 2))}/$${progression.topBigBlind}`,
      nextCityId: progression.nextCityId,
    };
  }).sort((left, right) => (getCityProgression(left.id)?.order ?? 999) - (getCityProgression(right.id)?.order ?? 999));

  registry.clubs = (registry.clubs ?? []).filter(Boolean).map((clubEntry) => {
    const cityClubs = clubsByCity.get(clubEntry.cityId) ?? [];
    const clubIndex = Math.max(0, cityClubs.findIndex((entry) => entry.id === clubEntry.id));
    const profile = getBalancedClubProfile(clubEntry.cityId, clubIndex % 3);
    if (!profile) return clubEntry;
    const city = getCityProgression(clubEntry.cityId);
    const unlockRequirement = profile.unlockRequirement ? { ...profile.unlockRequirement } : null;
    return {
      ...clubEntry,
      tier: profile.tier,
      type: profile.type,
      routeOrder: city.order,
      balanceRole: profile.role,
      reputationLevel: profile.reputationLevel,
      minBuyIn: profile.minBuyIn,
      maxBuyIn: profile.maxBuyIn,
      unlockRequirement,
      styleTags: [...new Set([...(clubEntry.styleTags ?? []), city.act, profile.role])],
    };
  });

  const rebalancedClubsByCity = groupBy(registry.clubs ?? [], "cityId");

  registry.tables = (registry.tables ?? []).filter(Boolean).map((tableEntry) => {
    if (String(tableEntry.id ?? "").startsWith("TABLE_RU_BRR_")) return tableEntry;
    const club = registry.clubs.find((entry) => entry.id === tableEntry.clubId) ?? null;
    if (!club) return tableEntry;
    const city = getCityProgression(club.cityId);
    if (!city) return tableEntry;
    const cityClubs = rebalancedClubsByCity.get(club.cityId) ?? [];
    const clubIndex = Math.max(0, cityClubs.findIndex((entry) => entry.id === club.id)) % 3;
    const profile = getBalancedClubProfile(club.cityId, clubIndex);
    const clubTables = tablesByClub.get(club.id) ?? [];
    const tableIndex = Math.max(0, clubTables.findIndex((entry) => entry.id === tableEntry.id));
    const bigBlind = profile.tableBigBlinds[Math.max(0, Math.min(profile.tableBigBlinds.length - 1, tableIndex % profile.tableBigBlinds.length))];
    const smallBlind = Math.max(1, Math.round(bigBlind / 2));
    return {
      ...tableEntry,
      routeOrder: city.order,
      balanceRole: profile.role,
      gameLabel: `$${smallBlind}/$${bigBlind} NL Hold’em`,
      smallBlind,
      bigBlind,
      minBuyIn: bigBlind * 50,
      maxBuyIn: bigBlind * 300,
      recommendedBuyIn: bigBlind * 100,
      avgPot: bigBlind * (18 + clubIndex * 4),
      difficulty: Math.max(1, Math.min(10, city.order + clubIndex)),
      unlockRequirement: profile.unlockRequirement ? { ...profile.unlockRequirement } : tableEntry.unlockRequirement ?? null,
    };
  });

  return registry;
}

function city(order, cityId, countryId, name, act, bankrollGate, reputationGate, travelPrice, baseSmallBlind, baseBigBlind, topBigBlind, nextCityId) {
  const profileBlinds = makeClubProfiles({ bankrollGate, reputationGate, baseBigBlind, topBigBlind, order });
  return {
    order,
    cityId,
    countryId,
    name,
    act,
    bankrollGate,
    reputationGate,
    travelPrice,
    baseSmallBlind,
    baseBigBlind,
    topBigBlind,
    nextCityId,
    cityCompleteBankroll: Math.max(4000, Math.round(bankrollGate * 1.25 + topBigBlind * 250)),
    clubProfiles: profileBlinds,
  };
}

function makeClubProfiles({ bankrollGate, reputationGate, baseBigBlind, topBigBlind, order }) {
  const entryBlind = baseBigBlind;
  const midBlind = Math.max(entryBlind, Math.round((baseBigBlind + topBigBlind) / 3));
  const mainBlind = Math.max(entryBlind, Math.round((baseBigBlind + topBigBlind) / 2));
  const finalBlind = topBigBlind;
  return [
    clubProfile("entry", "C3", "local_room", 3, entryBlind, [entryBlind, entryBlind, Math.max(entryBlind, Math.round(entryBlind * 1.5)), midBlind], null),
    clubProfile("main", "C4", "private_room", 4, mainBlind, [midBlind, mainBlind, mainBlind, Math.max(mainBlind, Math.round(finalBlind * 0.7))], { bankroll: Math.max(0, Math.round(bankrollGate * 0.75)), reputation: Math.max(0, reputationGate - 8) }),
    clubProfile("final", "C5", "high_stakes_room", 5, finalBlind, [Math.max(mainBlind, Math.round(finalBlind * 0.7)), finalBlind, finalBlind, finalBlind], { bankroll: bankrollGate, reputation: reputationGate }),
  ];
}

function clubProfile(role, tier, type, reputationLevel, topBlind, tableBigBlinds, unlockRequirement) {
  const minBuyIn = topBlind * 50;
  return {
    role,
    tier,
    type,
    reputationLevel,
    minBuyIn,
    maxBuyIn: topBlind * 600,
    tableBigBlinds,
    unlockRequirement,
  };
}

function groupBy(items, key) {
  const map = new Map();
  for (const item of items ?? []) {
    if (!item) continue;
    const value = item[key];
    if (!map.has(value)) map.set(value, []);
    map.get(value).push(item);
  }
  return map;
}
