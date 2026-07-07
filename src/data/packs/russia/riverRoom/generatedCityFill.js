const TARGET_VENUE_COUNTS = {
  home: 1,
  store: 6,
  cafe: 5,
  restaurant: 7,
  job_site: 6,
  real_estate_agency: 1,
  car_dealer: 5,
  asset_store: 1,
  business_broker: 1,
  poker_club: 3,
};

const ITEM_IDS = [
  "ITEM_WATER_BOTTLE",
  "ITEM_MINERAL_WATER",
  "ITEM_COLA",
  "ITEM_COFFEE_CAN",
  "ITEM_ENERGY_DRINK",
  "ITEM_BANANA",
  "ITEM_APPLE",
  "ITEM_NUTS",
  "ITEM_SANDWICH",
  "ITEM_READY_MEAL",
  "ITEM_SUSHI_BOX",
  "ITEM_PREMIUM_STEAK_BOX",
];

const CAFE_ORDER_IDS = [
  "CAFE_COFFEE",
  "CAFE_BREAKFAST",
  "CAFE_LUNCH",
  "ORDER_SHOKO_CAPPUCCINO",
  "ORDER_SHOKO_CHICKEN_SANDWICH",
];

const RESTAURANT_ORDER_IDS = [
  "ORDER_YAKITORIYA_ROLLS",
  "ORDER_YAKITORIYA_RAMEN",
  "ORDER_PREMIUM_TASTING",
  "ORDER_PREMIUM_STEAK",
  "ORDER_CHAIHONA_PLOV",
];

const JOB_POOLS = [
  ["JOB_DELIVERY_SHIFT"],
  ["JOB_WAREHOUSE_SHIFT", "JOB_CAFE_HELPER"],
  ["JOB_SECURITY_GUARD"],
  ["JOB_CAR_WASHER"],
  ["JOB_OFFICE_CLERK", "JOB_SHIFT_MANAGER"],
  ["JOB_GYM_TRAINER"],
];

const VEHICLE_POOL_BASIC = [
  "VEHICLE_LADA_GRANTA",
  "VEHICLE_LADA_VESTA",
  "VEHICLE_RENAULT_LOGAN",
  "VEHICLE_HYUNDAI_SOLARIS",
  "VEHICLE_KIA_RIO",
  "VEHICLE_VOLKSWAGEN_POLO",
  "VEHICLE_SKODA_RAPID",
];

const VEHICLE_POOL_MID = [
  "VEHICLE_TOYOTA_CAMRY",
  "VEHICLE_MAZDA_6",
  "VEHICLE_KIA_K5",
  "VEHICLE_HYUNDAI_SONATA",
  "VEHICLE_HAVAL_JOLION",
  "VEHICLE_GEELY_COOLRAY",
  "VEHICLE_CHERY_TIGGO_7",
  "VEHICLE_OMODA_C5",
];

const VEHICLE_POOL_PREMIUM = [
  "VEHICLE_PRADO",
  "VEHICLE_GEELY_MONJARO",
  "VEHICLE_TANK_300",
  "VEHICLE_TANK_500",
  "VEHICLE_BMW_5",
  "VEHICLE_MERCEDES_E",
  "VEHICLE_AUDI_A6",
  "VEHICLE_LEXUS_RX",
  "VEHICLE_BMW_X5",
  "VEHICLE_MERCEDES_GLE",
];

const VEHICLE_POOL_LUXURY = [
  "VEHICLE_MERCEDES_S",
  "VEHICLE_BMW_7",
  "VEHICLE_LEXUS_LX",
  "VEHICLE_PORSCHE_CAYENNE",
  "VEHICLE_RANGE_ROVER",
  "VEHICLE_MERCEDES_G",
  "VEHICLE_BENTLEY_BENTAYGA",
  "VEHICLE_ROLLS_CULLINAN",
];

const HOUSING_IDS = [
  "HOUSING_RU_MOS_BIRYULYOVO_ROOM_001",
  "HOUSING_RU_MOS_KAPOTNYA_ROOM_001",
  "HOUSING_RU_MOS_NEKRASOVKA_STUDIO_001",
  "HOUSING_RU_MOS_BUTOVO_STUDIO_001",
  "HOUSING_RU_MOS_CHERTANOVO_1ROOM_001",
  "HOUSING_RU_MOS_MITINO_2ROOM_001",
  "HOUSING_RU_MOS_DANILOVSKY_2ROOM_001",
  "HOUSING_RU_MOS_PRESNYA_2ROOM_001",
  "HOUSING_RU_MOS_KHAMOVNIKI_3ROOM_001",
  "HOUSING_RU_MOS_KHAMOVNIKI_ELITE_001",
];

const ARCHETYPES = [
  "ARCH_LOOSE_CALLER",
  "ARCH_TIGHT_NIT",
  "ARCH_TOURIST_GAMBLER",
  "ARCH_CALLING_STATION",
  "ARCH_AGGRESSIVE_REG",
  "ARCH_MATH_GRINDER",
  "ARCH_OLD_SCHOOL_REG",
  "ARCH_BANKROLL_BULLY",
];

const CLUB_TEMPLATES = [
  { suffix: "ENTRY", name: "Entry Room", tier: "C3", type: "local_room", reputationLevel: 3 },
  { suffix: "PRIVATE", name: "Private Game", tier: "C4", type: "private_room", reputationLevel: 4 },
  { suffix: "HIGH", name: "High Stakes Room", tier: "C5", type: "high_stakes_room", reputationLevel: 5 },
];

export function generateCityFillContent({ countries = [], cities = [], clubs = [], tables = [], npcs = [], venues = [] } = {}) {
  const generated = {
    clubs: [],
    tables: [],
    npcs: [],
    venues: [],
    clubTableAdditions: {},
  };

  for (const city of cities) {
    const country = countries.find((entry) => entry.id === city.countryId) ?? null;
    ensureCityClubs(generated, city, country, clubs, tables);
    ensureCityVenues(generated, city, country, clubs, venues);
  }

  return generated;
}

export function mergeGeneratedClubs(baseClubs = [], generated = {}) {
  const additions = generated.clubTableAdditions ?? {};
  return [
    ...baseClubs.filter(Boolean).map((club) => {
      const extraTables = additions[club.id] ?? [];
      if (!extraTables.length) return club;
      return {
        ...club,
        tables: [...new Set([...(club.tables ?? []), ...extraTables])],
      };
    }),
    ...(generated.clubs ?? []),
  ];
}

function ensureCityClubs(generated, city, country, baseClubs, baseTables) {
  const cityClubs = () => [...baseClubs, ...generated.clubs].filter(Boolean).filter((club) => club.cityId === city.id);

  while (cityClubs().length < 3) {
    const index = cityClubs().length;
    const club = createClub(city, country, index);
    club.npcPool = createNpcsForClub(city, country, club, index).map((npc) => npc.id);
    generated.clubs.push(club);
    generated.npcs.push(...createNpcsForClub(city, country, club, index));
  }

  while (countCityTables(cityClubs(), baseTables, generated) < 12) {
    const clubs = cityClubs();
    const club = clubs[countCityTables(clubs, baseTables, generated) % clubs.length];
    addTableToClub(generated, city, club, countCityTables(clubs, baseTables, generated));
  }
}

function ensureCityVenues(generated, city, country, baseClubs, baseVenues) {
  const cityVenues = () => [...baseVenues, ...generated.venues].filter(Boolean).filter((venue) => venue.cityId === city.id);
  const cityClubs = () => [...baseClubs, ...generated.clubs].filter(Boolean).filter((club) => club.cityId === city.id);

  for (const club of cityClubs()) {
    const hasVenue = cityVenues().some((venue) => venue.type === "poker_club" && venue.clubId === club.id);
    if (!hasVenue) generated.venues.push(createPokerVenue(city, country, club));
  }

  ensureVenueCount(generated, city, country, cityVenues, "home", TARGET_VENUE_COUNTS.home, createHomeVenue);
  ensureVenueCount(generated, city, country, cityVenues, "store", TARGET_VENUE_COUNTS.store, createStoreVenue);
  ensureVenueCount(generated, city, country, cityVenues, "cafe", TARGET_VENUE_COUNTS.cafe, createCafeVenue);
  ensureVenueCount(generated, city, country, cityVenues, "restaurant", TARGET_VENUE_COUNTS.restaurant, createRestaurantVenue);
  ensureVenueCount(generated, city, country, cityVenues, "job_site", TARGET_VENUE_COUNTS.job_site, createJobVenue);
  ensureVenueCount(generated, city, country, cityVenues, "real_estate_agency", TARGET_VENUE_COUNTS.real_estate_agency, createRealEstateVenue);
  ensureVenueCount(generated, city, country, cityVenues, "car_dealer", TARGET_VENUE_COUNTS.car_dealer, createCarDealerVenue);
  ensureVenueCount(generated, city, country, cityVenues, "asset_store", TARGET_VENUE_COUNTS.asset_store, createAssetStoreVenue);
  ensureVenueCount(generated, city, country, cityVenues, "business_broker", TARGET_VENUE_COUNTS.business_broker, createBusinessBrokerVenue);
}

function ensureVenueCount(generated, city, country, cityVenues, type, target, factory) {
  while (cityVenues().filter((venue) => venue.type === type).length < target) {
    const index = cityVenues().filter((venue) => venue.type === type).length;
    generated.venues.push(factory(city, country, index));
  }
}

function createClub(city, country, index) {
  const template = CLUB_TEMPLATES[index] ?? CLUB_TEMPLATES.at(-1);
  const slug = slugify(city.id);
  const cityName = city.name ?? "City";
  const bigBlind = getBigBlind(city, index);
  return {
    id: `CLUB_GEN_${slug}_${template.suffix}_001`,
    cityId: city.id,
    name: `${cityName} ${template.name}`,
    tier: template.tier,
    type: template.type,
    styleTags: ["generated_city", "filled_city", template.type],
    reputationLevel: template.reputationLevel,
    minBuyIn: bigBlind * 50,
    maxBuyIn: bigBlind * 600,
    availableGames: ["POKER_TEXAS_HOLDEM"],
    tables: [],
    npcPool: [],
    eventTags: ["generated_city", "city_fill"],
    unlockRequirement: null,
    visualTheme: "international_red_black_room",
    glossaryPackId: "GLOSSARY_CORE_POKER_RU_V0_1",
    collectionPackId: "COLLECTION_CORE_V0_1",
    progression: { maxLevel: 6, levels: [] },
    description: `??????????????? ????????? ????: ${cityName}.`,
  };
}

function addTableToClub(generated, city, club, tableIndex) {
  const slug = slugify(city.id);
  const clubSlug = slugify(club.id).slice(0, 42);
  const id = `TABLE_FILL_${slug}_${clubSlug}_${String(tableIndex + 1).padStart(3, "0")}`;
  const bigBlind = getBigBlind(city, tableIndex % 3);
  const smallBlind = Math.max(1, Math.round(bigBlind / 2));

  generated.tables.push({
    id,
    clubId: club.id,
    name: `City Table ${tableIndex + 1}`,
    gameType: "POKER_TEXAS_HOLDEM",
    gameLabel: `$${smallBlind}/$${bigBlind} NL Hold?em`,
    limitType: "No Limit Hold?em",
    smallBlind,
    bigBlind,
    minBuyIn: bigBlind * 50,
    maxBuyIn: bigBlind * 300,
    recommendedBuyIn: bigBlind * 100,
    seats: 6,
    occupiedSeats: 5,
    avgPot: bigBlind * 18,
    handsPerHour: 24 + (tableIndex % 7),
    tableNumber: tableIndex + 1,
    difficulty: Math.max(1, Math.min(7, Number(city.tier ?? 1) + (tableIndex % 3))),
    tableMood: "generated_city",
    tableProfileLabel: "????????? ???? ? ?????????? ??????",
    seatProfile: { minPlayers: 4, maxPlayers: 6 },
    npcSelectionRules: {
      tiers: ["T1", "T2", "T3"],
      archetypes: ARCHETYPES,
    },
    specialRules: [],
    unlockRequirement: null,
  });

  if (String(club.id).startsWith("CLUB_GEN_")) {
    club.tables.push(id);
  } else {
    generated.clubTableAdditions[club.id] = [...(generated.clubTableAdditions[club.id] ?? []), id];
  }
}

function createNpcsForClub(city, country, club, clubIndex) {
  return Array.from({ length: 9 }, (_, index) => ({
    id: `NPC_GEN_${slugify(city.id)}_${clubIndex + 1}_${String(index + 1).padStart(3, "0")}`,
    name: `${city.name} Player ${clubIndex + 1}-${index + 1}`,
    tier: index < 2 ? "T3" : index < 5 ? "T2" : "T1",
    countryId: city.countryId,
    cityId: city.id,
    clubId: club.id,
    homeClubId: club.id,
    currentLocation: club.id,
    status: "active",
    bankroll: getBigBlind(city, clubIndex) * (80 + index * 20),
    skillLevel: Math.max(20, Math.min(88, Number(city.tier ?? 1) * 9 + 20 + index * 4)),
    preferredGame: "POKER_TEXAS_HOLDEM",
    preferredLimit: "generated",
    archetypeId: ARCHETYPES[index % ARCHETYPES.length],
    reputation: Number(city.tier ?? 1) * 8 + index * 2,
    fame: Number(city.tier ?? 1) * 4 + index,
    relationshipToPlayer: 0,
    careerState: "city_regular",
    knownFor: "????????? ???????",
    personalityTags: ["generated_city", country?.id ?? city.countryId],
  }));
}

function createPokerVenue(city, country, club) {
  return {
    id: `VENUE_CLUB_${slugify(club.id)}`,
    countryId: city.countryId,
    cityId: city.id,
    type: "poker_club",
    name: club.name,
    category: "poker",
    clubId: club.id,
    unlockRequirement: club.unlockRequirement ?? null,
  };
}

function createHomeVenue(city, country, index) {
  return {
    id: `VENUE_FILL_${slugify(city.id)}_HOME_${index + 1}`,
    countryId: city.countryId,
    cityId: city.id,
    type: "home",
    name: `${city.name} Room`,
    category: "home",
    district: city.districtName ?? "Center",
    address: "Local block 1",
    housingId: "travel_hotel",
    actionIds: ["rest:home"],
    unlockRequirement: null,
  };
}

function createStoreVenue(city, country, index) {
  const names = ["Corner Market", "City Mini Store", "Premium Market", "Night Store", "Fresh Shop", "Station Store"];
  return {
    id: `VENUE_FILL_${slugify(city.id)}_STORE_${index + 1}`,
    countryId: city.countryId,
    cityId: city.id,
    type: "store",
    name: `${city.name} ${names[index] ?? "Store"}`,
    category: "groceries",
    district: city.districtName ?? "Center",
    address: `Local store block ${index + 1}`,
    inventoryIds: ITEM_IDS,
    unlockRequirement: null,
  };
}

function createCafeVenue(city, country, index) {
  const names = ["Cheap Cafe", "Station Coffee", "Worker Cafe", "Premium Coffee", "Late Cafe"];
  return {
    id: `VENUE_FILL_${slugify(city.id)}_CAFE_${index + 1}`,
    countryId: city.countryId,
    cityId: city.id,
    type: "cafe",
    name: `${city.name} ${names[index] ?? "Cafe"}`,
    category: "cafes",
    district: city.districtName ?? "Center",
    address: `Cafe block ${index + 1}`,
    orderIds: CAFE_ORDER_IDS,
    unlockRequirement: null,
  };
}

function createRestaurantVenue(city, country, index) {
  const names = ["Diner", "Grill", "Noodle House", "Premium Dining", "Night Kitchen", "Local Restaurant", "High Room Dining"];
  return {
    id: `VENUE_FILL_${slugify(city.id)}_RESTAURANT_${index + 1}`,
    countryId: city.countryId,
    cityId: city.id,
    type: "restaurant",
    name: `${city.name} ${names[index] ?? "Restaurant"}`,
    category: "restaurants",
    district: city.districtName ?? "Center",
    address: `Restaurant block ${index + 1}`,
    orderIds: RESTAURANT_ORDER_IDS,
    unlockRequirement: null,
  };
}

function createJobVenue(city, country, index) {
  const names = ["Delivery Office", "Warehouse Yard", "Security Office", "Car Wash", "Office Jobs", "Fitness Jobs"];
  return {
    id: `VENUE_FILL_${slugify(city.id)}_JOB_${index + 1}`,
    countryId: city.countryId,
    cityId: city.id,
    type: "job_site",
    name: `${city.name} ${names[index] ?? "Work Site"}`,
    category: "work",
    district: city.districtName ?? "Center",
    address: `Work block ${index + 1}`,
    jobIds: JOB_POOLS[index % JOB_POOLS.length],
    unlockRequirement: null,
  };
}

function createRealEstateVenue(city, country, index) {
  return {
    id: `VENUE_FILL_${slugify(city.id)}_REAL_ESTATE_${index + 1}`,
    countryId: city.countryId,
    cityId: city.id,
    type: "real_estate_agency",
    name: `${city.name} Real Estate`,
    category: "property",
    housingIds: HOUSING_IDS,
    unlockRequirement: null,
  };
}

function createCarDealerVenue(city, country, index) {
  const pools = [VEHICLE_POOL_BASIC, VEHICLE_POOL_MID, VEHICLE_POOL_PREMIUM, VEHICLE_POOL_LUXURY, [...VEHICLE_POOL_BASIC, ...VEHICLE_POOL_MID]];
  const names = ["Used Motors", "City Auto Mall", "Premium Auto", "Luxury Motors", "Car Dealer"];
  return {
    id: `VENUE_FILL_${slugify(city.id)}_CARS_${index + 1}`,
    countryId: city.countryId,
    cityId: city.id,
    type: "car_dealer",
    name: `${city.name} ${names[index] ?? "Motors"}`,
    category: "transport",
    district: city.districtName ?? "Center",
    address: `Auto block ${index + 1}`,
    vehicleIds: pools[index % pools.length],
    unlockRequirement: null,
  };
}

function createAssetStoreVenue(city, country, index) {
  return {
    id: `VENUE_FILL_${slugify(city.id)}_ASSETS_${index + 1}`,
    countryId: city.countryId,
    cityId: city.id,
    type: "asset_store",
    name: `${city.name} Lifestyle Store`,
    category: "property",
    assetIds: ["ASSET_PHONE", "ASSET_LAPTOP", "ASSET_WATCH"],
    unlockRequirement: null,
  };
}

function createBusinessBrokerVenue(city, country, index) {
  return {
    id: `VENUE_FILL_${slugify(city.id)}_BUSINESS_BROKER_${index + 1}`,
    countryId: city.countryId,
    cityId: city.id,
    type: "business_broker",
    name: `${city.name} Deal Office`,
    category: "business",
    district: city.districtName ?? "Center",
    address: "Business block 1",
    businessIds: Array.from({ length: 8 }, (_, businessIndex) => `BUS_GEN_${slugify(city.id)}_${String(businessIndex + 1).padStart(3, "0")}`),
    unlockRequirement: null,
  };
}

function countCityTables(cityClubs, baseTables, generated) {
  return cityClubs.filter(Boolean).reduce((sum, club) => {
    const baseCount = (baseTables ?? []).filter(Boolean).filter((table) => table.clubId === club.id).length;
    const generatedCount = (generated.tables ?? []).filter(Boolean).filter((table) => table.clubId === club.id).length;
    return sum + baseCount + generatedCount;
  }, 0);
}

function getBigBlind(city, offset = 0) {
  const tier = Math.max(1, Math.min(7, Number(city.tier ?? 1) || 1));
  const base = [2, 5, 10, 20, 50, 100, 200][tier - 1] ?? 2;
  return base * (offset + 1);
}

function slugify(value) {
  return String(value ?? "GEN")
    .replace(/^CITY_/, "")
    .replace(/^CLUB_/, "")
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
}
