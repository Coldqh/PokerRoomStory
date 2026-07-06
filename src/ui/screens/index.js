import { renderLifeScreen } from "./lifeScreen.js?v=2.6.2";
import { renderCityMapScreen } from "./cityMapScreen.js?v=2.6.2";
import { renderVenueScreen } from "./venueScreen.js?v=2.6.2";
import { renderClubScreen } from "./clubScreen.js?v=2.6.2";
import { renderTableScreen } from "./tableScreen.js?v=2.6.2";
import { renderCareerScreen } from "./careerScreen.js?v=2.6.2";
import { renderTasksScreen } from "./tasksScreen.js?v=2.6.2";
import { renderNpcScreen } from "./npcScreen.js?v=2.6.2";
import { renderGlossaryScreen } from "./glossaryScreen.js?v=2.6.2";
import { renderCollectionsScreen } from "./collectionsScreen.js?v=2.6.2";
import { renderSettingsScreen } from "./settingsScreen.js?v=2.6.2";
import { renderBuyInModal, renderBetAmountModal } from "./modals.js?v=2.6.2";

export const SCREENS = [
  { id: "life", label: "Жизнь" },
  { id: "locations", label: "Карта" },
  { id: "club", label: "Клуб" },
  { id: "table", label: "Стол" },
  { id: "career", label: "Карьера" },
  { id: "tasks", label: "Задания" },
  { id: "npcs", label: "Игроки" },
  { id: "glossary", label: "Словарь" },
  { id: "collections", label: "Коллекции" },
  { id: "settings", label: "Настройки" },
];

export function getVisibleScreens(state = {}) {
  const seated = Boolean(state.tableSession?.tableId);
  return SCREENS.filter((screen) => {
    if (screen.id === "table") return seated;
    if (screen.id === "club") return !seated;
    return true;
  });
}

export function renderScreen(state) {
  const seated = Boolean(state.tableSession?.tableId);
  const currentScreen = seated && state.currentScreen === "club" ? "table" : !seated && state.currentScreen === "table" ? "club" : state.currentScreen;
  let screen = "";
  if (currentScreen === "life") screen = renderLifeScreen(state);
  else if (currentScreen === "locations") screen = renderCityMapScreen(state);
  else if (currentScreen === "venue") screen = renderVenueScreen(state);
  else if (currentScreen === "club") screen = renderClubScreen(state);
  else if (currentScreen === "table") screen = renderTableScreen(state);
  else if (currentScreen === "career") screen = renderCareerScreen(state);
  else if (currentScreen === "tasks") screen = renderTasksScreen(state);
  else if (currentScreen === "npcs") screen = renderNpcScreen(state);
  else if (currentScreen === "glossary") screen = renderGlossaryScreen(state);
  else if (currentScreen === "collections") screen = renderCollectionsScreen(state);
  else if (currentScreen === "settings") screen = renderSettingsScreen(state);
  else screen = renderLifeScreen(state);
  return `${screen}${renderBuyInModal(state)}${renderBetAmountModal(state)}`;
}
