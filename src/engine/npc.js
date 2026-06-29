import { evaluateBestHand, estimatePreflopStrength } from "./cards.js";

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

export function decideNpcAction({ npc, holeCards, communityCards, phase, pressure, pot }) {
  const confidence = getNpcConfidence(npc, holeCards, communityCards, phase);
  const aggression = npc.stats.aggression / 100;
  const bluff = npc.stats.bluff / 100;
  const discipline = npc.stats.discipline / 100;
  const risk = npc.stats.risk / 100;

  const random = Math.random();
  const pressurePenalty = pressure ? 0.16 + pressure / Math.max(60, pot + 1) : 0;
  const foldLine = 0.18 + pressurePenalty + discipline * 0.08 - risk * 0.07;
  const raiseLine = 0.7 - aggression * 0.24 - bluff * 0.08;

  if (confidence < foldLine && pressure > 0) {
    return { action: "fold", confidence };
  }

  if (confidence + random * 0.28 > raiseLine && aggression > 0.35) {
    return { action: "raise", confidence };
  }

  return { action: pressure > 0 ? "call" : "check", confidence };
}

export function getNpcConfidence(npc, holeCards, communityCards, phase) {
  if (phase === "preflop" || communityCards.length < 3) {
    return estimatePreflopStrength(holeCards) * (0.85 + npc.stats.skill / 180);
  }

  const best = evaluateBestHand([...holeCards, ...communityCards]);
  const categoryPower = best.category / 8;
  const kickerPower = (best.tiebreakers[0] ?? 2) / 14;
  return Math.min(0.98, categoryPower * 0.78 + kickerPower * 0.22 + npc.stats.skill / 420);
}

export function getArchetypeUnlockConditions(npcs) {
  return [...new Set(npcs.map((npc) => `meet_${npc.archetypeId}`))];
}

function buildNpcStats(npc, archetype) {
  return {
    skill: npc.skillLevel,
    vpip: jitter(archetype.baseVpip, 8),
    pfr: jitter(archetype.basePfr, 6),
    aggression: jitter(archetype.baseAggression, 10),
    bluff: jitter(archetype.baseBluff, 8),
    risk: jitter(archetype.baseRisk, 8),
    tilt: jitter(archetype.baseTilt, 8),
    discipline: jitter(archetype.baseDiscipline, 8),
  };
}

function jitter(value, amount) {
  const delta = Math.round((Math.random() * 2 - 1) * amount);
  return Math.min(100, Math.max(0, value + delta));
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
