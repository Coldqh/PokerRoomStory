export const HOME_VENUE_ID = "VENUE_RU_MOS_HOME_CHEAP_ROOM";

export function createHomeLocation(content = null) {
  const venue = getVenue(content, HOME_VENUE_ID);
  return {
    type: "home",
    countryId: venue?.countryId ?? "COUNTRY_RUSSIA",
    cityId: venue?.cityId ?? "CITY_RU_NORTH_DISTRICT",
    venueId: venue?.id ?? HOME_VENUE_ID,
    clubId: null,
    tableId: null,
  };
}

export function createCityLocation(content = null, cityId = null) {
  const city = getCity(content, cityId) ?? getDefaultCity(content);
  return {
    type: "city",
    countryId: city?.countryId ?? "COUNTRY_RUSSIA",
    cityId: city?.id ?? cityId ?? "CITY_RU_NORTH_DISTRICT",
    venueId: null,
    clubId: null,
    tableId: null,
  };
}

export function createVenueLocation(content = null, venueId = null) {
  const venue = getVenue(content, venueId) ?? getVenue(content, HOME_VENUE_ID);
  if (!venue || venue.type === "home") return createHomeLocation(content);
  return {
    type: "venue",
    countryId: venue.countryId ?? "COUNTRY_RUSSIA",
    cityId: venue.cityId ?? "CITY_RU_NORTH_DISTRICT",
    venueId: venue.id,
    clubId: venue.clubId ?? null,
    tableId: null,
  };
}

export function createClubLocation(content = null, clubId = null) {
  const club = getClub(content, clubId);
  const venue = getClubVenue(content, club?.id ?? clubId);
  const cityId = club?.cityId ?? venue?.cityId ?? "CITY_RU_NORTH_DISTRICT";
  const city = getCity(content, cityId);
  return {
    type: "club",
    countryId: city?.countryId ?? venue?.countryId ?? "COUNTRY_RUSSIA",
    cityId,
    venueId: venue?.id ?? null,
    clubId: club?.id ?? clubId ?? null,
    tableId: null,
  };
}

export function createTableLocation(content = null, clubId = null, tableId = null) {
  const table = getTable(content, tableId);
  const resolvedClubId = table?.clubId ?? clubId ?? null;
  const clubLocation = createClubLocation(content, resolvedClubId);
  return {
    ...clubLocation,
    type: "table",
    tableId: table?.id ?? tableId ?? null,
  };
}

export function normalizePlayerLocation(content = null, location = null, fallback = {}) {
  if (fallback.tableSession?.tableId) {
    return createTableLocation(content, fallback.activeClubId, fallback.tableSession.tableId);
  }

  const raw = location && typeof location === "object" ? location : {};
  if (raw.type === "table" && raw.tableId) return createTableLocation(content, raw.clubId ?? fallback.activeClubId, raw.tableId);
  if (raw.type === "club" && raw.clubId) return createClubLocation(content, raw.clubId);
  if (raw.type === "venue" && raw.venueId) return createVenueLocation(content, raw.venueId);
  if (raw.type === "home") return createHomeLocation(content);
  if (raw.type === "city") return createCityLocation(content, raw.cityId ?? fallback.cityId);

  if (fallback.activeVenueId) {
    const venue = getVenue(content, fallback.activeVenueId);
    if (venue?.type === "home") return createHomeLocation(content);
    if (venue) return createVenueLocation(content, venue.id);
  }

  if (fallback.activeClubId) return createClubLocation(content, fallback.activeClubId);
  return createHomeLocation(content);
}

export function getLocationLabel(content = null, location = null) {
  const safe = normalizePlayerLocation(content, location);
  if (safe.type === "home") return "Дом";
  if (safe.type === "city") return getCity(content, safe.cityId)?.name ?? "Город";
  if (safe.type === "venue") return getVenue(content, safe.venueId)?.name ?? "Объект";
  if (safe.type === "club") return getClub(content, safe.clubId)?.name ?? "Клуб";
  if (safe.type === "table") return getTable(content, safe.tableId)?.name ?? "Стол";
  return "Местонахождение";
}

export function getLocationCityId(content = null, location = null) {
  return normalizePlayerLocation(content, location).cityId ?? getDefaultCity(content)?.id ?? "CITY_RU_NORTH_DISTRICT";
}

function getVenue(content, venueId) {
  return content?.byId?.venues?.[venueId] ?? (content?.venues ?? []).find((venue) => venue.id === venueId) ?? null;
}

function getClub(content, clubId) {
  return content?.byId?.clubs?.[clubId] ?? (content?.clubs ?? []).find((club) => club.id === clubId) ?? null;
}

function getTable(content, tableId) {
  return content?.byId?.tables?.[tableId] ?? (content?.tables ?? []).find((table) => table.id === tableId) ?? null;
}

function getCity(content, cityId) {
  return content?.byId?.cities?.[cityId] ?? (content?.cities ?? []).find((city) => city.id === cityId) ?? null;
}

function getDefaultCity(content) {
  return (content?.cities ?? [])[0] ?? null;
}

function getClubVenue(content, clubId) {
  return (content?.venues ?? []).find((venue) => venue.type === "poker_club" && venue.clubId === clubId) ?? null;
}
