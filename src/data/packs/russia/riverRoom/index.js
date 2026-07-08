import { countries, cities } from "./countryCity.js?v=3.7.0";
import { clubs } from "./club.js?v=3.7.0";
import { tables } from "./tables.js?v=3.7.0";
import { archetypes } from "./archetypes.js?v=3.7.0";
import { npcs } from "./npcs.js?v=3.7.0";
import { glossaryTerms } from "./glossary.js?v=3.7.0";
import { collections } from "./collections.js?v=3.7.0";
import { challenges } from "./challenges.js?v=3.7.0";
import { learningObjects } from "./learning.js?v=3.7.0";
import { eventTemplates } from "./events.js?v=3.7.0";
import { storylines } from "./storylines.js?v=3.7.0";
import { venues } from "./venues.js?v=3.7.0";
import { generatedTables, generatedNpcs, generatedVenues, mergeGeneratedClubs } from "./generatedCityFill.js?v=3.7.0";
import { buildWorldStoryCampaign } from "./worldStoryCampaign.js?v=3.7.0";

const allClubs = mergeGeneratedClubs(clubs);
const allTables = [...tables.filter(Boolean), ...generatedTables];
const allStorylines = buildWorldStoryCampaign({ cities, clubs: allClubs, tables: allTables, manualStorylines: storylines });

export const russiaRiverRoomPack = {
  meta: {
    id: "PACK_CORE_V0_1",
    name: "Core v0.1 — First Local Room",
    version: "3.6.0",
  },
  countries,
  cities,
  clubs: allClubs,
  tables: allTables,
  archetypes,
  npcs: [...npcs.filter(Boolean), ...generatedNpcs],
  glossaryTerms,
  collections,
  challenges,
  learningObjects,
  eventTemplates,
  storylines: allStorylines,
  venues: [...venues.filter(Boolean), ...generatedVenues],
};
