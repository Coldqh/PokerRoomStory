const SAVE_KEY = "poker-room-story-v0-1-save";

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.warn("Save load failed", error);
    return null;
  }
}

export function saveGame(state) {
  const safeState = {
    player: state.player,
    career: state.career,
    knownNpcIds: state.knownNpcIds,
    clubNpcState: state.clubNpcState,
    tableState: serializeTableState(state.tableState),
    currentScreen: state.currentScreen,
    activeClubId: state.activeClubId,
    activeTableId: state.activeTableId,
    log: state.log.slice(-80),
  };

  localStorage.setItem(SAVE_KEY, JSON.stringify(safeState));
}

export function clearSave() {
  localStorage.removeItem(SAVE_KEY);
}

function serializeTableState(tableState) {
  if (!tableState) return null;
  return {
    ...tableState,
    deck: [],
  };
}
