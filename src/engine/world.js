import { getClubNpcs, getClubTables } from "./selectors.js?v=0.9.8";

export function getClubContext(content, clubId) {
  const club = content.byId.clubs[clubId];
  if (!club) throw new Error(`Club not found: ${clubId}`);

  const city = content.byId.cities[club.cityId];
  const country = content.byId.countries[city.countryId];
  const tables = getClubTables(content, clubId);
  const npcs = getClubNpcs(content, clubId);

  return { club, city, country, tables, npcs };
}

export function canEnterTable(player, table) {
  const bankroll = Number(player?.bankroll ?? 0);
  const req = table.unlockRequirement;

  if (table.minBuyIn && bankroll < table.minBuyIn) {
    return { ok: false, reason: `Нужен buy-in от $${table.minBuyIn}.` };
  }

  if (req?.bankroll && bankroll < req.bankroll) {
    return { ok: false, reason: `Нужно минимум $${req.bankroll} банкролла.` };
  }

  if (req?.reputation && player.reputation < req.reputation) {
    return { ok: false, reason: `Нужно ${req.reputation} репутации.` };
  }

  return { ok: true, reason: null };
}
