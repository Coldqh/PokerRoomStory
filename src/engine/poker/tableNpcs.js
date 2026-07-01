import { hydrateNpc, selectTableNpcs } from "../npc.js?v=1.0.1";

export function prepareTableNpcs(content, table, club, previousTableState, count) {
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
    if (unique.length >= count) return unique;
  }

  const replacements = selectTableNpcs(content, table, club, count * 2)
    .filter((npc) => !used.has(npc.id));

  for (const npc of replacements) {
    unique.push(npc);
    used.add(npc.id);
    if (unique.length >= count) break;
  }

  return unique.slice(0, count);
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
