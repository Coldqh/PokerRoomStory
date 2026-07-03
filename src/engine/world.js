import { getClubNpcs, getClubTables } from "./selectors.js?v=2.0.0";

export function getClubContext(content, clubId) {
  const club = content.byId.clubs[clubId];
  if (!club) throw new Error(`Club not found: ${clubId}`);

  const city = content.byId.cities[club.cityId];
  const country = content.byId.countries[city.countryId];
  const tables = getClubTables(content, clubId);
  const npcs = getClubNpcs(content, clubId);

  return { club, city, country, tables, npcs };
}

export function canEnterClub(player, career = {}, club) {
  if (!club) return { ok: false, reason: "Клуб не найден." };
  const req = club.unlockRequirement ?? null;

  if (req?.storyCompleted && !isStoryCompleted(career, req.storyCompleted)) {
    return { ok: false, reason: "Заверши все сцены River Room." };
  }

  const unlocked = new Set(career?.unlockedClubs ?? []);
  if (unlocked.has(club.id) || !req) return { ok: true, reason: null };

  const bankroll = Number(player?.bankroll ?? 0);
  const reputation = Number(player?.reputation ?? 0);
  if (req.bankroll && bankroll < req.bankroll) return { ok: false, reason: `Нужно минимум $${req.bankroll} банкролла.` };
  if (req.reputation && reputation < req.reputation) return { ok: false, reason: `Нужно ${req.reputation} репутации.` };
  return { ok: true, reason: null };
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

function isStoryCompleted(career = {}, storyId) {
  return Boolean(career?.storyProgress?.[storyId]?.completed);
}
