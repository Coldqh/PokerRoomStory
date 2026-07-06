import { getClubTables } from "./selectors.js?v=2.6.2";
import { canEnterClub } from "./world.js?v=2.6.2";
import { getClubLevelInfo } from "./progression.js?v=2.6.2";
import { getCityVenues, getVenueStatus } from "./venues.js?v=2.6.2";

export function getCityMapView(content, career = {}, player = {}, cityId = null, activeClubId = null, activeVenueId = null) {
  const activeClub = content?.byId?.clubs?.[activeClubId] ?? null;
  const resolvedCityId = cityId ?? activeClub?.cityId ?? content?.cities?.[0]?.id ?? null;
  const city = content?.byId?.cities?.[resolvedCityId] ?? content?.cities?.find((entry) => entry.id === resolvedCityId) ?? null;
  const country = city ? content?.byId?.countries?.[city.countryId] ?? null : null;
  const clubs = (content?.clubs ?? [])
    .filter((club) => !resolvedCityId || club.cityId === resolvedCityId)
    .map((club) => getClubLocationStatus(content, career, player, club, activeClubId));
  const venues = getCityVenues(content, resolvedCityId)
    .map((venue) => getVenueStatus(content, career, player, venue, activeVenueId ?? career?.city?.activeVenueId ?? null, activeClubId));

  const completed = clubs.filter((club) => club.statusId === "completed").length;
  const unlockedClubs = clubs.filter((club) => club.access.ok).length;
  const openVenues = venues.filter((entry) => entry.access.ok).length;

  return {
    city,
    country,
    clubs,
    venues,
    summary: {
      total: venues.length,
      clubs: clubs.length,
      unlocked: openVenues,
      completed,
      locked: venues.length - openVenues,
      unlockedClubs,
    },
  };
}

export function getClubLocationStatus(content, career = {}, player = {}, club = null, activeClubId = null) {
  const route = getClubRouteProgress(content, career, club?.id);
  const access = canEnterClub(player, career, club);
  const tables = getClubTables(content, club?.id);
  const mastery = getClubLevelInfo(content, career, club?.id);
  const current = activeClubId === club?.id;
  const started = route.completedSteps > 0 || route.stepIndex > 0;
  const completed = route.completed;

  let statusId = "locked";
  if (access.ok) {
    if (current) statusId = "current";
    else if (completed) statusId = "completed";
    else if (started) statusId = "in_progress";
    else statusId = "open";
  }

  return {
    club,
    access,
    tables,
    route,
    mastery,
    current,
    statusId,
    statusLabel: getStatusLabel(statusId),
    actionLabel: current ? "Текущий клуб" : access.ok ? "Перейти в клуб" : "Закрыто",
  };
}

export function getClubRouteProgress(content, career = {}, clubId = null) {
  const story = (content?.storylines ?? []).find((entry) => entry.clubId === clubId) ?? null;
  if (!story) {
    return {
      story: null,
      current: 0,
      total: 0,
      percent: 0,
      completed: false,
      completedSteps: 0,
      stepIndex: 0,
      label: "No route",
    };
  }

  const progress = career?.storyProgress?.[story.id] ?? {};
  const total = Math.max(1, story.steps?.length ?? 0);
  const completedSteps = Math.min(total, Array.isArray(progress.completedSteps) ? progress.completedSteps.length : 0);
  const completed = Boolean(progress.completed || completedSteps >= total);
  const stepIndex = completed ? total : Math.max(0, Math.min(total - 1, Number(progress.stepIndex ?? completedSteps) || 0));
  const current = completed ? total : Math.min(total, Math.max(completedSteps, stepIndex));
  const percent = Math.round((current / total) * 100);

  return {
    story,
    current,
    total,
    percent,
    completed,
    completedSteps,
    stepIndex,
    label: completed ? `${total}/${total}` : `${stepIndex + 1}/${total}`,
  };
}

function getStatusLabel(statusId) {
  const labels = {
    locked: "Locked",
    open: "Open",
    in_progress: "In Progress",
    completed: "Completed",
    current: "Current",
  };
  return labels[statusId] ?? "Open";
}
