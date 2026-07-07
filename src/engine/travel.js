import { spendLifeActionCost } from "./life.js?v=3.5.0";

const HUBS = [
  { id: "CITY_RU_NORTH_DISTRICT", name: "Москва", base: 0 },
  { id: "CITY_RU_SAINT_PETERSBURG_001", name: "Санкт-Петербург", base: 1440 },
  { id: "CITY_RU_SOCHI_001", name: "Сочи", base: 1440 },
  { id: "CITY_RU_VLADIVOSTOK_001", name: "Владивосток", base: 1910 },
  { id: "CITY_US_LA_001", name: "Los Angeles", base: 2970 },
  { id: "CITY_US_LAS_VEGAS_001", name: "Las Vegas", base: 3440 },
  { id: "CITY_US_NEW_YORK_001", name: "New York", base: 2970 },
  { id: "CITY_US_MIAMI_001", name: "Miami", base: 2500 },
  { id: "CITY_MO_MACAU_001", name: "Macau", base: 3910 },
  { id: "CITY_HK_HONG_KONG_001", name: "Hong Kong", base: 3440 },
  { id: "CITY_CN_SHANGHAI_001", name: "Shanghai", base: 2970 },
  { id: "CITY_CN_SHENZHEN_001", name: "Shenzhen", base: 2500 },
  { id: "CITY_JP_TOKYO_001", name: "Tokyo", base: 2970 },
  { id: "CITY_JP_OSAKA_001", name: "Osaka", base: 2500 },
  { id: "CITY_KR_SEOUL_001", name: "Seoul", base: 2500 },
  { id: "CITY_UK_LONDON_001", name: "London", base: 2970 },
  { id: "CITY_UK_MANCHESTER_001", name: "Manchester", base: 2030 },
  { id: "CITY_FR_PARIS_001", name: "Paris", base: 2500 },
  { id: "CITY_MC_MONACO_001", name: "Monaco", base: 3910 },
  { id: "CITY_DE_BERLIN_001", name: "Berlin", base: 2030 },
  { id: "CITY_ES_BARCELONA_001", name: "Barcelona", base: 2030 },
];

export const TRAVEL_ROUTES = buildTravelRoutes();

function buildTravelRoutes() {
  const routes = [];
  for (const from of HUBS) {
    for (const to of HUBS) {
      if (from.id === to.id) continue;
      const international = !from.id.startsWith("CITY_RU_") || !to.id.startsWith("CITY_RU_");
      const price = from.id === "CITY_RU_NORTH_DISTRICT" ? to.base : to.id === "CITY_RU_NORTH_DISTRICT" ? Math.round(from.base * 0.7) : Math.round((from.base + to.base) * 0.55);
      const actionCost = international ? (to.id.includes("US_") || from.id.includes("US_") ? 6 : 5) : 3;
      routes.push({ id: `TRAVEL_${from.id}_TO_${to.id}`, fromCityId: from.id, toCityId: to.id, price, actionCost });
    }
  }
  return routes;
}

export function getTravelView(content, career = {}, player = {}, currentCityId = null) {
  const cityId = currentCityId ?? career?.travel?.currentCityId ?? "CITY_RU_NORTH_DISTRICT";
  const routes = TRAVEL_ROUTES
    .filter((route) => route.fromCityId === cityId)
    .map((route) => buildRouteView(content, career, player, route));
  return {
    currentCity: content?.byId?.cities?.[cityId] ?? null,
    routes,
  };
}

export function applyTravelRoute({ content, career = {}, player = {}, routeId = null } = {}) {
  const route = TRAVEL_ROUTES.find((entry) => entry.id === routeId);
  if (!route) return fail(career, player, "Маршрут не найден.");

  const bankroll = Math.max(0, Math.round(Number(player.bankroll ?? 0) || 0));
  if (bankroll < route.price) return fail(career, player, "Недостаточно денег на перелёт.");

  const time = spendLifeActionCost({ career, player: { ...player, bankroll: bankroll - route.price }, cost: route.actionCost, message: `Перелёт: -$${route.price}, -${route.actionCost} actions.` });
  if (!time.ok) return fail(career, player, "Недостаточно времени сегодня.");

  const destination = content?.byId?.cities?.[route.toCityId] ?? null;
  const countryId = destination?.countryId ?? null;
  const visitedCities = new Set(time.career?.travel?.visitedCityIds ?? []);
  const visitedCountries = new Set(time.career?.travel?.visitedCountryIds ?? []);
  visitedCities.add(route.toCityId);
  if (countryId) visitedCountries.add(countryId);

  return {
    ok: true,
    player: time.player,
    career: {
      ...time.career,
      unlockedCities: [...new Set([...(time.career?.unlockedCities ?? []), route.toCityId])],
      unlockedCountries: countryId ? [...new Set([...(time.career?.unlockedCountries ?? []), countryId])] : time.career?.unlockedCountries ?? [],
      travel: {
        ...(time.career?.travel ?? {}),
        currentCityId: route.toCityId,
        currentCountryId: countryId,
        visitedCityIds: [...visitedCities],
        visitedCountryIds: [...visitedCountries],
        lastTravelDay: time.career?.life?.day ?? 1,
      },
      city: {
        ...(time.career?.city ?? {}),
        activeVenueId: null,
      },
    },
    message: `Перелёт выполнен: ${destination?.name ?? route.toCityId}. -$${route.price}.`,
    destinationCityId: route.toCityId,
  };
}

function buildRouteView(content, career, player, route) {
  const city = content?.byId?.cities?.[route.toCityId] ?? null;
  const country = city ? content?.byId?.countries?.[city.countryId] ?? null : null;
  const bankroll = Math.max(0, Math.round(Number(player?.bankroll ?? 0) || 0));
  const actionsLeft = Number(career?.life?.actionsPerDay ?? 6) - Number(career?.life?.actionsUsed ?? 0);
  const moneyOk = bankroll >= route.price;
  const timeOk = actionsLeft >= route.actionCost;
  return {
    ...route,
    city,
    country,
    access: {
      ok: moneyOk && timeOk,
      reason: !moneyOk ? "Недостаточно денег на перелёт." : !timeOk ? "Недостаточно времени сегодня." : null,
    },
  };
}

function fail(career, player, message) {
  return { ok: false, career, player, message };
}
