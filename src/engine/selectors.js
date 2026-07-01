export const FALLBACK_START_LOCATION = {
  countryId: "COUNTRY_RUSSIA",
  cityId: "CITY_RU_NORTH_DISTRICT",
  clubId: "CLUB_RU_BASEMENT_RIVER_001",
  tableId: "TABLE_RU_BRR_LOW_001",
  starterTableIds: [
    "TABLE_RU_BRR_LOW_001",
    "TABLE_RU_BRR_LOW_002",
    "TABLE_RU_BRR_MID_001",
    "TABLE_RU_BRR_LOW_003",
    "TABLE_RU_BRR_LOW_004",
  ],
};

export function getActiveClub(content, clubId) {
  return content?.byId?.clubs?.[clubId] ?? getDefaultStartLocation(content).club;
}

export function getActiveCity(content, cityId) {
  return content?.byId?.cities?.[cityId] ?? getDefaultStartLocation(content).city;
}

export function getActiveCountry(content, countryId) {
  return content?.byId?.countries?.[countryId] ?? getDefaultStartLocation(content).country;
}

export function getClubTables(content, clubId) {
  const club = getActiveClub(content, clubId);
  return (club?.tables ?? []).map((id) => content?.byId?.tables?.[id]).filter(Boolean);
}

export function getClubNpcs(content, clubId) {
  const club = getActiveClub(content, clubId);
  return (club?.npcPool ?? []).map((id) => content?.byId?.npcs?.[id]).filter(Boolean);
}

export function getUnlockedClubs(content, career = {}) {
  const unlocked = new Set(career.unlockedClubs ?? []);
  return (content?.clubs ?? []).filter((club) => unlocked.has(club.id));
}

export function getAvailableTables(content, career = {}, clubId = null) {
  const unlocked = new Set(career.unlockedTables ?? []);
  return (content?.tables ?? []).filter((table) => {
    if (clubId && table.clubId !== clubId) return false;
    return unlocked.has(table.id);
  });
}

export function getDefaultStartLocation(content, career = null) {
  const country = getFirstById(content?.byId?.countries, career?.unlockedCountries, FALLBACK_START_LOCATION.countryId);
  const city = getFirstById(content?.byId?.cities, career?.unlockedCities, FALLBACK_START_LOCATION.cityId)
    ?? (content?.cities ?? []).find((entry) => entry.countryId === country?.id);
  const club = getFirstById(content?.byId?.clubs, career?.unlockedClubs, FALLBACK_START_LOCATION.clubId)
    ?? (content?.clubs ?? []).find((entry) => entry.cityId === city?.id);
  const table = getFirstById(content?.byId?.tables, career?.unlockedTables, FALLBACK_START_LOCATION.tableId)
    ?? (content?.tables ?? []).find((entry) => entry.clubId === club?.id);

  return {
    country,
    city,
    club,
    table,
    countryId: country?.id ?? FALLBACK_START_LOCATION.countryId,
    cityId: city?.id ?? FALLBACK_START_LOCATION.cityId,
    clubId: club?.id ?? FALLBACK_START_LOCATION.clubId,
    tableId: table?.id ?? FALLBACK_START_LOCATION.tableId,
  };
}

function getFirstById(index = {}, ids = null, fallbackId = null) {
  for (const id of ids ?? []) {
    if (index[id]) return index[id];
  }
  if (fallbackId && index[fallbackId]) return index[fallbackId];
  return Object.values(index)[0] ?? null;
}
