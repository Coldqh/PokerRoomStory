import { renderClubScreen } from "./clubScreen.js?v=0.9.8";
import { renderTableScreen } from "./tableScreen.js?v=0.9.8";
import { renderCareerScreen } from "./careerScreen.js?v=0.9.8";
import { renderTasksScreen } from "./tasksScreen.js?v=0.9.8";
import { renderNpcScreen } from "./npcScreen.js?v=0.9.8";
import { renderGlossaryScreen } from "./glossaryScreen.js?v=0.9.8";
import { renderCollectionsScreen } from "./collectionsScreen.js?v=0.9.8";
import { renderSettingsScreen } from "./settingsScreen.js?v=0.9.8";
import { renderBuyInModal, renderBetAmountModal } from "./modals.js?v=0.9.8";

export const SCREENS = [
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
  if (currentScreen === "club") screen = renderClubScreen(state);
  else if (currentScreen === "table") screen = renderTableScreen(state);
  else if (currentScreen === "career") screen = renderCareerScreen(state);
  else if (currentScreen === "tasks") screen = renderTasksScreen(state);
  else if (currentScreen === "npcs") screen = renderNpcScreen(state);
  else if (currentScreen === "glossary") screen = renderGlossaryScreen(state);
  else if (currentScreen === "collections") screen = renderCollectionsScreen(state);
  else if (currentScreen === "settings") screen = renderSettingsScreen(state);
  else screen = renderClubScreen(state);
  return `${screen}${renderBuyInModal(state)}${renderBetAmountModal(state)}`;
}
