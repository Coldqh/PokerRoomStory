import { evaluateBestHand, estimatePreflopStrength } from "./cards.js?v=0.5.3";

const ARCHETYPE_PROFILES = {
  ARCH_TIGHT_NIT: {
    openBoost: -0.1,
    callBoost: -0.12,
    raiseBoost: -0.06,
    bluffBoost: -0.06,
    showdownCuriosity: -0.1,
  },
  ARCH_LOOSE_CALLER: {
    openBoost: 0.08,
    callBoost: 0.16,
    raiseBoost: -0.04,
    bluffBoost: -0.02,
    showdownCuriosity: 0.12,
  },
  ARCH_CALLING_STATION: {
    openBoost: 0.1,
    callBoost: 0.2,
    raiseBoost: -0.14,
    bluffBoost: -0.12,
    showdownCuriosity: 0.18,
  },
  ARCH_TOURIST_GAMBLER: {
    openBoost: 0.12,
    callBoost: 0.09,
    raiseBoost: 0.02,
    bluffBoost: 0,
    showdownCuriosity: 0.09,
  },
  ARCH_AGGRESSIVE_REG: {
    openBoost: 0.03,
    callBoost: -0.04,
    raiseBoost: 0.11,
    bluffBoost: 0.05,
    showdownCuriosity: -0.02,
  },
  ARCH_MATH_GRINDER: {
    openBoost: -0.02,
    callBoost: -0.03,
    raiseBoost: 0.02,
    bluffBoost: -0.02,
    showdownCuriosity: -0.04,
  },
  ARCH_BANKROLL_BULLY: {
    openBoost: 0.04,
    callBoost: -0.03,
    raiseBoost: 0.13,
    bluffBoost: 0.06,
    showdownCuriosity: -0.01,
  },
  ARCH_OLD_SCHOOL_REG: {
    openBoost: -0.04,
    callBoost: -0.04,
    raiseBoost: -0.02,
    bluffBoost: -0.03,
    showdownCuriosity: -0.04,
  },
};

const POSITION_PROFILE = {
  SB: -0.04,
  BB: 0.03,
  UTG: -0.08,
  MP: -0.03,
  CO: 0.03,
  BTN: 0.08,
};

export function hydrateNpc(content, npc) {
  const archetype = content.byId.archetypes[npc.archetypeId];
  return {
    ...npc,
    archetype,
    stats: buildNpcStats(npc, archetype),
  };
}

export function selectTableNpcs(content, table, club, count = 5) {
  const candidates = club.npcPool
    .map((id) => content.byId.npcs[id])
    .filter(Boolean)
    .filter((npc) => table.npcSelectionRules.tiers.includes(npc.tier))
    .map((npc) => hydrateNpc(content, npc));

  const preferred = candidates.filter((npc) => table.npcSelectionRules.archetypes.includes(npc.archetypeId));
  const pool = preferred.length >= count ? preferred : candidates;

  return shuffle(pool).slice(0, count);
}

export function decideNpcAction({ npc, holeCards, communityCards, phase, pressure = 0, pot = 0, currentBet = 0, bigBlind = 2, position = "MP", stack = 0, streetRaises = 0 }) {
  const profile = ARCHETYPE_PROFILES[npc?.archetypeId] ?? ARCHETYPE_PROFILES.ARCH_LOOSE_CALLER;
  const stats = normalizeStats(npc);
  const context = {
    pressure: Math.max(0, pressure),
    pot: Math.max(0, pot),
    currentBet: Math.max(0, currentBet),
    bigBlind: Math.max(1, bigBlind),
    position,
    stack: Math.max(0, stack),
    streetRaises: Math.max(0, streetRaises),
  };

  const confidence = getNpcConfidence(npc, holeCards, communityCards, phase);
  const potOdds = context.pressure > 0 ? context.pressure / Math.max(context.pot + context.pressure, 1) : 0;

  if (phase === "preflop" || communityCards.length < 3) {
    return decidePreflop({ confidence, stats, profile, context, potOdds });
  }

  return decidePostflop({ confidence, stats, profile, context, potOdds, holeCards, communityCards });
}

export function getNpcConfidence(npc, holeCards, communityCards, phase) {
  const stats = normalizeStats(npc);

  if (phase === "preflop" || communityCards.length < 3) {
    const positionBonus = POSITION_PROFILE[npc?.position] ?? 0;
    return clamp(estimatePreflopStrength(holeCards) * (0.9 + stats.skill / 260) + positionBonus, 0.03, 0.99);
  }

  const best = evaluateBestHand([...holeCards, ...communityCards]);
  const drawBonus = estimateDrawBonus(holeCards, communityCards);
  const categoryPower = best.category / 8;
  const kickerPower = (best.tiebreakers[0] ?? 2) / 14;
  const madeHand = categoryPower * 0.78 + kickerPower * 0.14;

  return clamp(madeHand + drawBonus + stats.skill / 520, 0.03, 0.99);
}

export function getArchetypeUnlockConditions(npcs) {
  return [...new Set(npcs.map((npc) => `meet_${npc.archetypeId}`))];
}

function decidePreflop({ confidence, stats, profile, context, potOdds }) {
  const random = variance(0.055);
  const positionBonus = POSITION_PROFILE[context.position] ?? 0;
  const pressureBb = context.pressure / context.bigBlind;
  const raiseCapPenalty = context.streetRaises >= 2 ? 0.22 : 0;
  const stackRiskPenalty = context.stack > 0 ? Math.min(0.18, context.pressure / Math.max(context.stack, 1) * 0.55) : 0;

  const lowPressureCallDiscount = pressureBb <= 1 ? 0.045 : pressureBb <= 2 ? 0.02 : 0;
  const openLine = clamp(0.5 - stats.vpip * 0.22 + profile.openBoost - positionBonus, 0.22, 0.72);
  const callLine = clamp(0.48 - stats.vpip * 0.16 - stats.risk * 0.08 + profile.callBoost + pressureBb * 0.035 + stackRiskPenalty - lowPressureCallDiscount, 0.2, 0.82);
  const raiseLine = clamp(0.7 - stats.pfr * 0.18 - stats.aggression * 0.12 + raiseCapPenalty - profile.raiseBoost - positionBonus * 0.35, 0.46, 0.9);

  if (context.pressure > 0) {
    if (confidence + profile.showdownCuriosity + random < callLine || (potOdds > 0.38 && confidence < 0.62)) {
      return { action: "fold", confidence, reason: "weak_preflop_call" };
    }

    if (confidence + random > raiseLine && stats.aggression > 0.35 && context.streetRaises < 2) {
      return { action: "raise", confidence, reason: "strong_preflop" };
    }

    return { action: "call", confidence, reason: "continue_preflop" };
  }

  if (confidence + random > raiseLine && stats.pfr > 0.12) {
    return { action: "raise", confidence, reason: "open_raise" };
  }

  if (confidence + random < openLine && stats.discipline > 0.45) {
    return { action: "check", confidence, reason: "check_weak" };
  }

  return stats.aggression > 0.65 && confidence > 0.44 ? { action: "raise", confidence, reason: "thin_open" } : { action: "check", confidence, reason: "see_flop" };
}

function decidePostflop({ confidence, stats, profile, context, potOdds, holeCards, communityCards }) {
  const random = variance(0.065);
  const drawBonus = estimateDrawBonus(holeCards, communityCards);
  const boardDanger = estimateBoardDanger(communityCards);
  const raiseCapPenalty = context.streetRaises >= 2 ? 0.28 : 0;
  const stackRiskPenalty = context.stack > 0 ? Math.min(0.22, context.pressure / Math.max(context.stack, 1) * 0.7) : 0;
  const pressurePenalty = context.pressure > 0 ? potOdds * (0.5 + stats.discipline * 0.25) + stackRiskPenalty : 0;

  const callLine = clamp(0.31 + pressurePenalty - stats.risk * 0.1 - profile.callBoost - profile.showdownCuriosity - drawBonus * 0.35, 0.18, 0.84);
  const valueRaiseLine = clamp(0.72 - stats.aggression * 0.16 - profile.raiseBoost + boardDanger * 0.08 + raiseCapPenalty, 0.48, 0.93);
  const bluffLine = clamp(0.86 - stats.bluff * 0.22 - stats.aggression * 0.12 - profile.bluffBoost + raiseCapPenalty, 0.62, 0.97);

  if (context.pressure > 0) {
    if (confidence + random < callLine) {
      return { action: "fold", confidence, reason: "postflop_pressure" };
    }

    if (confidence + random > valueRaiseLine && context.streetRaises < 2) {
      return { action: "raise", confidence, reason: "value_raise" };
    }

    if (drawBonus > 0.12 && stats.aggression > 0.55 && confidence + random > bluffLine && context.streetRaises < 2) {
      return { action: "raise", confidence, reason: "semi_bluff" };
    }

    return { action: "call", confidence, reason: "pot_control" };
  }

  const betLine = clamp(0.56 - stats.aggression * 0.18 - profile.raiseBoost + boardDanger * 0.06, 0.36, 0.82);
  const bluffOpportunity = drawBonus > 0.08 || boardDanger > 0.12;

  if (confidence + random > betLine) {
    return { action: "raise", confidence, reason: "value_bet" };
  }

  if (bluffOpportunity && stats.bluff > 0.34 && confidence + random > bluffLine) {
    return { action: "raise", confidence, reason: "controlled_bluff" };
  }

  return { action: "check", confidence, reason: "check_back" };
}

function buildNpcStats(npc, archetype) {
  return {
    skill: npc.skillLevel ?? 20,
    vpip: jitter(archetype?.baseVpip ?? 35, 5),
    pfr: jitter(archetype?.basePfr ?? 14, 4),
    aggression: jitter(archetype?.baseAggression ?? 40, 6),
    bluff: jitter(archetype?.baseBluff ?? 18, 5),
    risk: jitter(archetype?.baseRisk ?? 45, 6),
    tilt: jitter(archetype?.baseTilt ?? 35, 5),
    discipline: jitter(archetype?.baseDiscipline ?? 50, 6),
  };
}

function normalizeStats(npc) {
  const stats = npc?.stats ?? buildNpcStats(npc ?? {}, npc?.archetype ?? {});
  return {
    skill: clamp(stats.skill ?? npc?.skillLevel ?? 20, 1, 100),
    vpip: clamp01(stats.vpip ?? 35),
    pfr: clamp01(stats.pfr ?? 14),
    aggression: clamp01(stats.aggression ?? 40),
    bluff: clamp01(stats.bluff ?? 18),
    risk: clamp01(stats.risk ?? 45),
    tilt: clamp01(stats.tilt ?? 35),
    discipline: clamp01(stats.discipline ?? 50),
  };
}

function estimateDrawBonus(holeCards, communityCards) {
  const cards = [...(holeCards ?? []), ...(communityCards ?? [])];
  if (cards.length < 5) return 0;

  const suitCounts = countBy(cards.map((card) => card.suit));
  const maxSuit = Math.max(...Object.values(suitCounts));
  const flushDraw = maxSuit === 4 ? 0.13 : maxSuit >= 5 ? 0.03 : 0;
  const straightDraw = estimateStraightDraw(cards.map((card) => card.value));

  return clamp(flushDraw + straightDraw, 0, 0.22);
}

function estimateStraightDraw(values) {
  const unique = [...new Set(values.map((value) => (value === 14 ? [14, 1] : [value])).flat())];
  let best = 0;

  for (let start = 1; start <= 10; start += 1) {
    const run = [start, start + 1, start + 2, start + 3, start + 4];
    const hits = run.filter((value) => unique.includes(value)).length;
    if (hits >= 4) best = Math.max(best, 0.12);
    else if (hits === 3) best = Math.max(best, 0.05);
  }

  return best;
}

function estimateBoardDanger(communityCards) {
  if (!communityCards || communityCards.length < 3) return 0;
  const suits = countBy(communityCards.map((card) => card.suit));
  const maxSuit = Math.max(...Object.values(suits));
  const paired = new Set(communityCards.map((card) => card.value)).size < communityCards.length;
  const straighty = estimateStraightDraw(communityCards.map((card) => card.value)) > 0.04;
  return clamp((maxSuit >= 3 ? 0.1 : 0) + (paired ? 0.07 : 0) + (straighty ? 0.08 : 0), 0, 0.25);
}

function jitter(value, amount) {
  const delta = Math.round((Math.random() * 2 - 1) * amount);
  return Math.min(100, Math.max(0, value + delta));
}

function variance(amount) {
  return (Math.random() * 2 - 1) * amount;
}

function clamp01(value) {
  return clamp(value / 100, 0, 1);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function countBy(values) {
  return values.reduce((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
