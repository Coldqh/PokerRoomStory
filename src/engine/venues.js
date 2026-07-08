import { applyLifeAction, getLifeView, hasLifeActions, spendLifeActionCost } from "./life.js?v=3.7.0";
import {
  getLifeAsset,
  getLifeCafeOrder,
  getLifeHousing,
  getLifeItem,
  getLifeJob,
  getLifeVehicle,
} from "./lifeContent.js?v=3.7.0";
import { getClubTables } from "./selectors.js?v=3.7.0";
import { applyBusinessAction, getBusinessBrokerRows } from "./businesses.js?v=3.7.0";
import { canEnterClub } from "./world.js?v=3.7.0";
import { applyJobAction, getJobRowsForVenue } from "./jobs.js?v=3.7.0";

export function getCityVenues(content, cityId = null) {
  return (content?.venues ?? [])
    .filter((venue) => !cityId || venue.cityId === cityId)
    .filter((venue) => venue?.id && venue?.type)
    .sort(sortVenue);
}

export function getVenueById(content, venueId) {
  return content?.byId?.venues?.[venueId] ?? (content?.venues ?? []).find((venue) => venue.id === venueId) ?? null;
}

export function canEnterVenue(player = {}, career = {}, venue = null, content = null) {
  if (!venue) return { ok: false, reason: "Объект не найден." };

  if (venue.type === "poker_club") {
    const club = content?.byId?.clubs?.[venue.clubId] ?? null;
    return canEnterClub(player, career, club);
  }

  const req = venue.unlockRequirement ?? null;
  if (req?.storyCompleted && !career?.storyProgress?.[req.storyCompleted]?.completed) {
    return { ok: false, reason: "Заверши нужный маршрут." };
  }

  const unlockedCities = new Set(career?.unlockedCities ?? []);
  if (venue.cityId && unlockedCities.size && !unlockedCities.has(venue.cityId)) {
    return { ok: false, reason: "Город закрыт." };
  }

  return { ok: true, reason: null };
}

export function getVenueStatus(content, career = {}, player = {}, venue = null, activeVenueId = null, activeClubId = null) {
  const access = canEnterVenue(player, career, venue, content);
  const current = Boolean(activeVenueId && activeVenueId === venue?.id);
  const linkedClub = venue?.type === "poker_club" ? content?.byId?.clubs?.[venue.clubId] ?? null : null;
  const linkedClubCurrent = Boolean(linkedClub && activeClubId === linkedClub.id);
  const statusId = !access.ok ? "locked" : current || linkedClubCurrent ? "current" : "open";

  return {
    venue,
    access,
    linkedClub,
    current: current || linkedClubCurrent,
    statusId,
    statusLabel: getVenueStatusLabel(statusId),
    actionLabel: !access.ok ? "Закрыто" : current || linkedClubCurrent ? "Открыто" : "Открыть",
  };
}

export function getVenueView({ content, career = {}, player = {}, venueId = null, activeClubId = null } = {}) {
  const venue = getVenueById(content, venueId);
  const status = getVenueStatus(content, career, player, venue, venueId, activeClubId);
  const lifeView = getLifeView(career, player, venue?.cityId);
  const city = venue ? content?.byId?.cities?.[venue.cityId] ?? null : null;
  const country = city ? content?.byId?.countries?.[city.countryId] ?? null : null;

  return {
    venue,
    status,
    city,
    country,
    lifeView,
    rows: getVenueRows(venue, lifeView, career, player),
    club: venue?.type === "poker_club" ? content?.byId?.clubs?.[venue.clubId] ?? null : null,
    tables: venue?.type === "poker_club" ? getClubTables(content, venue.clubId) : [],
  };
}

export function applyVenueAction({ content, venueId, actionId, career = {}, player = {} } = {}) {
  const venue = getVenueById(content, venueId);
  const access = canEnterVenue(player, career, venue, content);
  if (!access.ok) return { career, player, ok: false, message: access.reason, nextScreen: null };
  if (!isVenueActionAllowed(venue, actionId, career)) {
    return { career, player, ok: false, message: "Действие недоступно здесь.", nextScreen: null };
  }

  if (isJobAction(actionId)) {
    const jobResult = applyJobAction({ actionId, career, player });
    if (!jobResult.ok) return jobResult;
    return {
      ...jobResult,
      career: markVenueVisited(jobResult.career, venue.id),
    };
  }

  if (isBusinessAction(actionId)) {
    const actionCost = getBusinessVenueActionCost(actionId);
    if (actionCost > 0 && !hasLifeActions(career, actionCost)) {
      return { career, player, ok: false, message: "Недостаточно действий сегодня.", nextScreen: null };
    }

    const businessResult = applyBusinessAction({ actionId, career, player, cityId: venue.cityId });
    if (!businessResult.ok) return businessResult;

    const timeResult = actionCost > 0
      ? spendLifeActionCost({ career: businessResult.career, player: businessResult.player, cost: actionCost, message: `${businessResult.message} -${actionCost} action.` })
      : businessResult;
    if (!timeResult.ok) return timeResult;

    return {
      ...timeResult,
      message: timeResult.message || businessResult.message,
      career: markVenueVisited(timeResult.career, venue.id),
    };
  }

  const result = applyLifeAction({ actionId, career, player, cityId: venue.cityId });
  if (!result.ok) return result;

  return {
    ...result,
    career: markVenueVisited(result.career, venue.id),
  };
}

function getVenueRows(venue, lifeView, career = {}, player = {}) {
  if (!venue) return [];
  const canSpendMajorAction = Number(lifeView.actionsLeft ?? 0) >= 1;
  if (venue.type === "store") {
    return (venue.inventoryIds ?? []).map((id) => {
      const item = getLifeItem(id);
      const viewItem = lifeView.items.find((entry) => entry.id === id);
      return item ? { kind: "item", actionId: `buy:${id}`, item, canUse: Boolean(viewItem?.canBuy), ownedQty: viewItem?.ownedQty ?? 0 } : null;
    }).filter(Boolean);
  }

  if (["cafe", "restaurant"].includes(venue.type)) {
    return (venue.orderIds ?? []).map((id) => {
      const order = getLifeCafeOrder(id);
      const viewOrder = lifeView.cafeOrders.find((entry) => entry.id === id);
      return order ? { kind: "cafe", actionId: `cafe:${id}`, order, canUse: Boolean(viewOrder?.canUse) } : null;
    }).filter(Boolean);
  }

  if (venue.type === "job_site") {
    return getJobRowsForVenue({
      venueId: venue.id,
      jobIds: venue.jobIds ?? [],
      career,
      player,
    });
  }

  if (venue.type === "real_estate_agency") {
    return (venue.housingIds ?? []).map((id) => {
      const housing = getLifeHousing(id);
      const viewHousing = lifeView.housing.find((entry) => entry.id === id);
      return housing ? { kind: "housing", housing, view: viewHousing, canRent: Boolean(viewHousing?.canRent && canSpendMajorAction), canMove: Boolean(viewHousing?.canMove && canSpendMajorAction), canBuy: Boolean(viewHousing?.canBuy && canSpendMajorAction) } : null;
    }).filter(Boolean);
  }

  if (venue.type === "car_dealer") {
    return (venue.vehicleIds ?? []).map((id) => {
      const vehicle = getLifeVehicle(id);
      const viewVehicle = lifeView.vehicles.find((entry) => entry.id === id);
      return vehicle ? { kind: "vehicle", actionId: `buyVehicle:${id}`, vehicle, canUse: Boolean(viewVehicle?.canBuy && canSpendMajorAction), owned: Boolean(viewVehicle?.owned) } : null;
    }).filter(Boolean);
  }

  if (venue.type === "asset_store") {
    return (venue.assetIds ?? []).map((id) => {
      const asset = getLifeAsset(id);
      const viewAsset = lifeView.assets.find((entry) => entry.id === id);
      return asset ? { kind: "asset", actionId: `buyAsset:${id}`, asset, canUse: Boolean(viewAsset?.canBuy && canSpendMajorAction), owned: Boolean(viewAsset?.owned) } : null;
    }).filter(Boolean);
  }

  if (venue.type === "business_broker") {
    return getBusinessBrokerRows(venue.businessIds ?? [], career, player, venue.cityId).map((entry) => ({ kind: "business", ...entry, canBuy: Boolean(entry.canBuy && canSpendMajorAction), canUpgrade: Boolean(entry.canUpgrade && canSpendMajorAction) }));
  }

  if (venue.type === "home") {
    const inventoryRows = lifeView.inventory.map((entry) => ({ kind: "inventory", actionId: `use:${entry.item.id}`, entry, canUse: true }));
    return [
      { kind: "home_rest", actionId: "rest:home", canUse: lifeView.canRest, housing: lifeView.currentHousing },
      ...inventoryRows,
    ];
  }

  return [];
}

function isVenueActionAllowed(venue, actionId = "", career = {}) {
  const [type, id = null] = String(actionId).split(":");
  if (venue?.type === "store") return type === "buy" && (venue.inventoryIds ?? []).includes(id);
  if (["cafe", "restaurant"].includes(venue?.type)) return type === "cafe" && (venue.orderIds ?? []).includes(id);
  if (venue?.type === "job_site") return (["takeJob", "workJob", "quitJob", "job"].includes(type)) && (venue.jobIds ?? []).includes(id);
  if (venue?.type === "real_estate_agency") return ["rentHousing", "buyHousing", "moveHousing"].includes(type) && (venue.housingIds ?? []).includes(id);
  if (venue?.type === "car_dealer") return type === "buyVehicle" && (venue.vehicleIds ?? []).includes(id);
  if (venue?.type === "asset_store") return type === "buyAsset" && (venue.assetIds ?? []).includes(id);
  if (venue?.type === "business_broker") return isBusinessAction(`${type}:${id}`) && (venue.businessIds ?? []).includes(id);
  if (venue?.type === "home") return type === "rest" || type === "use";
  return false;
}

function isJobAction(actionId = "") {
  const type = String(actionId).split(":")[0];
  return ["takeJob", "workJob", "quitJob"].includes(type);
}

function getBusinessVenueActionCost(actionId = "") {
  const type = String(actionId).split(":")[0];
  if (type === "buyBusiness" || type === "upgradeBusiness") return 1;
  return 0;
}

function isBusinessAction(actionId = "") {
  const type = String(actionId).split(":")[0];
  return ["buyBusiness", "collectBusiness", "upgradeBusiness"].includes(type);
}

function markVenueVisited(career = {}, venueId) {
  const city = career.city && typeof career.city === "object" ? career.city : {};
  const visited = new Set(Array.isArray(city.visitedVenueIds) ? city.visitedVenueIds : []);
  if (venueId) visited.add(venueId);
  return {
    ...career,
    city: {
      ...city,
      activeVenueId: venueId ?? city.activeVenueId ?? null,
      visitedVenueIds: [...visited],
    },
  };
}

function sortVenue(left, right) {
  const order = {
    home: 0,
    poker: 1,
    groceries: 2,
    cafes: 3,
    restaurants: 4,
    work: 5,
    property: 6,
    business: 7,
    transport: 8,
  };
  const leftOrder = order[left.category] ?? 50;
  const rightOrder = order[right.category] ?? 50;
  if (leftOrder !== rightOrder) return leftOrder - rightOrder;
  return String(left.name ?? left.id).localeCompare(String(right.name ?? right.id));
}

function getVenueStatusLabel(statusId) {
  const labels = {
    locked: "Locked",
    open: "Open",
    current: "Current",
  };
  return labels[statusId] ?? "Open";
}
