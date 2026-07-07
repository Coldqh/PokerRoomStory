export function getGlobalPokerAtlasView(content = {}, career = {}, player = {}) {
  const countries = content?.countries ?? [];
  const cities = content?.cities ?? [];
  const unlockedCountries = new Set(career?.unlockedCountries ?? []);
  const unlockedCities = new Set(career?.unlockedCities ?? []);
  const playerBankroll = Number(player?.bankroll ?? 0) || 0;
  const playerReputation = Number(player?.reputation ?? 0) || 0;

  const countryRows = countries.map((country) => {
    const countryCities = cities
      .filter((city) => city.countryId === country.id)
      .sort((left, right) => Number(left.routeStage ?? 99) - Number(right.routeStage ?? 99) || String(left.name).localeCompare(String(right.name)));
    const plannedClubCount = countryCities.reduce((sum, city) => sum + getPlannedClubCount(city), 0);
    const unlockedCityCount = countryCities.filter((city) => isCityUnlocked(city, career, playerBankroll, playerReputation, unlockedCities)).length;
    const countryUnlocked = unlockedCountries.has(country.id) || unlockedCityCount > 0 || !country.unlockRequirement;

    return {
      country,
      status: countryUnlocked ? "open" : "locked",
      statusLabel: countryUnlocked ? "Открыто" : "Закрыто",
      plannedClubCount: plannedClubCount || Number(country.plannedClubCount ?? 0) || 0,
      cityCount: countryCities.length || Number(country.plannedCityCount ?? 0) || 0,
      unlockedCityCount,
      cities: countryCities.map((city) => buildCityRow(city, career, playerBankroll, playerReputation, unlockedCities)),
      reason: countryUnlocked ? null : getRequirementReason(country.unlockRequirement),
    };
  });

  const plannedClubCount = countryRows.reduce((sum, row) => sum + row.plannedClubCount, 0);
  const totalCities = countryRows.reduce((sum, row) => sum + row.cityCount, 0);
  const unlockedCityCount = countryRows.reduce((sum, row) => sum + row.unlockedCityCount, 0);

  return {
    countries: countryRows,
    summary: {
      countries: countries.length,
      cities: totalCities,
      plannedClubs: plannedClubCount,
      unlockedCities: unlockedCityCount,
      lockedCities: Math.max(0, totalCities - unlockedCityCount),
    },
  };
}

function buildCityRow(city, career, playerBankroll, playerReputation, unlockedCities) {
  const unlocked = isCityUnlocked(city, career, playerBankroll, playerReputation, unlockedCities);
  return {
    city,
    status: unlocked ? "open" : "locked",
    statusLabel: unlocked ? "Открыто" : "Закрыто",
    plannedClubCount: getPlannedClubCount(city),
    implementedClubCount: Math.max(0, Math.round(Number(city.clubCount ?? 0) || 0)),
    reason: unlocked ? null : getRequirementReason(city.unlockRequirement),
    anchorClubNames: city.anchorClubNames ?? [],
    futureClubNames: city.futureClubNames ?? [],
  };
}

function isCityUnlocked(city, career, playerBankroll, playerReputation, unlockedCities) {
  if (!city) return false;
  if (unlockedCities.has(city.id)) return true;
  const req = city.unlockRequirement ?? null;
  if (!req) return true;
  if (req.storyCompleted && !career?.storyProgress?.[req.storyCompleted]?.completed) return false;
  if (req.bankroll && playerBankroll < req.bankroll) return false;
  if (req.reputation && playerReputation < req.reputation) return false;
  return false;
}

function getPlannedClubCount(city) {
  return Math.max(0, Math.round(Number(city?.plannedClubCount ?? city?.clubCount ?? 0) || 0));
}

function getRequirementReason(req = null) {
  if (!req) return "Доступно.";
  if (req.reason) return req.reason;
  const parts = [];
  if (req.storyCompleted) parts.push("нужен сюжетный допуск");
  if (req.bankroll) parts.push(`$${req.bankroll} банкролла`);
  if (req.reputation) parts.push(`${req.reputation} репутации`);
  return parts.length ? `Нужно: ${parts.join(" · ")}.` : "Закрыто.";
}
