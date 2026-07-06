import { normalizePlayerLocation } from "../../engine/locationState.js?v=2.9.0";
import { renderCityMapScreen } from "./cityMapScreen.js?v=2.9.0";
import { renderVenueScreen } from "./venueScreen.js?v=2.9.0";
import { renderClubScreen } from "./clubScreen.js?v=2.9.0";
import { renderTableScreen } from "./tableScreen.js?v=2.9.0";

export function renderLocationScreen(state) {
  const location = normalizePlayerLocation(state.content, state.playerLocation, state);
  if (location.type === "table") {
    return renderTableScreen({
      ...state,
      currentScreen: "location",
      activeClubId: location.clubId ?? state.activeClubId,
      activeTableId: location.tableId ?? state.activeTableId,
    });
  }

  if (location.type === "club") {
    return renderClubScreen({
      ...state,
      currentScreen: "location",
      activeClubId: location.clubId ?? state.activeClubId,
    });
  }

  if (location.type === "venue" || location.type === "home") {
    return renderVenueScreen({
      ...state,
      currentScreen: "location",
      activeVenueId: location.venueId ?? state.activeVenueId,
    });
  }

  return renderCityMapScreen({
    ...state,
    currentScreen: "location",
  });
}
