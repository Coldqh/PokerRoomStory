import { decideNpcAction } from "../npc.js?v=1.1.0";
import { canRaise, getToCall } from "./betting.js?v=1.1.0";

export function decideNpcForState(state, seat, table) {
  const toCall = getToCall(state, seat);
  const raw = decideNpcAction({
    npc: { ...seat.npc, position: seat.position },
    holeCards: seat.holeCards,
    communityCards: state.communityCards,
    phase: state.phase,
    pressure: toCall,
    pot: state.pot,
    currentBet: state.currentBet,
    bigBlind: table.bigBlind,
    position: seat.position,
    stack: seat.stack,
    streetRaises: state.streetRaises,
  });

  if (toCall > 0) {
    if (raw.action === "fold") return { action: "fold" };
    if (raw.action === "raise" && canRaise(state, seat) && state.streetRaises < 2) return { action: "raise" };
    return { action: "call" };
  }

  if (raw.action === "raise" && canRaise(state, seat) && state.streetRaises < 2) return { action: "raise" };
  return { action: "check" };
}

export function applyClubDecisionBias(state, actor, decision, table) {
  const action = typeof decision === "string" ? decision : decision?.action;
  const toCall = getToCall(state, actor);
  const eventMod = state.clubEvent?.modifier ?? {};
  const moodMod = getMoodDecisionModifier(actor?.mood);
  const callBias = Number(eventMod.callBias ?? 0) + moodMod.callBias;
  const raiseBias = Number(eventMod.raiseBias ?? 0) + moodMod.raiseBias;
  const foldBias = Number(eventMod.foldBias ?? 0) + moodMod.foldBias;

  if (toCall > 0) {
    if (action === "fold" && callBias > 0 && Math.random() < Math.min(0.32, callBias)) return { action: "call", reason: "club_call_bias" };
    if (action === "call" && foldBias > 0 && Math.random() < Math.min(0.24, foldBias)) return { action: "fold", reason: "club_fold_bias" };
    if (action === "call" && raiseBias > 0 && canRaise(state, actor) && Math.random() < Math.min(0.16, raiseBias)) return { action: "raise", reason: "club_raise_bias" };
    return decision;
  }

  if (action === "check" && raiseBias > 0 && canRaise(state, actor) && Math.random() < Math.min(0.18, raiseBias)) return { action: "raise", reason: "club_open_bias" };
  if (action === "raise" && foldBias > 0 && Math.random() < Math.min(0.2, foldBias)) return { action: "check", reason: "club_control_bias" };
  return decision;
}

export function getMoodDecisionModifier(mood = "calm") {
  const mods = {
    hot: { callBias: 0.06, raiseBias: 0.07, foldBias: -0.04 },
    tilted: { callBias: 0.1, raiseBias: 0.05, foldBias: -0.08 },
    locked: { callBias: -0.03, raiseBias: -0.02, foldBias: 0.08 },
    pressure: { callBias: 0.05, raiseBias: -0.03, foldBias: -0.01 },
  };
  return mods[mood] ?? { callBias: 0, raiseBias: 0, foldBias: 0 };
}
