import { readFileSync, readdirSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { buildContentRegistry } from "../src/data/contentRegistry.js?v=3.5.0";
import { createNewCareer, createNewPlayer, ensureActiveChallenges, updateCareerUnlocks } from "../src/engine/career.js?v=3.5.0";
import { createClubRoomState } from "../src/engine/club.js?v=3.5.0";
import { applyClubProgression, getClubLevelInfo } from "../src/engine/progression.js?v=3.5.0";
import { getDefaultStartLocation } from "../src/engine/selectors.js?v=3.5.0";
import {
  advanceUntilPlayerOrEnd,
  applyPlayerAction,
  buildStartHandTimeline,
  createInitialTableState,
  getActionMeta,
  getAvailableActions,
  settleTableStacks,
  startNewHand,
} from "../src/engine/poker.js?v=3.5.0";
import { decideNpcAction } from "../src/engine/npc.js?v=3.5.0";
import { renderScreen, getVisibleScreens } from "../src/ui/screens.js?v=3.5.0";
import { buildPotsFromContributions, resolveShowdown } from "../src/engine/poker/results.js?v=3.5.0";
import { handFlow } from "../src/app/handFlow.js?v=3.5.0";
import { tableSessionFlow } from "../src/app/tableSessionFlow.js?v=3.5.0";
import { inputController } from "../src/app/inputController.js?v=3.5.0";
import { canEnterTable } from "../src/engine/world.js?v=3.5.0";
import { applyClubGoals, getClubGoals } from "../src/engine/clubGoals.js?v=3.5.0";
import { applyStorylineProgress, getClubStorylines } from "../src/engine/storylines.js?v=3.5.0";

const TEST_HANDS = 100;
const MAX_PLAYER_DECISIONS_PER_HAND = 20;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertNotIncludes(value, needle, message) {
  assert(!String(value).includes(needle), message);
}

function testCard(rank, suit) {
  const values = { "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9, T: 10, J: 11, Q: 12, K: 13, A: 14 };
  return { rank, suit, value: values[rank], id: `${rank}${suit}` };
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
      appVersion: "1.7.3",
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

function makeFlowHarness(content, table, patch = {}) {
  const state = makeBaseState(content, createInitialTableState(), {
    currentScreen: "table",
    tableSession: { tableId: table.id, buyIn: 200, stack: 200, handsPlayed: 0 },
    ...patch,
  });

  return {
    content,
    state,
    setState(update) {
      this.state = { ...this.state, ...update };
    },
    setSystem(update) {
      this.state = { ...this.state, system: { ...this.state.system, ...update } };
    },
    openBuyInModal() {
      this.setSystem({ buyInModal: { tableId: table.id, amount: table.minBuyIn } });
    },
    playTimeline(finalTableState) {
      this.setState({ tableState: finalTableState });
    },
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


function assertRiverRoomExpansion(content, club) {
  const riverTables = (content.tables ?? []).filter((table) => table.clubId === club.id);
  assert(riverTables.length >= 5, "River Room expansion must expose at least five tables");

  const byId = Object.fromEntries(riverTables.map((table) => [table.id, table]));
  const starter = byId.TABLE_RU_BRR_LOW_001;
  const shortAction = byId.TABLE_RU_BRR_LOW_002;
  const looseNight = byId.TABLE_RU_BRR_MID_001;
  const backRoom = byId.TABLE_RU_BRR_LOW_004;
  assert(starter?.name === "Starter Table", "starter table must keep a clear unlocked entry point");
  assert(shortAction?.seatProfile?.maxPlayers <= 4, "Short Action Table must support short-handed play");
  assert(looseNight?.bigBlind === 5, "Loose Night Table must raise the stakes to $2/$5");
  assert(backRoom?.bigBlind === 10 && backRoom?.unlockRequirement, "Back Room Table must be a locked higher-stakes table");

  const newPlayer = createNewPlayer();
  assert(canEnterTable(newPlayer, starter).ok, "starter table must be open to a new player");
  assert(!canEnterTable(newPlayer, backRoom).ok, "back room table must be locked for a new player");

  const lockedApp = makeFlowHarness(content, backRoom, {
    player: newPlayer,
    tableSession: null,
    currentScreen: "club",
  });
  tableSessionFlow.openBuyInModal.call(lockedApp, backRoom.id);
  assert(!lockedApp.state.system?.buyInModal, "locked table must not open buy-in modal");
  assert(String(lockedApp.state.system?.notice ?? "").includes("Нужно"), "locked table must show unlock reason");

  const clubHtml = renderScreen(makeBaseState(content, createInitialTableState(), { currentScreen: "club" }));
  assert(clubHtml.includes("Starter Table"), "club screen must render Starter Table");
  assert(clubHtml.includes("Short Action Table"), "club screen must render Short Action Table");
  assert(clubHtml.includes("Loose Night Table"), "club screen must render Loose Night Table");
  assert(clubHtml.includes("Back Room Table"), "club screen must render Back Room Table");
  assert(clubHtml.includes("Закрыт"), "club screen must render locked table state");

  const shortHand = startTestHand(content, shortAction, club, null);
  const shortTotalPlayers = 1 + (shortHand.npcSeats?.length ?? 0);
  assert(shortTotalPlayers >= shortAction.seatProfile.minPlayers && shortTotalPlayers <= shortAction.seatProfile.maxPlayers, "short table dynamic seats must respect seat profile");
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



function assertSidePots(content, table, club) {
  let hand = null;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = startTestHand(content, { ...table, seats: 6 }, club, hand);
    if ((candidate.npcSeats?.length ?? 0) >= 2) {
      hand = candidate;
      break;
    }
    hand = candidate;
  }

  assert(hand && hand.npcSeats.length >= 2, "side pot smoke expected at least two NPC seats");
  const [npcA, npcB] = hand.npcSeats;
  const communityCards = [testCard("2", "♣"), testCard("7", "♦"), testCard("9", "♣"), testCard("J", "♦"), testCard("3", "♠")];
  const sidePotState = {
    ...hand,
    phase: "river",
    communityCards,
    pot: 220,
    currentBet: 100,
    heroSeat: {
      ...hand.heroSeat,
      holeCards: [testCard("A", "♠"), testCard("A", "♥")],
      invested: 20,
      currentBet: 20,
      stack: 0,
      allIn: true,
      folded: false,
    },
    npcSeats: [
      {
        ...npcA,
        holeCards: [testCard("K", "♠"), testCard("K", "♥")],
        invested: 100,
        currentBet: 100,
        stack: 0,
        allIn: true,
        folded: false,
      },
      {
        ...npcB,
        holeCards: [testCard("Q", "♠"), testCard("Q", "♥")],
        invested: 100,
        currentBet: 100,
        stack: 50,
        allIn: false,
        folded: false,
      },
    ],
  };

  const pots = buildPotsFromContributions([sidePotState.heroSeat, ...sidePotState.npcSeats]);
  assert(pots.length === 2, `side pot builder must create main + side pot, got ${pots.length}`);
  assert(pots[0].amount === 60, `main pot must be $60, got ${pots[0].amount}`);
  assert(pots[1].amount === 160, `side pot must be $160, got ${pots[1].amount}`);
  assert(pots[0].eligibleSeatIds.includes("player"), "short all-in player must be eligible for main pot");
  assert(!pots[1].eligibleSeatIds.includes("player"), "short all-in player must not be eligible for side pot");

  const result = resolveShowdown(sidePotState, table);
  assert(Array.isArray(result.potAwards) && result.potAwards.length === 2, "showdown result must include two pot awards");
  assert(result.potAwards[0].payouts.player === 60, "hero must win only the eligible main pot");
  assert(result.potAwards[1].payouts[npcA.id] === 160, "deeper better hand must win side pot");
  assert(result.bankrollDelta === 40, `hero bankroll delta must be +40, got ${result.bankrollDelta}`);

  const settled = settleTableStacks(sidePotState, result);
  assert(settled.heroSeat.stack === 60, "settled hero stack must receive main pot only");
  const settledNpcA = settled.npcSeats.find((seat) => seat.id === npcA.id);
  const settledNpcB = settled.npcSeats.find((seat) => seat.id === npcB.id);
  assert(settledNpcA.stack === 160, "settled side-pot winner must receive side pot");
  assert(settledNpcB.stack === 50, "settled losing deep stack must keep remaining stack only");

  const foldedState = {
    ...sidePotState,
    npcSeats: [
      { ...sidePotState.npcSeats[0], holeCards: [testCard("4", "♠"), testCard("4", "♥")], folded: false },
      { ...sidePotState.npcSeats[1], holeCards: [testCard("A", "♦"), testCard("A", "♣")], folded: true },
    ],
  };
  const foldedResult = resolveShowdown(foldedState, table);
  const foldedWinnerIds = foldedResult.potAwards.flatMap((award) => award.winnerIds);
  assert(!foldedWinnerIds.includes(npcB.id), "folded player must not win any side pot award");
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

function assertStackSafetyAndTopUp(content, table) {
  const lowStack = Math.max(0, table.bigBlind - 1);
  const app = makeFlowHarness(content, table, {
    player: { ...createNewPlayer(), bankroll: 1000 },
    tableSession: { tableId: table.id, buyIn: 200, stack: lowStack, handsPlayed: 0 },
  });

  handFlow.startHand.call(app);
  assert(app.state.system.notice === "Недостаточно стека. Добери фишки или выйди из стола.", "low table stack must block hand start with clear notice");
  assert(app.state.tableState.phase === "idle", "low table stack must not start a hand");

  const beforeBankroll = app.state.player.bankroll;
  tableSessionFlow.topUpTableStack.call(app);
  assert(app.state.tableSession.stack >= table.bigBlind, "top-up must make stack playable when bankroll allows");
  assert(app.state.player.bankroll < beforeBankroll, "top-up must spend player bankroll");
  assert(app.state.tableSession.stack <= table.maxBuyIn, "top-up must not exceed table max buy-in");

  const afterTopUpStack = app.state.tableSession.stack;
  handFlow.startHand.call(app);
  assert(app.state.tableState.phase !== "idle", "after top-up hand can start");
  assert(app.state.tableSession.stack === afterTopUpStack, "starting a hand must not change stored session stack until hand completes");

  const broke = makeFlowHarness(content, table, {
    player: { ...createNewPlayer(), bankroll: 0 },
    tableSession: { tableId: table.id, buyIn: 200, stack: lowStack, handsPlayed: 0 },
  });
  tableSessionFlow.topUpTableStack.call(broke);
  assert(broke.state.tableSession.stack === lowStack, "top-up must not change stack when bankroll is empty");
  assert(broke.state.system.notice === "Недостаточно банкролла для добора.", "empty bankroll top-up must show clear notice");

  const routed = makeFlowHarness(content, table, {
    player: { ...createNewPlayer(), bankroll: 1000 },
    tableSession: { tableId: table.id, buyIn: 200, stack: lowStack, handsPlayed: 0 },
  });
  Object.assign(routed, tableSessionFlow);
  const event = { target: { closest: () => ({ dataset: { action: "top-up-table-stack" } }) } };
  inputController.handleClick.call(routed, event);
  assert(routed.state.tableSession.stack >= table.bigBlind, "input controller must route top-up action");

  const html = renderScreen(makeBaseState(content, createInitialTableState(), {
    currentScreen: "table",
    tableSession: { tableId: table.id, buyIn: 200, stack: lowStack, handsPlayed: 0 },
  }));
  assert(String(html).includes('data-action="top-up-table-stack"'), "table screen must render top-up action when stack is low");
  assert(String(html).includes("Недостаточно стека"), "table screen must render low-stack reason");
}


function assertBankrollAccounting(content, table, club) {
  const buyInAmount = table.minBuyIn;
  const buyInApp = makeFlowHarness(content, table, {
    currentScreen: "club",
    player: { ...createNewPlayer(), bankroll: 1000 },
    tableSession: null,
    system: { ...makeBaseState(content).system, buyInModal: { tableId: table.id, amount: buyInAmount } },
  });
  tableSessionFlow.confirmBuyIn.call(buyInApp);
  assert(buyInApp.state.player.bankroll === 1000 - buyInAmount, "buy-in must subtract from off-table bankroll");
  assert(buyInApp.state.tableSession.stack === buyInAmount, "buy-in must create table stack equal to buy-in");

  const deniedBuyIn = makeFlowHarness(content, table, {
    currentScreen: "club",
    player: { ...createNewPlayer(), bankroll: Math.max(0, buyInAmount - 1) },
    tableSession: null,
    system: { ...makeBaseState(content).system, buyInModal: { tableId: table.id, amount: buyInAmount } },
  });
  tableSessionFlow.confirmBuyIn.call(deniedBuyIn);
  assert(!deniedBuyIn.state.tableSession, "buy-in above bankroll must not seat player");

  buyInApp.state = {
    ...buyInApp.state,
    tableSession: { ...buyInApp.state.tableSession, stack: buyInAmount + 25 },
  };
  tableSessionFlow.leaveTable.call(buyInApp);
  assert(buyInApp.state.player.bankroll === 1025, "leaving table must return remaining table stack to bankroll");
  assert(buyInApp.state.tableSession === null, "leaving table must clear table session");

  const handApp = makeFlowHarness(content, table, {
    player: { ...createNewPlayer(), bankroll: 800 },
    tableSession: { tableId: table.id, buyIn: 200, stack: 200, handsPlayed: 0 },
  });
  const hand = startTestHand(content, table, club, null);
  const terminalState = {
    ...hand,
    phase: "finished",
    pot: 40,
    actionLog: ["accounting smoke"],
    heroSeat: {
      ...hand.heroSeat,
      invested: 20,
      stack: 180,
    },
    npcSeats: hand.npcSeats.map((seat) => ({ ...seat, folded: true })),
  };
  const result = {
    winner: "player",
    winnerId: "player",
    winnerName: "Ты",
    pot: 40,
    bankrollDelta: 20,
    xp: 0,
    reputationGain: 0,
    showdown: false,
    logs: ["accounting smoke result"],
    review: null,
  };
  handFlow.completeHand.call(handApp, terminalState, result, terminalState);
  assert(handApp.state.player.bankroll === 800, "hand result must not change off-table bankroll while seated");
  assert(handApp.state.tableSession.stack !== 200, "hand result must update table session stack instead of bankroll");

  const topUpApp = makeFlowHarness(content, table, {
    player: { ...createNewPlayer(), bankroll: 500 },
    tableSession: { tableId: table.id, buyIn: 200, stack: table.bigBlind, handsPlayed: 0 },
  });
  const topBankrollBefore = topUpApp.state.player.bankroll;
  const topStackBefore = topUpApp.state.tableSession.stack;
  tableSessionFlow.topUpTableStack.call(topUpApp);
  assert(topUpApp.state.player.bankroll < topBankrollBefore, "top-up must subtract from bankroll");
  assert(topUpApp.state.tableSession.stack > topStackBefore, "top-up must increase table stack");
}


function assertUniversalClubGoals(content, club, table) {
  const career = createNewCareer();
  const goals = getClubGoals(content, career, club.id);

  assert(goals.length >= 4, "universal club goals must generate baseline goals for any club");
  assert(goals.some((goal) => goal.type === "club_hands"), "club goals must include hands goal");
  assert(goals.some((goal) => goal.type === "club_wins"), "club goals must include wins goal");
  assert(goals.some((goal) => goal.type === "club_showdowns"), "club goals must include showdown goal");
  assert(goals.some((goal) => goal.type === "club_big_pot"), "club goals must include big pot goal");

  const firstTick = applyClubGoals({
    content,
    career,
    clubId: club.id,
    table,
    tableState: null,
    result: { winner: "npc", pot: table.bigBlind * 4, showdown: false },
  });
  const progressed = getClubGoals(content, firstTick.career, club.id);
  const handsGoal = progressed.find((goal) => goal.type === "club_hands");
  assert(handsGoal?.current === 1, `club hands goal must progress after a hand, got ${handsGoal?.current}`);

  let goalCareer = firstTick.career;
  for (let index = 0; index < 2; index += 1) {
    const applied = applyClubGoals({
      content,
      career: goalCareer,
      clubId: club.id,
      table,
      tableState: null,
      result: { winner: "player", pot: table.bigBlind * 12, showdown: index === 0 },
    });
    goalCareer = applied.career;
  }
  const afterWins = getClubGoals(content, goalCareer, club.id);
  assert(afterWins.find((goal) => goal.type === "club_wins")?.completed, "club win goal must complete after enough player wins");

  const bigPotGoal = getClubGoals(content, goalCareer, club.id).find((goal) => goal.type === "club_big_pot");
  const bigPotResult = applyClubGoals({
    content,
    career: goalCareer,
    clubId: club.id,
    table,
    tableState: null,
    result: { winner: "player", pot: bigPotGoal.target, showdown: true },
  });
  assert(bigPotResult.completedNow.includes(bigPotGoal.id), "big pot goal must complete from matching player win pot");
  assert(bigPotResult.xpReward > 0 && bigPotResult.reputationReward > 0, "completed club goals must grant rewards");

  const shortTable = (club.tables ?? []).map((id) => content.byId.tables[id]).find((entry) => Number(entry?.seatProfile?.maxPlayers ?? entry?.seats ?? 6) <= 4);
  if (shortTable) {
    const shortGoal = getClubGoals(content, career, club.id).find((goal) => goal.type === "table_hands" && goal.tableId === shortTable.id);
    assert(shortGoal, "short table goal must be generated when club has a short table");
    const shortTick = applyClubGoals({
      content,
      career,
      clubId: club.id,
      table: shortTable,
      tableState: null,
      result: { winner: "npc", pot: shortTable.bigBlind * 4, showdown: false },
    });
    const shortProgress = getClubGoals(content, shortTick.career, club.id).find((goal) => goal.id === shortGoal.id);
    assert(shortProgress.current === 1, "short table goal must progress only from the matching table");
  }

  const clubHtml = renderScreen(makeBaseState(content, createInitialTableState(), { currentScreen: "club", career: bigPotResult.career }));
  assert(clubHtml.includes("Club Goals"), "club screen must render universal Club Goals board");
  assert(clubHtml.includes("Первые руки"), "club goals board must render generated goal names");
}


function assertRiverRoomStoryline(content, club, table) {
  assert((content.storylines ?? []).length >= 1, "content registry must expose storylines");
  const story = getClubStorylines(content, createNewCareer(), club.id)[0];
  assert(story, "River Room must generate a storyline view");
  assert(story.id === "STORY_RU_BRR_FIRST_NIGHT", "River Room storyline id must be stable");
  assert(story.characters.length >= 5, "River Room storyline must define first characters");
  assert((story.currentStep?.characterIds ?? []).length >= 1, "storyline current step must define scene characters");
  assert(story.currentStep?.id === "first_seat", "River Room storyline must start at First Seat");

  let career = createNewCareer();
  for (let index = 0; index < 3; index += 1) {
    const applied = applyStorylineProgress({
      content,
      career,
      clubId: club.id,
      table,
      tableState: null,
      result: { winner: "npc", pot: table.bigBlind * 8, showdown: false },
      player: createNewPlayer(),
    });
    career = applied.career;
  }

  const afterThreeHands = getClubStorylines(content, career, club.id)[0];
  assert(afterThreeHands.stepIndex >= 1, "storyline must advance after completing first hands objective");
  assert(afterThreeHands.completedSteps.includes("first_seat"), "storyline must store completed first step");

  const winApplied = applyStorylineProgress({
    content,
    career,
    clubId: club.id,
    table,
    tableState: null,
    result: { winner: "player", pot: table.bigBlind * 12, showdown: false },
    player: { ...createNewPlayer(), reputation: 2 },
  });
  assert(winApplied.completedNow.some((id) => id.includes("first_win")), "storyline must complete first win from player win");
  assert(winApplied.xpReward > 0 && winApplied.reputationReward > 0, "storyline step must grant rewards");

  const clubHtml = renderScreen(makeBaseState(content, createInitialTableState(), { currentScreen: "club", career: winApplied.career }));
  assert(clubHtml.includes("Story"), "club screen must render story block");
  assert(clubHtml.includes("First Night"), "club screen must render story title");
  assert(clubHtml.includes("Олег"), "club screen must render current scene character");
  assertNotIncludes(clubHtml, "Виктор", "club screen must not render non-scene story characters in first scene");
  assert(clubHtml.includes("Выбрать стол"), "club screen must render table picker button");
  assert(clubHtml.includes("Table select"), "club screen must render separate table select dialog markup");
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
  assert(clubHtml.includes("Выбрать стол"), "club screen must render table picker button");
  assert(clubHtml.includes("table-picker-dialog"), "club screen must keep table list inside picker dialog");

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


function assertCityFillCoverage(content) {
  for (const city of content.cities ?? []) {
    const clubs = (content.clubs ?? []).filter((club) => club.cityId === city.id);
    const tables = (content.tables ?? []).filter((table) => clubs.some((club) => club.id === table.clubId));
    const venues = (content.venues ?? []).filter((venue) => venue.cityId === city.id);

    assert(clubs.length >= 3, `${city.name} must have at least 3 clubs, got ${clubs.length}`);
    assert(tables.length >= 12, `${city.name} must have at least 12 tables, got ${tables.length}`);
    assert(venues.length >= 36, `${city.name} must have at least 36 venues, got ${venues.length}`);
    assert(venues.filter((venue) => venue.type === "home").length >= 1, `${city.name} must have home venue`);
    assert(venues.filter((venue) => venue.type === "store").length >= 6, `${city.name} must have 6 stores`);
    assert(venues.filter((venue) => venue.type === "cafe").length >= 5, `${city.name} must have 5 cafes`);
    assert(venues.filter((venue) => venue.type === "restaurant").length >= 7, `${city.name} must have 7 restaurants`);
    assert(venues.filter((venue) => venue.type === "job_site").length >= 6, `${city.name} must have 6 job sites`);
    assert(venues.filter((venue) => venue.type === "real_estate_agency").length >= 1, `${city.name} must have real estate agency`);
    assert(venues.filter((venue) => venue.type === "car_dealer").length >= 5, `${city.name} must have 5 car dealers`);
    assert(venues.filter((venue) => venue.type === "asset_store").length >= 1, `${city.name} must have asset store`);
    assert(venues.filter((venue) => venue.type === "business_broker").length >= 1, `${city.name} must have business broker`);

    for (const club of clubs) assert((club.npcPool ?? []).length >= 9, `${club.name} must have at least 9 NPCs`);
  }
}

function assertTravelPickerUi(content, club) {
  const cityState = makeBaseState(content, createInitialTableState(), {
    currentScreen: "location",
    playerLocation: { type: "city", cityId: club.cityId },
  });
  cityState.system = { ...cityState.system, travelPickerOpen: false };
  const closedHtml = renderScreen(cityState);
  assert(closedHtml.includes('data-action="open-travel-picker"'), "city screen must render compact travel picker button");
  assertNotIncludes(closedHtml, "travel-picker-modal", "travel modal must be hidden before opening");
  assertNotIncludes(closedHtml, "travel-route-grid", "route grid must be hidden before opening travel modal");

  const openState = { ...cityState, system: { ...cityState.system, travelPickerOpen: true } };
  const openHtml = renderScreen(openState);
  assert(openHtml.includes("travel-picker-modal"), "travel modal must render when open");
  assert(openHtml.includes('data-action="travel-route"'), "travel modal must contain route buttons");
  assert(openHtml.includes("travel-country-group"), "travel modal must group routes by country");
}

function assertLifeProfileClean(content) {
  const html = renderScreen(makeBaseState(content, createInitialTableState(), { currentScreen: "life" }));
  assertNotIncludes(html, "Daily simulation", "life profile must not render Daily simulation block");
}

const EXPECTED_VERSION_QUERY = "?v=3.5.0";
const LEGACY_VERSION_QUERIES = ["1.4.0", "1.7.3", "3.0.0"].map((version) => `?v=${version}`);
const VERSION_SCAN_EXTENSIONS = new Set([".js", ".html", ".json", ".webmanifest"]);

function assertVersionCacheKeys() {
  const files = collectVersionScanFiles(".");
  const offenders = [];

  for (const file of files) {
    const text = readFileSync(file, "utf8");
    const queryMatches = text.match(/\?v=\d+\.\d+\.\d+/g) ?? [];
    const mismatchedQueries = queryMatches.filter((query) => query !== EXPECTED_VERSION_QUERY);
    const legacyQueries = LEGACY_VERSION_QUERIES.filter((query) => text.includes(query));
    const badQueries = [...new Set([...mismatchedQueries, ...legacyQueries])];

    if (badQueries.length > 0) {
      offenders.push(`${relative(".", file)}: ${badQueries.join(", ")}`);
    }
  }

  assert(offenders.length === 0, `legacy or mismatched version cache keys found: ${offenders.join("; ")}`);
}

function collectVersionScanFiles(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if ([".git", "node_modules", "dist", "assets"].includes(entry.name)) continue;

    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      collectVersionScanFiles(path, out);
      continue;
    }

    if (VERSION_SCAN_EXTENSIONS.has(extname(entry.name))) {
      out.push(path);
    }
  }

  return out;
}

function main() {
  assertVersionCacheKeys();
  const content = buildContentRegistry();
  assert(content.validation?.ok, `content validation failed: ${(content.validation?.warnings ?? []).join("; ")}`);
  assert(content.countries.length >= 1, "at least one country expected");
  assert(content.clubs.length >= 1, "at least one club expected");
  assert(content.tables.length >= 5, "River Room expansion expected multiple tables");
  assert((content.storylines ?? []).length >= 1, "at least one storyline expected");
  assert(content.npcs.length >= 6, "at least six NPCs expected for table smoke tests");
  assertCityFillCoverage(content);

  const career = createNewCareer();
  const start = getDefaultStartLocation(content, career);
  const club = start.club;
  const table = start.table;
  assert(club, "default club expected");
  assert(table, "default table expected");

  const firstHand = startTestHand(content, table, club);
  const startTimeline = buildStartHandTimeline(firstHand, table);
  assert(Array.isArray(startTimeline) && startTimeline.length > 0, "start hand timeline expected");

  assertRiverRoomExpansion(content, club);
  assertUniversalClubGoals(content, club, table);
  assertRiverRoomStoryline(content, club, table);
  assertDynamicTableSeats(content, table, club);
  assertHeadsUpBlinds(content, table, club);
  assertSidePots(content, table, club);
  assertStackSafetyAndTopUp(content, table);
  assertBankrollAccounting(content, table, club);
  assertPersistentTableEconomy(content, table, club);
  assertBustedNpcReplacement(content, table, club);
  assertUiSmoke(content, table, club);
  assertTravelPickerUi(content, club);
  assertLifeProfileClean(content);
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
