import { buildContentRegistry } from "../src/data/contentRegistry.js?v=1.3.3";
import { createNewCareer, createNewPlayer, ensureActiveChallenges, updateCareerUnlocks } from "../src/engine/career.js?v=1.3.3";
import { createClubRoomState } from "../src/engine/club.js?v=1.3.3";
import { applyClubProgression, getClubLevelInfo } from "../src/engine/progression.js?v=1.3.3";
import { getDefaultStartLocation } from "../src/engine/selectors.js?v=1.3.3";
import {
  advanceUntilPlayerOrEnd,
  applyPlayerAction,
  buildStartHandTimeline,
  createInitialTableState,
  getActionMeta,
  getAvailableActions,
  settleTableStacks,
  startNewHand,
} from "../src/engine/poker.js?v=1.3.3";
import { decideNpcAction } from "../src/engine/npc.js?v=1.3.3";
import { renderScreen, getVisibleScreens } from "../src/ui/screens.js?v=1.3.3";

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
      appVersion: "1.3.3",
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
  tableState = settleTableStacks(tableState, result);
  assert(tableState.tableEconomy?.settled, "terminal hand must settle table economy");
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

function assertNpcPreflopDecisionTuning(content, table) {
  const callingStation = hydrateTestNpc(content, "ARCH_CALLING_STATION");
  const looseCaller = hydrateTestNpc(content, "ARCH_LOOSE_CALLER");
  const tightNit = hydrateTestNpc(content, "ARCH_TIGHT_NIT");
  const weakSuitedHand = [
    { rank: "7", suit: "♠", value: 7, id: "7♠" },
    { rank: "2", suit: "♠", value: 2, id: "2♠" },
  ];
  const trashHand = [
    { rank: "7", suit: "♠", value: 7, id: "7♠" },
    { rank: "2", suit: "♦", value: 2, id: "2♦" },
  ];

  const cheapCallContext = {
    holeCards: weakSuitedHand,
    communityCards: [],
    phase: "preflop",
    pressure: table.bigBlind,
    pot: table.smallBlind + table.bigBlind,
    currentBet: table.bigBlind,
    bigBlind: table.bigBlind,
    position: "CO",
    stack: table.recommendedBuyIn ?? table.bigBlind * 100,
    streetRaises: 0,
  };

  const stationCheapCalls = countNpcActions(() => decideNpcAction({ npc: callingStation, ...cheapCallContext }), "call", 32);
  const looseCheapContinues = countNpcActions(() => decideNpcAction({ npc: looseCaller, ...cheapCallContext }), "fold", 32);
  assert(stationCheapCalls >= 24, `calling station must defend cheap preflop calls, got ${stationCheapCalls}/32 calls`);
  assert(looseCheapContinues <= 10, `loose caller must not overfold cheap preflop calls, got ${looseCheapContinues}/32 folds`);

  const expensivePressureContext = {
    ...cheapCallContext,
    holeCards: trashHand,
    pressure: table.bigBlind * 6,
    pot: table.smallBlind + table.bigBlind * 3,
    currentBet: table.bigBlind * 6,
    position: "UTG",
    streetRaises: 1,
  };
  const nitFolds = countNpcActions(() => decideNpcAction({ npc: tightNit, ...expensivePressureContext }), "fold", 32);
  assert(nitFolds >= 20, `tight nit must still fold weak hands to heavy preflop pressure, got ${nitFolds}/32 folds`);
}

function hydrateTestNpc(content, archetypeId) {
  const archetype = content.byId.archetypes[archetypeId];
  assert(archetype, `missing archetype ${archetypeId}`);
  return {
    id: `TEST_${archetypeId}`,
    name: archetype.name,
    archetypeId,
    skillLevel: 30,
    archetype,
    stats: {
      skill: 30,
      vpip: archetype.baseVpip,
      pfr: archetype.basePfr,
      aggression: archetype.baseAggression,
      bluff: archetype.baseBluff,
      risk: archetype.baseRisk,
      tilt: archetype.baseTilt,
      discipline: archetype.baseDiscipline,
    },
  };
}

function countNpcActions(factory, action, attempts) {
  let count = 0;
  for (let index = 0; index < attempts; index += 1) {
    if (factory().action === action) count += 1;
  }
  return count;
}


function assertNpcDecisionMetadata(content, table, club) {
  let previousTableState = null;
  for (let attempt = 0; attempt < 24; attempt += 1) {
    let tableState = startTestHand(content, table, club, previousTableState);
    const auto = advanceUntilPlayerOrEnd({ tableState, table });
    tableState = auto.tableState;
    previousTableState = tableState;

    const npcDecisionEvent = (tableState.handEvents ?? []).find((event) => event.source === "npc" && event.reason);
    if (npcDecisionEvent) {
      assert(typeof npcDecisionEvent.reason === "string", "npc decision event must store reason string");
      assert("confidence" in npcDecisionEvent, "npc decision event must store confidence field");
      assert("toCall" in npcDecisionEvent, "npc decision event must store toCall field");
      assert("potOdds" in npcDecisionEvent, "npc decision event must store potOdds field");
      return;
    }

    if (tableState.awaitingPlayer) {
      const decision = pickSafePlayerAction(tableState, table);
      const applied = applyPlayerAction({ tableState, player: createNewPlayer(), table, ...decision });
      tableState = applied.tableState;
      const laterNpcEvent = (tableState.handEvents ?? []).find((event) => event.source === "npc" && event.reason);
      if (laterNpcEvent) return;
    }
  }

  throw new Error("could not observe npc decision metadata in 24 attempts");
}

function assertClubProgressPersistsThroughUnlockRefresh(content, table, club, career, progressionProbe) {
  const progressResult = applyClubProgression({
    content,
    career,
    clubId: club.id,
    tableState: progressionProbe.tableState,
    result: progressionProbe.result,
    challengeResult: { completedNow: [] },
  });
  const refreshedCareer = updateCareerUnlocks(createNewPlayer(), progressResult.career, content);
  const clubInfo = getClubLevelInfo(content, refreshedCareer, club.id);
  assert(progressResult.gain.xp > 0, "club progression must award Club XP");
  assert(clubInfo.xp >= progressResult.gain.xp, "club progression must survive career unlock refresh");

  const clubHtml = renderScreen(makeBaseState(content, createInitialTableState(), {
    career: refreshedCareer,
    activeClubId: club.id,
    currentScreen: "club",
  }));
  assert(clubHtml.includes(String(clubInfo.xp)), "club screen must display stored Room Mastery XP");
}


function assertDynamicTableSeats(content, table, club) {
  const seatCounts = new Set();
  let previousTableState = null;

  for (let index = 0; index < 14; index += 1) {
    const hand = startTestHand(content, table, club, previousTableState);
    const totalPlayers = 1 + (hand.npcSeats?.length ?? 0);
    const npcIds = (hand.npcSeats ?? []).map((seat) => seat.id);
    const uniqueNpcIds = new Set(npcIds);
    const smallBlind = [hand.heroSeat, ...(hand.npcSeats ?? [])].filter((seat) => seat?.isSmallBlind);
    const bigBlind = [hand.heroSeat, ...(hand.npcSeats ?? [])].filter((seat) => seat?.isBigBlind);

    assert(totalPlayers >= 2 && totalPlayers <= Math.min(6, table.seats ?? 6), `dynamic table player count must stay 2-6, got ${totalPlayers}`);
    assert(uniqueNpcIds.size === npcIds.length, "dynamic table must not duplicate NPC seats");
    assert(smallBlind.length === 1, "dynamic table must assign exactly one small blind");
    assert(bigBlind.length === 1, "dynamic table must assign exactly one big blind");
    assert(hand.tableDynamics?.targetNpcCount === hand.npcSeats.length, "table dynamics must track target npc count");
    seatCounts.add(totalPlayers);
    previousTableState = hand;
  }

  assert(seatCounts.size >= 2, "dynamic table should change player count across hands");
}

function assertHeadsUpBlinds(content, table, club) {
  const headsUpTable = { ...table, seats: 2 };
  const hand = startTestHand(content, headsUpTable, club, null);
  const seats = [hand.heroSeat, ...(hand.npcSeats ?? [])];
  const sb = seats.find((seat) => seat.isSmallBlind);
  const bb = seats.find((seat) => seat.isBigBlind);

  assert(seats.length === 2, `heads-up table must have exactly 2 players, got ${seats.length}`);
  assert(sb && bb, "heads-up table must post both blinds");
  assert(sb.id !== bb.id, "heads-up blinds must be on different seats");
  assert(sb.isDealer, "heads-up button must also be small blind");
  assert(hand.pot === headsUpTable.smallBlind + headsUpTable.bigBlind, "heads-up blinds must build correct starting pot");
  assert(hand.currentBet === headsUpTable.bigBlind, "heads-up current bet must equal big blind");
}


function assertPersistentTableEconomy(content, table, club) {
  let previousTableState = null;

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const played = playHandToResult(content, table, club, previousTableState);
    const settled = played.tableState;
    const nextHand = startTestHand(content, table, club, settled);

    assert(settled.tableEconomy?.settled, "persistent economy must mark terminal state as settled");
    assert(settled.heroSeat?.stack >= 0, "settled hero stack must be non-negative");

    const carried = (nextHand.npcSeats ?? [])
      .map((seat) => {
        const previousSeat = (settled.npcSeats ?? []).find((entry) => entry.id === seat.id);
        return previousSeat ? { next: seat, previous: previousSeat } : null;
      })
      .filter(Boolean);

    if (carried.length) {
      const bustedCarried = carried.filter(({ previous }) => Number(previous.stack ?? 0) <= 0);
      assert(bustedCarried.length === 0, "busted NPC must leave before the next hand");

      const persisted = carried.find(({ next, previous }) => {
        const posted = Number(next.currentBet ?? 0);
        return Number(next.stack ?? 0) + posted === Number(previous.stack ?? 0);
      });

      assert(Boolean(persisted), "reused NPC stack must persist before next-hand blinds");
      assert(Number(persisted.next.invested ?? 0) === Number(persisted.next.currentBet ?? 0), "reused NPC must start next hand with only posted blind invested");
      assert(!persisted.next.folded, "reused NPC must start next hand not folded");
      return;
    }

    previousTableState = settled;
  }

  throw new Error("could not observe carried NPC stack in persistent economy smoke test");
}

function assertBustedNpcReplacement(content, table, club) {
  const hand = startTestHand(content, table, club, null);
  const firstNpc = hand.npcSeats?.[0];
  assert(firstNpc, "busted npc smoke expected npc seat");

  const bustedState = {
    ...hand,
    phase: "finished",
    lastResult: { winner: "player", winnerId: "player", pot: 0 },
    npcSeats: hand.npcSeats.map((seat, index) => index === 0 ? { ...seat, stack: 0 } : seat),
  };

  const nextHand = startTestHand(content, table, club, bustedState);
  assert(!nextHand.npcSeats.some((seat) => seat.id === firstNpc.id), "busted NPC must leave before next hand");
  assert(nextHand.npcSeats.length >= 1, "busted NPC replacement must keep table playable");
}

function assertUiSmoke(content, table, club) {
  const emptyState = makeBaseState(content, createInitialTableState(), {
    currentScreen: "table",
    tableSession: { tableId: table.id, buyIn: 200, stack: 200, handsPlayed: 0 },
  });
  const emptyTableHtml = renderScreen(emptyState);
  assert(emptyTableHtml.includes("Начать новую раздачу"), "empty table must show start hand button");
  assertNotIncludes(emptyTableHtml, "Hand Inspector", "table screen must not render removed hand inspector block");
  assertNotIncludes(emptyTableHtml, "Нажми", "empty table must not show old gray hint");
  assertNotIncludes(emptyTableHtml, "data-id=\"fold\"", "empty table must not show fold button before hand starts");

  const clubHtml = renderScreen(makeBaseState(content, createInitialTableState(), { currentScreen: "club" }));
  assert(clubHtml.includes("Cash lobby"), "club screen must render lobby");

  const visibleNotSeated = getVisibleScreens({ tableSession: null }).map((screen) => screen.id);
  assert(visibleNotSeated.includes("club") && !visibleNotSeated.includes("table"), "club visible and table hidden before seating");
  const visibleSeated = getVisibleScreens({ tableSession: { tableId: table.id } }).map((screen) => screen.id);
  assert(visibleSeated.includes("table") && !visibleSeated.includes("club"), "table visible and club hidden after seating");

  const hand = startTestHand(content, table, club);
  const firstNpc = hand.npcSeats?.[0];
  assert(firstNpc, "opponent read smoke expected npc seat");
  const tableWithSeatsHtml = renderScreen(makeBaseState(content, hand, {
    currentScreen: "table",
    tableSession: { tableId: table.id, buyIn: 200, stack: 200, handsPlayed: 0 },
  }));
  assert(tableWithSeatsHtml.includes('data-action="open-opponent-read"'), "npc seats must open opponent reads");

  const openReadState = makeBaseState(content, hand, {
    currentScreen: "table",
    tableSession: { tableId: table.id, buyIn: 200, stack: 200, handsPlayed: 0 },
  });
  openReadState.system = { ...openReadState.system, opponentReadSeatId: firstNpc.id };
  const readHtml = renderScreen(openReadState);
  assert(readHtml.includes("Opponent Read"), "opponent read modal must render title");
  assert(readHtml.includes(firstNpc.name), "opponent read modal must render npc name");
  assert(readHtml.includes("План"), "opponent read modal must render advice block");
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

  assertDynamicTableSeats(content, table, club);
  assertHeadsUpBlinds(content, table, club);
  assertPersistentTableEconomy(content, table, club);
  assertBustedNpcReplacement(content, table, club);
  assertUiSmoke(content, table, club);
  assertFoldInvariant(content, table, club);
  assertCustomRaise(content, table, club);
  assertNpcPreflopDecisionTuning(content, table);
  assertNpcDecisionMetadata(content, table, club);

  const progressionProbe = playHandToResult(content, table, club);
  assertClubProgressPersistsThroughUnlockRefresh(content, table, club, career, progressionProbe);

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
