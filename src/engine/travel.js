import { spendLifeActionCost } from "./life.js?v=3.5.0";

export function getTravelView(content, career = {}, player = {}, currentCityId = null) {
  const cityId = currentCityId ?? career?.travel?.currentCityId ?? "CITY_RU_NORTH_DISTRICT";
  const routes = buildTravelRoutes(content)
    .filter((route) => route.fromCityId === cityId)
    .map((route) => buildRouteView(content, career, player, route));
  return {
    currentCity: content?.byId?.cities?.[cityId] ?? null,
    routes,
  };
}

export function applyTravelRoute({ content, career = {}, player = {}, routeId = null } = {}) {
  const route = buildTravelRoutes(content).find((entry) => entry.id === routeId);
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

function buildTravelRoutes(content) {
  const cities = (content?.cities ?? []).filter(Boolean);
  const routes = [];
  for (const from of cities) {
    for (const to of cities) {
      if (from.id === to.id) continue;
      const sameCountry = from.countryId === to.countryId;
      const price = getTravelPrice(from, to, sameCountry);
      const actionCost = sameCountry ? 3 : isLongHaul(from, to) ? 6 : 5;
      routes.push({ id: `TRAVEL_${from.id}_TO_${to.id}`, fromCityId: from.id, toCityId: to.id, price, actionCost });
    }
  }
  return routes;
}

function getTravelPrice(from, to, sameCountry) {
  const fromBase = getCityTravelBase(from);
  const toBase = getCityTravelBase(to);
  if (sameCountry) return Math.max(180, Math.round((fromBase + toBase) * 0.28));
  return Math.max(700, Math.round((fromBase + toBase) * 0.55));
}

function getCityTravelBase(city) {
  const tier = Math.max(1, Math.min(7, Number(city?.tier ?? 1) || 1));
  const stage = Math.max(1, Number(city?.routeStage ?? tier) || tier);
  const tourist = Math.max(0, Number(city?.touristLevel ?? 30) || 0);
  return 320 + tier * 310 + stage * 150 + tourist * 6;
}

function isLongHaul(from, to) {
  const pair = [from.countryId, to.countryId].join("|");
  return pair.includes("COUNTRY_USA") || pair.includes("COUNTRY_JAPAN") || pair.includes("COUNTRY_GREATER_CHINA") || pair.includes("COUNTRY_SOUTH_KOREA");
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
