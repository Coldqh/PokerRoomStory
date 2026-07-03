import { DATA_PACKS } from "./packs/index.js?v=2.5.0";
import { validateContentRegistry } from "./validateContent.js?v=2.5.0";

const packs = DATA_PACKS;

function flattenContent(collectionName) {
  return packs.flatMap((pack) => pack[collectionName] ?? []);
}

export function buildContentRegistry() {
  const registry = {
    packs,
    countries: flattenContent("countries"),
    cities: flattenContent("cities"),
    clubs: flattenContent("clubs"),
    tables: flattenContent("tables"),
    archetypes: flattenContent("archetypes"),
    npcs: flattenContent("npcs"),
    glossaryTerms: flattenContent("glossaryTerms"),
    collections: flattenContent("collections"),
    learningObjects: flattenContent("learningObjects"),
    eventTemplates: flattenContent("eventTemplates"),
    challenges: flattenContent("challenges"),
    storylines: flattenContent("storylines"),
    venues: flattenContent("venues"),
  };

  registry.byId = {
    countries: indexById(registry.countries),
    cities: indexById(registry.cities),
    clubs: indexById(registry.clubs),
    tables: indexById(registry.tables),
    archetypes: indexById(registry.archetypes),
    npcs: indexById(registry.npcs),
    glossaryTerms: indexById(registry.glossaryTerms),
    collections: indexById(registry.collections),
    learningObjects: indexById(registry.learningObjects),
    eventTemplates: indexById(registry.eventTemplates),
    challenges: indexById(registry.challenges),
    storylines: indexById(registry.storylines),
    venues: indexById(registry.venues),
  };

  registry.validation = validateContentRegistry(registry);

  return registry;
}

function indexById(items) {
  return Object.fromEntries(items.map((item) => [item.id, item]));
}
