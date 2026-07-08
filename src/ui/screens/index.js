import { renderLifeScreen } from "./lifeScreen.js?v=3.6.0";
import { renderLocationScreen } from "./locationScreen.js?v=3.6.0";
import { renderCityMapScreen } from "./cityMapScreen.js?v=3.6.0";
import { renderVenueScreen } from "./venueScreen.js?v=3.6.0";
import { renderClubScreen } from "./clubScreen.js?v=3.6.0";
import { renderTableScreen } from "./tableScreen.js?v=3.6.0";
import { renderCareerScreen } from "./careerScreen.js?v=3.6.0";
import { renderTasksScreen } from "./tasksScreen.js?v=3.6.0";
import { renderNpcScreen } from "./npcScreen.js?v=3.6.0";
import { renderGlossaryScreen } from "./glossaryScreen.js?v=3.6.0";
import { renderCollectionsScreen } from "./collectionsScreen.js?v=3.6.0";
import { renderSettingsScreen } from "./settingsScreen.js?v=3.6.0";
import { renderBuyInModal, renderBetAmountModal } from "./modals.js?v=3.6.0";

export const SCREENS = [
  { id: "life", label: "Жизнь" },
  { id: "location", label: "Местонахождение" },
  { id: "career", label: "Карьера" },
  { id: "tasks", label: "Задания" },
  { id: "npcs", label: "Игроки" },
  { id: "glossary", label: "Словарь" },
  { id: "collections", label: "Коллекции" },
  { id: "settings", label: "Настройки" },
];

export function getVisibleScreens(state = {}) {
  const legacyScreen = state?.tableSession
    ? { id: "table", label: "Стол", hiddenFromNav: true }
    : { id: "club", label: "Клуб", hiddenFromNav: true };
  return [...SCREENS, legacyScreen];
}

export function renderScreen(state) {
  const currentScreen = state.currentScreen;
  let screen = "";
  if (currentScreen === "life") screen = renderLifeScreen(state);
  else if (currentScreen === "location") screen = renderLocationScreen(state);
  else if (currentScreen === "locations") screen = renderCityMapScreen({ ...state, currentScreen: "location" });
  else if (currentScreen === "venue") screen = renderVenueScreen({ ...state, currentScreen: "location" });
  else if (currentScreen === "club") screen = renderClubScreen({ ...state, currentScreen: "location" });
  else if (currentScreen === "table") screen = renderTableScreen({ ...state, currentScreen: "location" });
  else if (currentScreen === "career") screen = renderCareerScreen(state);
  else if (currentScreen === "tasks") screen = renderTasksScreen(state);
  else if (currentScreen === "npcs") screen = renderNpcScreen(state);
  else if (currentScreen === "glossary") screen = renderGlossaryScreen(state);
  else if (currentScreen === "collections") screen = renderCollectionsScreen(state);
  else if (currentScreen === "settings") screen = renderSettingsScreen(state);
  else screen = renderLifeScreen(state);
  return `${screen}${renderBuyInModal(state)}${renderBetAmountModal(state)}`;
}
