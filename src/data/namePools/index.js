import { RUSSIA_NAME_POOL } from "./russia.js?v=0.9.9";

export const DEFAULT_NAME_COUNTRY = "COUNTRY_RUSSIA";

export const NAME_POOLS = {
  COUNTRY_RUSSIA: RUSSIA_NAME_POOL,
};

export function getNamePool(countryId = DEFAULT_NAME_COUNTRY) {
  return NAME_POOLS[countryId] ?? NAME_POOLS[DEFAULT_NAME_COUNTRY];
}

export function createNpcName(countryId, index = 0) {
  const pool = getNamePool(countryId);
  const firstNames = pool.firstNames?.length ? pool.firstNames : NAME_POOLS[DEFAULT_NAME_COUNTRY].firstNames;
  const lastNames = pool.lastNames?.length ? pool.lastNames : NAME_POOLS[DEFAULT_NAME_COUNTRY].lastNames;
  const first = firstNames[wrapIndex(index, firstNames.length)];
  const last = lastNames[wrapIndex(index * 3 + Math.floor(index / Math.max(firstNames.length, 1)), lastNames.length)];
  return `${first} ${last}`;
}

export function createNpcNameRoster(countryId, count, options = {}) {
  const offset = Number(options.offset ?? 0);
  const used = new Set();
  const roster = [];
  let cursor = offset;
  let guard = 0;

  while (roster.length < count && guard < count * 20 + 100) {
    const name = createNpcName(countryId, cursor);
    if (!used.has(name)) {
      used.add(name);
      roster.push(name);
    }
    cursor += 1;
    guard += 1;
  }

  while (roster.length < count) {
    roster.push(`${createNpcName(countryId, cursor)} ${roster.length + 1}`);
    cursor += 1;
  }

  return roster;
}

function wrapIndex(index, length) {
  if (!length) return 0;
  return ((index % length) + length) % length;
}
