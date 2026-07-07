import { hydrateNpc, selectTableNpcs } from "../npc.js?v=3.5.0";

const DEFAULT_MIN_NPCS = 1;
const DEFAULT_MAX_NPCS = 5;
const MAX_TURNOVER_PER_HAND = 2;

export function prepareDynamicTableNpcs(content, table, club, previousTableState = null, clubSnapshot = null) {
  const targetNpcCount = getTargetNpcCountForHand({ table, previousTableState, clubSnapshot });
  const previousSeats = Array.isArray(previousTableState?.npcSeats) ? previousTableState.npcSeats : [];
  const previousIds = previousSeats
    .map((seat) => seat?.npc?.id ?? seat?.npcId ?? seat?.id)
    .filter(Boolean);
  const handsAtTable = Number(previousTableState?.tableDynamics?.handsAtTable ?? 0) + 1;
  const direction = getNextSeatCountDirection(table, previousTableState, clubSnapshot);
  const departingIds = chooseDepartingNpcIds(previousSeats, previousTableState?.lastResult, targetNpcCount, handsAtTable);
  const departing = new Set(departingIds);

  const reused = previousIds
    .filter((id) => !departing.has(id))
    .map((id) => content.byId.npcs[id])
    .filter(Boolean)
    .filter((npc) => canNpcSitAtTable(npc, table))
    .map((npc) => hydrateNpc(content, npc));

  const unique = [];
  const used = new Set();

  for (const npc of reused) {
    if (used.has(npc.id)) continue;
    unique.push(npc);
    used.add(npc.id);
    if (unique.length >= targetNpcCount) break;
  }

  const replacements = selectTableNpcs(content, table, club, Math.max(targetNpcCount * 3, 8))
    .filter((npc) => !used.has(npc.id) && !departing.has(npc.id));

  for (const npc of replacements) {
    unique.push(npc);
    used.add(npc.id);
    if (unique.length >= targetNpcCount) break;
  }

  const npcs = unique.slice(0, targetNpcCount);
  const nextIds = new Set(npcs.map((npc) => npc.id));
  const joinedNpcIds = npcs.map((npc) => npc.id).filter((id) => !previousIds.includes(id));
  const finalDepartedNpcIds = previousIds.filter((id) => !nextIds.has(id));

  return {
    npcs,
    dynamics: {
      handsAtTable,
      targetNpcCount: npcs.length,
      previousNpcCount: previousIds.length || null,
      minNpcCount: getMinNpcCount(table),
      maxNpcCount: getMaxNpcCount(table),
      direction,
      departedNpcIds: finalDepartedNpcIds,
      joinedNpcIds: joinedNpcIds,
    },
  };
}

export function prepareTableNpcs(content, table, club, previousTableState, count) {
  const target = clampNpcCount(count, table);
  const previousIds = (previousTableState?.npcSeats ?? [])
    .map((seat) => seat?.npc?.id ?? seat?.npcId ?? seat?.id)
    .filter(Boolean);

  const reused = previousIds
    .map((id) => content.byId.npcs[id])
    .filter(Boolean)
    .filter((npc) => canNpcSitAtTable(npc, table))
    .map((npc) => hydrateNpc(content, npc));

  const unique = [];
  const used = new Set();

  for (const npc of reused) {
    if (used.has(npc.id)) continue;
    unique.push(npc);
    used.add(npc.id);
    if (unique.length >= target) return unique;
  }

  const replacements = selectTableNpcs(content, table, club, Math.max(target * 2, 6))
    .filter((npc) => !used.has(npc.id));

  for (const npc of replacements) {
    unique.push(npc);
    used.add(npc.id);
    if (unique.length >= target) break;
  }

  return unique.slice(0, target);
}

export function getTargetNpcCountForHand({ table, previousTableState = null, clubSnapshot = null } = {}) {
  const minNpcCount = getMinNpcCount(table);
  const maxNpcCount = getMaxNpcCount(table);
  const previousNpcCount = Array.isArray(previousTableState?.npcSeats) ? previousTableState.npcSeats.length : null;

  if (!previousNpcCount) {
    return getInitialNpcCount(table, clubSnapshot);
  }

  const handsAtTable = Number(previousTableState?.tableDynamics?.handsAtTable ?? 0) + 1;
  const direction = getNextSeatCountDirection(table, previousTableState, clubSnapshot);
  const tone = clubSnapshot?.activeEvent?.tone ?? previousTableState?.clubEvent?.tone ?? "normal";
  let next = previousNpcCount;

  const shouldMove = handsAtTable % 3 === 0 || (tone === "loose" && handsAtTable % 2 === 0) || (tone === "tight" && handsAtTable % 4 === 0);
  if (shouldMove) next += direction;

  if (next < minNpcCount || next > maxNpcCount) {
    next = previousNpcCount - direction;
  }

  return clampNpcCount(next, table);
}

export function canNpcSitAtTable(npc, table) {
  const rules = table?.npcSelectionRules ?? {};
  if (rules.tiers?.length && !rules.tiers.includes(npc.tier)) return false;
  return true;
}

export function getNextButtonIndex(totalSeats, previousButtonIndex = null) {
  if (totalSeats <= 0) return 0;
  if (Number.isInteger(previousButtonIndex)) return normalizeIndex(previousButtonIndex + 1, totalSeats);
  return Math.floor(Math.random() * totalSeats);
}

export function normalizeIndex(index, total) {
  return ((index % total) + total) % total;
}

function getInitialNpcCount(table, clubSnapshot = null) {
  const maxNpcCount = getMaxNpcCount(table);
  const tone = clubSnapshot?.activeEvent?.tone ?? "normal";
  const hash = stableHash(`${table?.id ?? "table"}:${clubSnapshot?.day ?? 1}:${tone}`);

  if (tone === "loose" || tone === "hot") return clampNpcCount(maxNpcCount - (hash % 2), table);
  if (tone === "tight" || tone === "focused") return clampNpcCount(1 + (hash % Math.min(3, maxNpcCount)), table);

  const minNpcCount = getMinNpcCount(table);
  const spread = Math.max(1, maxNpcCount - minNpcCount + 1);
  return clampNpcCount(minNpcCount + (hash % spread), table);
}

function getNextSeatCountDirection(table, previousTableState = null, clubSnapshot = null) {
  const previousDirection = Number(previousTableState?.tableDynamics?.direction ?? 0);
  const previousNpcCount = Array.isArray(previousTableState?.npcSeats) ? previousTableState.npcSeats.length : null;
  const minNpcCount = getMinNpcCount(table);
  const maxNpcCount = getMaxNpcCount(table);

  if (previousNpcCount && previousDirection) {
    if (previousNpcCount <= minNpcCount && previousDirection < 0) return 1;
    if (previousNpcCount >= maxNpcCount && previousDirection > 0) return -1;
    return previousDirection;
  }

  const tone = clubSnapshot?.activeEvent?.tone ?? previousTableState?.clubEvent?.tone ?? "normal";
  if (tone === "loose" || tone === "hot") return 1;
  if (tone === "tight") return -1;
  return stableHash(`${table?.id ?? "table"}:${clubSnapshot?.day ?? 1}`) % 2 === 0 ? 1 : -1;
}

function chooseDepartingNpcIds(previousSeats = [], result = null, targetNpcCount = DEFAULT_MIN_NPCS, handsAtTable = 1) {
  if (!previousSeats.length) return [];

  const previousCount = previousSeats.length;
  const bustedIds = previousSeats
    .filter((seat) => seat?.id && seat.id !== "player" && Number(seat.stack ?? 0) <= 0)
    .map((seat) => seat.id);
  const bustedSet = new Set(bustedIds);
  const remainingAfterBusted = Math.max(0, previousCount - bustedIds.length);
  const forcedVoluntaryDepartures = Math.max(0, remainingAfterBusted - targetNpcCount);
  const softTurnover = forcedVoluntaryDepartures === 0 && remainingAfterBusted >= targetNpcCount && handsAtTable > 1 && handsAtTable % 3 === 1 ? 1 : 0;
  const voluntaryLimit = Math.min(MAX_TURNOVER_PER_HAND, Math.max(0, forcedVoluntaryDepartures + softTurnover));

  const ranked = [...previousSeats]
    .filter((seat) => seat?.id && seat.id !== "player" && !bustedSet.has(seat.id))
    .map((seat) => ({ seat, score: getLeaveScore(seat, result) }))
    .sort((a, b) => b.score - a.score);

  const voluntary = ranked.slice(0, voluntaryLimit).map((entry) => entry.seat.id);
  return [...bustedIds, ...voluntary];
}

function getLeaveScore(seat, result) {
  const winnerIds = new Set(String(result?.winnerId ?? result?.winner ?? "").split(",").filter(Boolean));
  const archetypeId = seat?.npc?.archetypeId ?? seat?.archetypeId ?? "";
  let score = 10;

  if (seat.folded) score += 12;
  if (seat.stack <= 0) score += 28;
  else if (seat.stack < 20) score += 15;
  if (winnerIds.has(seat.id)) score -= 18;
  if (archetypeId === "ARCH_TOURIST_GAMBLER") score += 10;
  if (archetypeId === "ARCH_CALLING_STATION") score -= 4;
  if (archetypeId === "ARCH_OLD_SCHOOL_REG" || archetypeId === "ARCH_MATH_GRINDER") score -= 8;
  if (seat.mood === "tilted") score += 8;
  if (seat.mood === "locked") score -= 6;

  return score;
}

function getMaxNpcCount(table) {
  const seatCap = clamp(Math.round(Number(table?.seats ?? 6) || 6), 2, 6);
  const profileMax = Math.round(Number(table?.seatProfile?.maxPlayers ?? table?.maxPlayers ?? seatCap) || seatCap);
  const totalMax = clamp(Math.min(seatCap, profileMax), 2, seatCap);
  return clamp(totalMax - 1, DEFAULT_MIN_NPCS, DEFAULT_MAX_NPCS);
}

function getMinNpcCount(table) {
  const seatCap = clamp(Math.round(Number(table?.seats ?? 6) || 6), 2, 6);
  const maxNpcCount = getMaxNpcCount(table);
  const maxTotalPlayers = maxNpcCount + 1;
  const profileMin = Math.round(Number(table?.seatProfile?.minPlayers ?? table?.minPlayers ?? 2) || 2);
  const totalMin = clamp(profileMin, 2, Math.min(seatCap, maxTotalPlayers));
  return clamp(totalMin - 1, DEFAULT_MIN_NPCS, maxNpcCount);
}

function clampNpcCount(value, table) {
  const minNpcCount = getMinNpcCount(table);
  return clamp(Math.round(Number(value) || minNpcCount), minNpcCount, getMaxNpcCount(table));
}

function stableHash(value) {
  let hash = 0;
  for (const char of String(value)) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
