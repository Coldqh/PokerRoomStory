import { decideNpcAction } from "../npc.js?v=3.4.1";
import { canRaise, getToCall } from "./betting.js?v=3.4.1";

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

  const withMeta = (decision) => attachDecisionMeta(decision, { raw, state, seat, table, toCall });

  if (toCall > 0) {
    if (raw.action === "fold") return withMeta({ action: "fold" });
    if (raw.action === "raise" && canRaise(state, seat) && state.streetRaises < 2) return withMeta({ action: "raise" });
    return withMeta({ action: "call", reason: raw.action === "raise" ? "raise_blocked_call" : raw.reason });
  }

  if (raw.action === "raise" && canRaise(state, seat) && state.streetRaises < 2) return withMeta({ action: "raise" });
  return withMeta({ action: "check", reason: raw.action === "raise" ? "raise_blocked_check" : raw.reason });
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
    if (action === "fold" && callBias > 0 && Math.random() < Math.min(0.32, callBias)) return withBiasReason(decision, "call", "club_call_bias");
    if (action === "call" && foldBias > 0 && Math.random() < Math.min(0.24, foldBias)) return withBiasReason(decision, "fold", "club_fold_bias");
    if (action === "call" && raiseBias > 0 && canRaise(state, actor) && Math.random() < Math.min(0.16, raiseBias)) return withBiasReason(decision, "raise", "club_raise_bias");
    return decision;
  }

  if (action === "check" && raiseBias > 0 && canRaise(state, actor) && Math.random() < Math.min(0.18, raiseBias)) return withBiasReason(decision, "raise", "club_open_bias");
  if (action === "raise" && foldBias > 0 && Math.random() < Math.min(0.2, foldBias)) return withBiasReason(decision, "check", "club_control_bias");
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

function attachDecisionMeta(decision, { raw, state, seat, table, toCall }) {
  const action = typeof decision === "string" ? decision : decision?.action;
  const reason = typeof decision === "object" && decision?.reason ? decision.reason : raw?.reason;
  const pressure = Math.max(0, Number(toCall ?? 0));
  const pot = Math.max(0, Number(state?.pot ?? 0));
  return {
    ...(typeof raw === "object" ? raw : {}),
    ...(typeof decision === "object" ? decision : {}),
    action,
    reason: reason ?? "npc_decision",
    confidence: normalizeMetaNumber(raw?.confidence),
    toCall: pressure,
    potOdds: pressure > 0 ? normalizeMetaNumber(pressure / Math.max(pot + pressure, 1)) : 0,
    currentBet: Number(state?.currentBet ?? 0),
    bigBlind: Number(table?.bigBlind ?? state?.bigBlind ?? 0),
    stack: Number(seat?.stack ?? 0),
  };
}

function withBiasReason(decision, action, reason) {
  const base = typeof decision === "object" ? decision : { action: decision };
  return {
    ...base,
    action,
    reason,
    previousReason: base.reason,
  };
}

function normalizeMetaNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 1000) / 1000 : null;
}
