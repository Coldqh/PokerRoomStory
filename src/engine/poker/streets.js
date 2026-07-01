import { describeCards, draw } from "../cards.js?v=1.1.0";
import { STREET_LABELS } from "./constants.js?v=1.1.0";
import { appendHandEvent, buildStreetHandEvent, event } from "./events.js?v=1.1.0";
import { getAllSeats, setAllSeats, syncTableState } from "./seats.js?v=1.1.0";
import { getNextPhase } from "./rounds.js?v=1.1.0";

export function advanceStreet(tableState) {
  let state = syncTableState(tableState);
  const deck = [...state.deck];
  const communityCards = [...state.communityCards];
  const nextPhase = getNextPhase(state.phase);
  let stageEvent = null;

  if (nextPhase === "flop") {
    communityCards.push(...draw(deck, 3));
    stageEvent = event("dealer", "Dealer", "flop", `Флоп · ${describeCards(communityCards.slice(0, 3))}`, {
      revealCount: 3,
      pot: state.pot,
    });
  }

  if (nextPhase === "turn") {
    const card = draw(deck, 1)[0];
    communityCards.push(card);
    stageEvent = event("dealer", "Dealer", "turn", `Тёрн · ${describeCards([card])}`, {
      revealCount: 4,
      pot: state.pot,
    });
  }

  if (nextPhase === "river") {
    const card = draw(deck, 1)[0];
    communityCards.push(card);
    stageEvent = event("dealer", "Dealer", "river", `Ривер · ${describeCards([card])}`, {
      revealCount: 5,
      pot: state.pot,
    });
  }

  const resetSeats = getAllSeats(state).map((seat) => ({
    ...seat,
    currentBet: 0,
    acted: seat.folded || seat.allIn,
    lastAction: seat.folded ? "fold" : seat.allIn ? "all-in" : "ready",
    lastAmount: 0,
  }));

  state = setAllSeats(state, resetSeats);

  return {
    tableState: syncTableState({
      ...state,
      deck,
      communityCards,
      phase: nextPhase,
      currentBet: 0,
      minRaise: 0,
      streetRaises: 0,
      actionLog: [...state.actionLog, `${STREET_LABELS[nextPhase]}.`],
      handEvents: appendHandEvent(state, buildStreetHandEvent(nextPhase, state.pot)),
    }),
    event: stageEvent,
  };
}
