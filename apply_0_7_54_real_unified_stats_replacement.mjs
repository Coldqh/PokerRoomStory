import fs from "node:fs";
import path from "node:path";

const VERSION = "0.7.54";
const root = process.cwd();
const utf8 = "utf8";

const file = (p) => path.join(root, p);
const exists = (p) => fs.existsSync(file(p));
const read = (p) => fs.readFileSync(file(p), utf8).replace(/^\uFEFF/, "");
const write = (p, text) => {
  fs.mkdirSync(path.dirname(file(p)), { recursive: true });
  fs.writeFileSync(file(p), text.replace(/^\uFEFF/, ""), utf8);
};

const required = [
  "src/balance/formulas.ts",
  "src/systems/itemSystem.ts",
  "src/systems/pvpStatSystem.ts",
  "src/systems/combatSystem.ts",
  "src/systems/arena3v3System.ts",
  "src/systems/pvpDuelSystem.ts",
  "src/systems/npcLocationSystem.ts",
  "src/ui/components/CastlePanel.tsx",
  "scripts/perf-runtime-scale.mjs",
  "scripts/smoke.mjs",
  "package.json",
  "public/version.json",
  "public/sw.js",
  "src/engine/version.ts",
];

const missing = required.filter((p) => !exists(p));
if (missing.length) {
  console.error("Missing files:\n" + missing.map((p) => "- " + p).join("\n"));
  process.exit(1);
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupDir = `.mmows_0754_backup_${stamp}`;
fs.mkdirSync(file(backupDir), { recursive: true });
for (const p of required) {
  const dest = file(path.join(backupDir, p));
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(file(p), dest);
}

const replaceBetween = (source, startNeedle, endNeedle, replacement, label) => {
  const start = source.indexOf(startNeedle);
  if (start < 0) throw new Error(`Start anchor not found: ${label}`);
  const end = source.indexOf(endNeedle, start);
  if (end < 0) throw new Error(`End anchor not found: ${label}`);
  return source.slice(0, start) + replacement + source.slice(end);
};

const replaceFunction = (source, functionNeedle, nextNeedle, replacement, label) => {
  const start = source.indexOf(functionNeedle);
  if (start < 0) throw new Error(`Function anchor not found: ${label}`);
  const end = source.indexOf(nextNeedle, start);
  if (end < 0) throw new Error(`Next anchor not found: ${label}`);
  return source.slice(0, start) + replacement + "\n\n" + source.slice(end);
};

const unwrapArenaCombatantMaker = (source, marker) => {
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`Arena maker not found: ${marker}`);
  const end = source.indexOf("\n};", start);
  if (end < 0) throw new Error(`Arena maker end not found: ${marker}`);
  let segment = source.slice(start, end + 4);
  segment = segment.replace("return applyArenaRoleScaling({", "return {");
  segment = segment.replace(/\n\s*\}\);\s*\n\};\s*$/, "\n  };\n};");
  return source.slice(0, start) + segment + source.slice(end + 4);
};

// 1) Version files.
{
  let pkg;
  try { pkg = JSON.parse(read("package.json")); } catch { pkg = {}; }
  pkg.name = "mmoworldsimulator";
  pkg.private = true;
  pkg.version = VERSION;
  pkg.type = "module";
  pkg.scripts = {
    dev: "vite --host 0.0.0.0",
    build: "vite build",
    typecheck: "tsc --noEmit",
    "build:github": "vite build",
    preview: "vite preview --host 0.0.0.0",
    sanity: "node scripts/sanity-check.mjs",
    smoke: "node scripts/smoke.mjs",
    "smoke:test": "node scripts/smoke-test.mjs",
    "import:graph": "node scripts/import-graph-check.mjs",
    "perf:skip-day": "node scripts/perf-skip-day.mjs",
    "content:check": "node scripts/content-validation.mjs && node scripts/expansion-rule-validation.mjs",
    "perf:scale": "node scripts/perf-scale.mjs",
    "perf:runtime": "node scripts/perf-runtime-scale.mjs",
    "content:rules": "node scripts/expansion-rule-validation.mjs"
  };
  pkg.dependencies = pkg.dependencies ?? {
    "@vitejs/plugin-react": "latest",
    react: "latest",
    "react-dom": "latest",
    zustand: "latest"
  };
  pkg.devDependencies = pkg.devDependencies ?? {
    "@types/node": "latest",
    "@types/react": "latest",
    "@types/react-dom": "latest",
    typescript: "latest",
    vite: "latest"
  };
  write("package.json", JSON.stringify(pkg, null, 2) + "\n");
  write("src/engine/version.ts", `export const APP_VERSION = '${VERSION}';\n`);

  let publicVersion = {};
  try { publicVersion = JSON.parse(read("public/version.json")); } catch {}
  publicVersion.version = VERSION;
  publicVersion.channel = "stable";
  publicVersion.build = "2026-07-03-v0754-real-unified-stats";
  publicVersion.buildTime = new Date().toISOString();
  write("public/version.json", JSON.stringify(publicVersion, null, 2) + "\n");

  let sw = read("public/sw.js");
  sw = sw.replace(/CACHE_NAME\s*=\s*['"][^'"]+['"]/, `CACHE_NAME = 'mmows-v${VERSION}'`);
  write("public/sw.js", sw);

  let smoke = read("scripts/smoke.mjs");
  smoke = smoke.replace(/0\.7\.\d+/g, VERSION);
  smoke = smoke.replace(/mmows-v0\.7\.\d+/g, `mmows-v${VERSION}`);
  write("scripts/smoke.mjs", smoke);
}

// 2) Balance formulas: enhancement is percent-based for GS.
{
  let text = read("src/balance/formulas.ts");
  if (!text.includes("export const getEnhancementMultiplier")) {
    text = text.replace(
      "const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));",
      "const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));\n\nexport const MAX_ENHANCEMENT_LEVEL = 12;\n\nexport const getEnhancementMultiplier = (enhancement = 0) => {\n  const safe = clamp(Math.round(enhancement || 0), 0, MAX_ENHANCEMENT_LEVEL);\n  return 1 + safe * 0.10;\n};"
    );
  } else {
    text = text.replace(/export const getEnhancementMultiplier = \(enhancement = 0\)[\s\S]*?\n\};/, "export const getEnhancementMultiplier = (enhancement = 0) => {\n  const safe = clamp(Math.round(enhancement || 0), 0, MAX_ENHANCEMENT_LEVEL);\n  return 1 + safe * 0.10;\n};");
  }

  const replacement = `export const calculateGearScore = (item: ItemDefinition, enhancement = 0, cardIds: Array<string | GearScoreCardLike> = []) => {
  const cardPower = cardIds.reduce<number>((sum, card) => {
    if (typeof card === 'string') return sum + GEAR_SCORE.cardStringFallback;
    return sum + cardGearValue(card) * 0.42;
  }, 0);
  const base =
    statScore(item.stats) * GEAR_SCORE.stat +
    item.levelReq * GEAR_SCORE.level +
    (RARITY_SCORE[item.rarity] ?? 1) * GEAR_SCORE.rarity +
    getSlotPower(item.slot) * 7 +
    (item.socketSlots ?? 0) * GEAR_SCORE.socket;
  return Math.max(1, Math.round(base * getEnhancementMultiplier(enhancement) + cardPower));
};`;
  text = replaceFunction(text, "export const calculateGearScore =", "export const calculateXpForNextLevel", replacement, "calculateGearScore");
  if (text.includes("calculateEnhancementValue(enhancement")) throw new Error("calculateGearScore still uses calculateEnhancementValue");
  write("src/balance/formulas.ts", text);
}

// 3) Item stats: +1 enhance = +10% item stats. Cards and set bonuses stay separate.
{
  let text = read("src/systems/itemSystem.ts");
  text = text.replace("import { calculateGearScore } from '../balance';", "import { calculateGearScore, getEnhancementMultiplier } from '../balance';");
  const replacement = `export const getEquipmentStats = (equipment: Equipment): Partial<StatBlock> => {
  const result: Partial<StatBlock> = {};

  Object.values(equipment).forEach((instance) => {
    if (!instance) return;
    const item = getItemById(instance.itemId);
    if (!item) return;

    const enhancementMultiplier = getEnhancementMultiplier(instance.enhancement);
    Object.entries(item.stats).forEach(([key, value]) => {
      const statKey = key as keyof StatBlock;
      result[statKey] = (result[statKey] ?? 0) + (value ?? 0) * enhancementMultiplier;
    });
    (instance.cardIds ?? []).forEach((cardId: string) => {
      const card = getItemById(cardId);
      if (card?.type === 'card') addStats(result, card.stats);
    });
  });

  return result;
};`;
  text = replaceFunction(text, "export const getEquipmentStats =", "export type ActiveSetBonus", replacement, "getEquipmentStats");
  if (text.includes("enhancementBonus")) throw new Error("itemSystem still contains enhancementBonus");
  write("src/systems/itemSystem.ts", text);
}

// 4) PvP/NPC stats: no displayedGear/missingGear. NPC = player-like stats from real equipment.
{
  const text = `import type { NpcPlayer, Player, StatBlock } from '../types/game';
import { getGearScore, getPlayerStats } from './itemSystem';

export const playerLikeFromNpc = (npc: NpcPlayer): Player => ({
  id: npc.id,
  name: npc.name,
  raceId: npc.raceId,
  classId: npc.classId,
  level: npc.level,
  xp: npc.xp ?? 0,
  gold: npc.gold ?? 0,
  hp: 1,
  mana: 0,
  inventory: npc.inventory ?? [],
  equipment: npc.equipment ?? {},
  guildId: npc.guildId,
  reputation: npc.reputation ?? 0,
  arenaRating: npc.arenaRating ?? 1000,
});

export const getNpcEffectiveGearScore = (npc: NpcPlayer) => getGearScore(npc.equipment ?? {});

export const getNpcPlayerEquivalentStats = (npc: NpcPlayer): StatBlock => getPlayerStats(playerLikeFromNpc(npc));

export const getNpcPvpDebugLine = (npc: NpcPlayer) => {
  const stats = getNpcPlayerEquivalentStats(npc);
  return npc.name + ': Lv.' + npc.level + ' ' + npc.classId + ' GS ' + getNpcEffectiveGearScore(npc) + ' HP ' + stats.hp + ' ATK ' + stats.attack + ' MAG ' + stats.magic + ' DEF ' + stats.defense;
};
`;
  write("src/systems/pvpStatSystem.ts", text);
}

// 5) Combat party NPC stats: use NPC player-equivalent stats.
{
  let text = read("src/systems/combatSystem.ts");
  if (!text.includes("from './pvpStatSystem'")) {
    text = text.replace("import { finishGuildWarDefeatV2, finishGuildWarVictoryV2 } from './guildWarCombatResultSystem';", "import { finishGuildWarDefeatV2, finishGuildWarVictoryV2 } from './guildWarCombatResultSystem';\nimport { getNpcPlayerEquivalentStats } from './pvpStatSystem';");
  }
  const replacement = `const npcCombatStats = (server: ServerState, npcId: string) => {
  const npc = server.npcs.find((entry) => entry.id === npcId);
  const level = npc?.level ?? server.player.level;
  const stats = npc ? getNpcPlayerEquivalentStats(npc) : getPlayerStats(server.player);
  const classId = npc?.classId ?? 'ranger';
  return {
    id: npcId,
    name: npc?.name ?? npcId,
    classId,
    level,
    maxHp: stats.hp,
    maxMana: stats.mana,
    attack: stats.attack,
    magic: stats.magic,
    defense: stats.defense,
    heal: Math.max(8, Math.round((stats.magic + stats.attack) * 0.35 + level * 2)),
  };
};`;
  text = replaceFunction(text, "const npcCombatStats =", "const createPartyMembers", replacement, "npcCombatStats");
  write("src/systems/combatSystem.ts", text);
}

// 6) Arena: remove hidden role/GS stat scaling. Role affects AI only.
{
  let text = read("src/systems/arena3v3System.ts");
  text = text.replace(/\nconst applyArenaRoleScaling = <T extends CombatantV2>\(unit: T\): T => \{[\s\S]*?\n\};\n(?=\nconst aggressionFromRole)/, "\n");
  text = unwrapArenaCombatantMaker(text, "const makePlayerCombatant =");
  text = unwrapArenaCombatantMaker(text, "const makeNpcCombatant =");
  if (text.includes("applyArenaRoleScaling") || text.includes("gearPulse")) throw new Error("arena hidden scaling still present");
  write("src/systems/arena3v3System.ts", text);
}

// 7) PvP duel: use real player GS.
{
  let text = read("src/systems/pvpDuelSystem.ts");
  text = text.replace("import { getPlayerStats } from './itemSystem';", "import { getGearScore, getPlayerStats } from './itemSystem';");
  text = text.replace("gearScore: Object.values(server.player.equipment ?? {}).length * 100,", "gearScore: getGearScore(server.player.equipment),");
  text = text.replace(/Math\.max\(1, Object\.values\(server\.player\.equipment \?\? \{\}\)\.length \* 100\)/g, "Math.max(1, getGearScore(server.player.equipment))");
  if (text.includes("Object.values(server.player.equipment")) throw new Error("pvpDuelSystem still uses fake player GS");
  write("src/systems/pvpDuelSystem.ts", text);
}

// 8) Mojibake literal fix.
{
  let text = read("src/systems/npcLocationSystem.ts");
  text = text.replaceAll("СѓС€С‘Р» РІ РіРѕСЂРѕРґ", "ушёл в город");
  text = text.replaceAll("СѓС€РµР» РІ РіРѕСЂРѕРґ", "ушёл в город");
  write("src/systems/npcLocationSystem.ts", text);
}

// 9) Castle panel: no debug scoreSummary in player UI.
{
  let text = read("src/ui/components/CastlePanel.tsx");
  text = text.replace("<small>{last.scoreSummary}</small>", "<small>Итог: {guildName(last.winnerGuildId)} выиграла последнюю осаду.</small>");
  if (text.includes("<small>{last.scoreSummary}</small>")) throw new Error("CastlePanel still renders raw scoreSummary");
  write("src/ui/components/CastlePanel.tsx", text);
}

// 10) Runtime checks: invert previous bad checks and verify removal.
{
  let text = read("scripts/perf-runtime-scale.mjs");
  text = text.replace(/ok\(arena3v3Source\.includes\('applyArenaRoleScaling'\), 'arena role stat scaling is wired'\);\n?/g, "ok(!arena3v3Source.includes('applyArenaRoleScaling'), 'arena hidden stat scaling is removed');\n");
  text = text.replace(/ok\(arena3v3Source\.includes\('applyArenaRoleScaling'\), 'arena role stat scaling is wired'\);\r?\n?/g, "ok(!arena3v3Source.includes('applyArenaRoleScaling'), 'arena hidden stat scaling is removed');\n");

  if (!text.includes("real unified stats replacement is wired")) {
    text += `

var itemSystem0754 = read('src/systems/itemSystem.ts');
ok(itemSystem0754.includes('getEnhancementMultiplier(instance.enhancement)'), 'enhancement scales item stats by percent');
ok(!itemSystem0754.includes('enhancementBonus'), 'flat enhancement stat bonus is removed');

var formulas0754 = read('src/balance/formulas.ts');
ok(formulas0754.includes('getEnhancementMultiplier'), 'enhancement multiplier exists');
ok(!formulas0754.includes('calculateEnhancementValue(enhancement'), 'gear score does not use flat enhancement value');

var pvpStats0754 = read('src/systems/pvpStatSystem.ts');
ok(!pvpStats0754.includes('missingGear'), 'NPC hidden missingGear stat boost is removed');
ok(!pvpStats0754.includes('displayedGear'), 'NPC displayedGear stat boost is removed');

var arena0754 = read('src/systems/arena3v3System.ts');
ok(!arena0754.includes('applyArenaRoleScaling'), 'arena hidden role scaling is removed');
ok(!arena0754.includes('gearPulse'), 'arena gearPulse is removed');

var duel0754 = read('src/systems/pvpDuelSystem.ts');
ok(!duel0754.includes('Object.values(server.player.equipment'), 'PvP fake player gear score is removed');
ok(duel0754.includes('getGearScore(server.player.equipment)'), 'PvP uses real player gear score');

var npcLocation0754 = read('src/systems/npcLocationSystem.ts');
ok(!npcLocation0754.includes('СѓС€С'), 'npc location mojibake is removed');

var castle0754 = read('src/ui/components/CastlePanel.tsx');
ok(!castle0754.includes('<small>{last.scoreSummary}</small>'), 'castle UI does not show raw scoreSummary debug');
console.log('real unified stats replacement is wired');
`;
  }
  write("scripts/perf-runtime-scale.mjs", text);
}

// 11) Remove BOM from project source/config files.
{
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === "dist" || entry.name === ".git" || entry.name.startsWith(".mmows_0754_backup_")) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(json|js|mjs|cjs|ts|tsx|css|html)$/.test(entry.name)) {
        const content = fs.readFileSync(full, utf8).replace(/^\uFEFF/, "");
        fs.writeFileSync(full, content, utf8);
      }
    }
  };
  walk(root);
}

console.log(`0.7.54 Real Unified Stats Replacement applied.`);
console.log(`Backup created: ${backupDir}`);
