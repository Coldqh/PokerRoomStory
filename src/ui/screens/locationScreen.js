import { normalizePlayerLocation } from "../../engine/locationState.js?v=3.4.1";
import { renderCityMapScreen } from "./cityMapScreen.js?v=3.4.1";
import { renderVenueScreen } from "./venueScreen.js?v=3.4.1";
import { renderClubScreen } from "./clubScreen.js?v=3.4.1";
import { renderTableScreen } from "./tableScreen.js?v=3.4.1";

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
