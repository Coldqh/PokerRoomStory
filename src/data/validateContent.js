const COLLECTIONS = [
  "countries",
  "cities",
  "clubs",
  "tables",
  "archetypes",
  "npcs",
  "glossaryTerms",
  "collections",
  "learningObjects",
  "eventTemplates",
  "challenges",
];

export function validateContentRegistry(registry) {
  const warnings = [];
  const byId = registry?.byId ?? {};

  for (const collection of COLLECTIONS) {
    warnDuplicateIds(registry?.[collection] ?? [], collection, warnings);
  }

  for (const city of registry?.cities ?? []) {
    requireRef(byId.countries, city.countryId, `city ${city.id}.countryId`, warnings);
  }

  for (const club of registry?.clubs ?? []) {
    requireRef(byId.cities, club.cityId, `club ${club.id}.cityId`, warnings);
    for (const tableId of club.tables ?? []) requireRef(byId.tables, tableId, `club ${club.id}.tables`, warnings);
    for (const npcId of club.npcPool ?? []) requireRef(byId.npcs, npcId, `club ${club.id}.npcPool`, warnings);
  }

  for (const table of registry?.tables ?? []) {
    requireRef(byId.clubs, table.clubId, `table ${table.id}.clubId`, warnings);
    validateTableRules(table, byId, warnings);
  }

  for (const npc of registry?.npcs ?? []) {
    requireRef(byId.archetypes, npc.archetypeId, `npc ${npc.id}.archetypeId`, warnings);
    if (npc.countryId) requireRef(byId.countries, npc.countryId, `npc ${npc.id}.countryId`, warnings);
    if (npc.cityId) requireRef(byId.cities, npc.cityId, `npc ${npc.id}.cityId`, warnings);
    if (npc.clubId) requireRef(byId.clubs, npc.clubId, `npc ${npc.id}.clubId`, warnings);
  }

  if (warnings.length) {
    console.warn(`[PRS content] ${warnings.length} validation warning(s)`, warnings);
  }

  return { ok: warnings.length === 0, warnings };
}

function warnDuplicateIds(items, collection, warnings) {
  const seen = new Set();
  for (const item of items) {
    if (!item?.id) {
      warnings.push(`${collection}: item without id`);
      continue;
    }
    if (seen.has(item.id)) warnings.push(`${collection}: duplicate id ${item.id}`);
    seen.add(item.id);
  }
}

function requireRef(index, id, label, warnings) {
  if (!id) {
    warnings.push(`${label}: empty reference`);
    return;
  }
  if (!index?.[id]) warnings.push(`${label}: missing reference ${id}`);
}

function validateTableRules(table, byId, warnings) {
  const rules = table.npcSelectionRules ?? {};
  for (const archetypeId of rules.archetypes ?? []) {
    requireRef(byId.archetypes, archetypeId, `table ${table.id}.npcSelectionRules.archetypes`, warnings);
  }
  if (Number(table.minBuyIn ?? 0) > Number(table.maxBuyIn ?? Infinity)) {
    warnings.push(`table ${table.id}: minBuyIn is greater than maxBuyIn`);
  }
  if (Number(table.smallBlind ?? 0) <= 0 || Number(table.bigBlind ?? 0) <= 0) {
    warnings.push(`table ${table.id}: blinds must be positive`);
  }
}
