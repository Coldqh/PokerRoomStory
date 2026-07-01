import { buildContentRegistry } from "../src/data/contentRegistry.js?v=1.0.1";
import { createNewCareer, createNewPlayer, ensureActiveChallenges } from "../src/engine/career.js?v=1.0.1";
import { createClubRoomState } from "../src/engine/club.js?v=1.0.1";
import { getDefaultStartLocation } from "../src/engine/selectors.js?v=1.0.1";
import {
  advanceUntilPlayerOrEnd,
  applyPlayerAction,
  buildStartHandTimeline,
  createInitialTableState,
  getActionMeta,
  getAvailableActions,
  startNewHand,
} from "../src/engine/poker.js?v=1.0.1";
import { renderScreen, getVisibleScreens } from "../src/ui/screens.js?v=1.0.1";

const TEST_HANDS = 100;
const MAX_PLAYER_DECISIONS_PER_HAND = 20;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertNotIncludes(value, needle, message) {
  assert(!String(value).includes(needle), message);
}

function makeBaseState(content, tableState = createInitialTableState(), patch = {}) {
  const career = ensureActiveChallenges(content, createNewCareer());
  const player = createNewPlayer();
  const start = getDefaultStartLocation(content, career);
  return {
    content,
    player,
    career,
    knownNpcIds: [],
    clubNpcState: {
      [start.clubId]: createClubRoomState(content, start.clubId),
    },
    currentScreen: patch.currentScreen ?? "club",
    activeClubId: start.clubId,
    activeTableId: start.tableId,
    tableSession: patch.tableSession ?? null,
    tableState,
    log: [],
    settings: { animationSpeed: "instant" },
    system: {
      appVersion: "1.0.1",
      resultModalOpen: false,
      buyInModal: null,
      betAmountModal: null,
      online: true,
      controlled: false,
      serviceWorker: false,
    },
    ...patch,
  };
}

function startTestHand(content, table, club, previousTableState = null) {
  return startNewHand({
    content,
    table,
    club,
    previousTableState,
    clubSnapshot: null,
    player: {
      ...createNewPlayer(),
      tableStack: 200,
      bankroll: 1000,
    },
  });
}

function pickSafePlayerAction(tableState, table) {
  const actions = getAvailableActions(tableState);
  if (actions.includes("check")) return { action: "check" };
  if (actions.includes("call")) return { action: "call" };
  if (actions.includes("raise")) {
    const meta = getActionMeta(tableState, table);
    return { action: "raise", raiseTarget: meta.raiseTarget };
  }
  if (actions.includes("fold")) return { action: "fold" };
  return { action: "fold" };
}

function playHandToResult(content, table, club, previousTableState = null) {
  let tableState = startTestHand(content, table, club, previousTableState);
  let auto = advanceUntilPlayerOrEnd({ tableState, table });
  tableState = auto.tableState;
  let result = auto.result;
  let player = createNewPlayer();

  for (let guard = 0; guard < MAX_PLAYER_DECISIONS_PER_HAND && !result; guard += 1) {
    assert(tableState.awaitingPlayer, `hand stalled without result and without hero action on guard ${guard}`);
    const decision = pickSafePlayerAction(tableState, table);
    const applied = applyPlayerAction({ tableState, player, table, ...decision });
    tableState = applied.tableState;
    result = applied.result;
  }

  assert(result, "hand did not finish inside smoke-test guard");
  assert(["finished", "folded"].includes(tableState.phase), `terminal hand phase expected, got ${tableState.phase}`);
  assert(tableState.lastResult, "terminal hand must have lastResult");
  return { tableState, result };
}

function assertFoldInvariant(content, table, club) {
  let tableState = startTestHand(content, table, club);
  const auto = advanceUntilPlayerOrEnd({ tableState, table });
  tableState = auto.tableState;

  assert(tableState.awaitingPlayer, "fold invariant setup expected hero action");
  const foldIndexBefore = tableState.handEvents.length;
  const folded = applyPlayerAction({ tableState, player: createNewPlayer(), action: "fold", table });
  const nextState = folded.tableState;

  assert(nextState.heroSeat?.folded, "hero seat must be folded after fold action");
  assert(!nextState.awaitingPlayer, "folded hero must not await action");
  assert(nextState.currentActorId !== "player", "folded hero must not be current actor");

  const laterHeroEvents = (nextState.handEvents ?? []).slice(foldIndexBefore + 1).filter((event) => event.actorId === "player");
  assert(laterHeroEvents.length === 0, "folded hero must not create later hand events");

  if (nextState.lastResult) {
    const winners = String(nextState.lastResult.winnerId ?? nextState.lastResult.winner ?? "").split(",");
    assert(!winners.includes("player"), "folded hero must not win the pot");
  }
}

function assertCustomRaise(content, table, club) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    let tableState = startTestHand(content, table, club);
    const auto = advanceUntilPlayerOrEnd({ tableState, table });
    tableState = auto.tableState;
    if (!tableState.awaitingPlayer) continue;

    const actions = getAvailableActions(tableState);
    if (!actions.includes("raise")) continue;

    const meta = getActionMeta(tableState, table);
    const target = Math.min(meta.playerBet + meta.playerStack, Math.max(meta.raiseTarget, meta.currentBet + table.bigBlind));
    const beforePot = tableState.pot;
    const applied = applyPlayerAction({
      tableState,
      player: createNewPlayer(),
      table,
      action: "raise",
      raiseTarget: target,
    });

    assert(applied.tableState.pot > beforePot, "custom raise/bet must increase pot");
    assert(applied.tableState.handEvents.some((event) => ["bet", "raise"].includes(event.action)), "custom raise must write bet/raise event");
    return;
  }
  throw new Error("could not find a legal raise spot in 20 attempts");
}

function assertUiSmoke(content, table) {
  const emptyState = makeBaseState(content, createInitialTableState(), {
    currentScreen: "table",
    tableSession: { tableId: table.id, buyIn: 200, stack: 200, handsPlayed: 0 },
  });
  const emptyTableHtml = renderScreen(emptyState);
  assert(emptyTableHtml.includes("Начать новую раздачу"), "empty table must show start hand button");
  assertNotIncludes(emptyTableHtml, "Нажми", "empty table must not show old gray hint");
  assertNotIncludes(emptyTableHtml, "data-id=\"fold\"", "empty table must not show fold button before hand starts");

  const clubHtml = renderScreen(makeBaseState(content, createInitialTableState(), { currentScreen: "club" }));
  assert(clubHtml.includes("Cash lobby"), "club screen must render lobby");

  const visibleNotSeated = getVisibleScreens({ tableSession: null }).map((screen) => screen.id);
  assert(visibleNotSeated.includes("club") && !visibleNotSeated.includes("table"), "club visible and table hidden before seating");
  const visibleSeated = getVisibleScreens({ tableSession: { tableId: table.id } }).map((screen) => screen.id);
  assert(visibleSeated.includes("table") && !visibleSeated.includes("club"), "table visible and club hidden after seating");
}

function main() {
  const content = buildContentRegistry();
  assert(content.validation?.ok, `content validation failed: ${(content.validation?.warnings ?? []).join("; ")}`);
  assert(content.countries.length >= 1, "at least one country expected");
  assert(content.clubs.length >= 1, "at least one club expected");
  assert(content.tables.length >= 1, "at least one table expected");
  assert(content.npcs.length >= 6, "at least six NPCs expected for table smoke tests");

  const career = createNewCareer();
  const start = getDefaultStartLocation(content, career);
  const club = start.club;
  const table = start.table;
  assert(club, "default club expected");
  assert(table, "default table expected");

  const firstHand = startTestHand(content, table, club);
  const startTimeline = buildStartHandTimeline(firstHand, table);
  assert(Array.isArray(startTimeline) && startTimeline.length > 0, "start hand timeline expected");

  assertUiSmoke(content, table);
  assertFoldInvariant(content, table, club);
  assertCustomRaise(content, table, club);

  let previousTableState = null;
  let finished = 0;
  for (let index = 0; index < TEST_HANDS; index += 1) {
    const played = playHandToResult(content, table, club, previousTableState);
    previousTableState = played.tableState;
    finished += 1;
  }

  console.log(`[PRS smoke] ok`);
  console.log(`[PRS smoke] content: ${content.countries.length} countries, ${content.clubs.length} clubs, ${content.tables.length} tables, ${content.npcs.length} npcs`);
  console.log(`[PRS smoke] poker hands finished: ${finished}/${TEST_HANDS}`);
}

try {
  main();
} catch (error) {
  console.error(`[PRS smoke] failed: ${error.message}`);
  console.error(error.stack);
  process.exitCode = 1;
}
