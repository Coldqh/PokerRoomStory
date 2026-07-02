const fs = require("fs");
const path = require("path");
const childProcess = require("child_process");

const ROOT = process.cwd();
const VERSION = "2.8.26";
const CACHE_VERSION = "fight-simulator-fight-camp-mvp-2.8.26";

function file(rel) { return path.join(ROOT, rel); }
function exists(rel) { return fs.existsSync(file(rel)); }
function read(rel) { return fs.readFileSync(file(rel), "utf8"); }
function write(rel, text) {
  fs.mkdirSync(path.dirname(file(rel)), { recursive: true });
  fs.writeFileSync(file(rel), text, "utf8");
}
function fail(msg) { throw new Error(msg); }
function run(args, label) {
  console.log("=== " + label + " ===");
  childProcess.execFileSync(process.execPath, args, { cwd: ROOT, stdio: "inherit" });
}
function replaceOnce(text, needle, replacement, label) {
  if (text.indexOf(replacement) !== -1) { return text; }
  if (text.indexOf(needle) === -1) { fail("Patch anchor not found: " + label); }
  return text.replace(needle, replacement);
}
function addScriptBefore(indexText, newSrc, beforeSrc) {
  if (indexText.indexOf('src="' + newSrc + '"') !== -1) { return indexText; }
  const anchor = '  <script src="' + beforeSrc + '"></script>';
  if (indexText.indexOf(anchor) === -1) { fail("index.html anchor not found: " + beforeSrc); }
  return indexText.replace(anchor, '  <script src="' + newSrc + '"></script>\n' + anchor);
}
function addPrecache(sw, precachePath) {
  if (sw.indexOf('"' + precachePath + '"') !== -1) { return sw; }
  const anchors = [
    '  "./src/core/fight.js"',
    '  "./src/core/fight/outcomes.js"',
    '  "./src/ui/render.js"',
    '  "./src/app.js"'
  ];
  for (let i = 0; i < anchors.length; i += 1) {
    if (sw.indexOf(anchors[i]) !== -1) {
      return sw.replace(anchors[i], '  "' + precachePath + '",\n' + anchors[i]);
    }
  }
  fail("sw.js precache anchor not found for " + precachePath);
}
function findFunctionStart(text, name) {
  const re = new RegExp("function\\s+" + name + "\\s*\\(");
  const match = re.exec(text);
  if (!match) { fail("Function not found: " + name); }
  return match.index;
}
function findFunctionEnd(text, start) {
  const braceStart = text.indexOf("{", start);
  if (braceStart === -1) { fail("Function brace not found"); }
  let depth = 0;
  let quote = "";
  let escape = false;
  for (let i = braceStart; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      if (escape) { escape = false; continue; }
      if (ch === "\\") { escape = true; continue; }
      if (ch === quote) { quote = ""; }
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") { quote = ch; continue; }
    if (ch === "{") { depth += 1; }
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) { return i + 1; }
    }
  }
  fail("Function end not found");
}
function patchFunction(text, name, patcher) {
  const start = findFunctionStart(text, name);
  const end = findFunctionEnd(text, start);
  const before = text.slice(0, start);
  const body = text.slice(start, end);
  const after = text.slice(end);
  return before + patcher(body) + after;
}
function insertBeforeFunction(text, functionName, block, marker) {
  if (text.indexOf(marker) !== -1) { return text; }
  const start = findFunctionStart(text, functionName);
  return text.slice(0, start) + block + text.slice(start);
}

const CAMP_JS = `(function () {
  "use strict";

  window.FS = window.FS || {};

  var U = window.FS.Utils;
  var State = window.FS.State;

  var PLANS = [
    { id: "technique", label: "Техника", cost: 8, chance: 3, accuracy: 5, damageMul: 1, defenseMul: 1, stamina: 0, ko: 0, effect: "+3 шанс / +5 точность / +8 усталость" },
    { id: "power", label: "Сила", cost: 10, chance: 1, accuracy: 0, damageMul: 1.08, defenseMul: 1, stamina: 0, ko: 6, effect: "+8% урон / +6 KO / +10 усталость" },
    { id: "cardio", label: "Кардио", cost: 8, chance: 2, accuracy: 0, damageMul: 1, defenseMul: 1, stamina: 18, ko: 0, effect: "+18 стамина / +2 шанс / +8 усталость" },
    { id: "defense", label: "Защита", cost: 7, chance: 2, accuracy: 0, damageMul: 1, defenseMul: 0.92, stamina: 0, ko: 0, effect: "-8% входящий урон / +2 шанс / +7 усталость" },
    { id: "scouting", label: "Скаутинг", cost: 3, chance: 5, accuracy: 0, damageMul: 1, defenseMul: 1, stamina: 0, ko: 0, effect: "+5 шанс / +3 усталость" },
    { id: "recovery", label: "Восстановление", recovery: true, cost: -14, chance: 0, accuracy: 0, damageMul: 1, defenseMul: 1, stamina: 0, ko: 0, effect: "-14 усталость / без бонуса" }
  ];

  function clamp(value, min, max) {
    if (U && U.clamp) { return U.clamp(value, min, max); }
    return Math.max(min, Math.min(max, value));
  }

  function player(state) {
    return State && State.player ? State.player(state) : null;
  }

  function planById(id) {
    var i;
    for (i = 0; i < PLANS.length; i += 1) {
      if (PLANS[i].id === id) { return PLANS[i]; }
    }
    return null;
  }

  function plans() {
    return PLANS.map(function (plan) {
      return { id: plan.id, label: plan.label, effect: plan.effect, recovery: !!plan.recovery };
    });
  }

  function current(state) {
    var p = player(state);
    var camp = p && p.fightCamp;
    if (!camp || !planById(camp.id)) { return null; }
    return camp;
  }

  function currentPlan(state) {
    var camp = current(state);
    return camp ? planById(camp.id) : null;
  }

  function isPlayerFighter(state, fighter) {
    var p = player(state);
    return !!(p && fighter && (fighter.isPlayer || fighter.id === p.id));
  }

  function addFatigue(state, amount, reason) {
    var p = player(state);
    amount = Math.round(Number(amount) || 0);
    if (!p || !amount) { return; }
    if (State && State.adjustFatigue) { State.adjustFatigue(state, amount, reason || "Лагерь"); }
    else { p.fatigue = clamp((Number(p.fatigue) || 0) + amount, 0, 100); }
  }

  function select(state, planId) {
    var p = player(state);
    var plan = planById(planId);
    var existing = current(state);
    var charge;
    if (!p || !plan) { return false; }

    if (plan.recovery) {
      if (p.lastFightCampRecoveryWeek === state.week) {
        state.feed = "Восстановление уже было на этой неделе.";
        return false;
      }
      p.fightCamp = null;
      p.lastFightCampRecoveryWeek = state.week;
      addFatigue(state, plan.cost, "Восстановление");
      state.feed = "Восстановление: усталость -14.";
      return true;
    }

    charge = !(existing && existing.week === state.week);
    p.fightCamp = { id: plan.id, week: state.week };
    if (charge) { addFatigue(state, plan.cost, "Лагерь"); }
    state.feed = "Лагерь: " + plan.label + ".";
    return true;
  }

  function clear(state) {
    var p = player(state);
    if (p) { p.fightCamp = null; }
  }

  function consumeAfterFight(state) {
    if (current(state)) { clear(state); }
  }

  function modifyWinChance(state, chance) {
    var plan = currentPlan(state);
    if (!plan || plan.recovery) { return chance; }
    return clamp(Math.round((Number(chance) || 0) + (Number(plan.chance) || 0)), 5, 97);
  }

  function accuracyBonus(state, fighter) {
    var plan = currentPlan(state);
    if (!plan || !isPlayerFighter(state, fighter)) { return 0; }
    return Number(plan.accuracy) || 0;
  }

  function damageMultiplier(state, attacker, defender) {
    var plan = currentPlan(state);
    if (!plan) { return 1; }
    if (isPlayerFighter(state, attacker)) { return Number(plan.damageMul) || 1; }
    if (isPlayerFighter(state, defender)) { return Number(plan.defenseMul) || 1; }
    return 1;
  }

  function staminaBonus(state, fighter) {
    var plan = currentPlan(state);
    if (!plan || !isPlayerFighter(state, fighter)) { return 0; }
    return Number(plan.stamina) || 0;
  }

  function koBonus(state, fighter) {
    var plan = currentPlan(state);
    if (!plan || !isPlayerFighter(state, fighter)) { return 0; }
    return Number(plan.ko) || 0;
  }

  function currentLabel(state) {
    var plan = currentPlan(state);
    return plan ? plan.label : "нет";
  }

  function currentEffect(state) {
    var plan = currentPlan(state);
    return plan ? plan.effect : "";
  }

  window.FS.FightCamp = {
    plans: plans,
    current: current,
    currentPlan: currentPlan,
    currentLabel: currentLabel,
    currentEffect: currentEffect,
    select: select,
    clear: clear,
    consumeAfterFight: consumeAfterFight,
    modifyWinChance: modifyWinChance,
    accuracyBonus: accuracyBonus,
    damageMultiplier: damageMultiplier,
    staminaBonus: staminaBonus,
    koBonus: koBonus
  };
}());
`;

function patchIndex() {
  let text = read("index.html");
  text = addScriptBefore(text, "src/core/fight/camp.js", "src/core/fight.js");
  write("index.html", text);
}
function patchFightActions() {
  const rel = "src/app/actions/fight-actions.js";
  let text = read(rel);
  if (text.indexOf("button.dataset.fightCamp") === -1) {
    const needle = '    if (button.dataset.fightAction) {\n';
    const block = '    if (button.dataset.fightCamp) {\n' +
      '      if (window.FS.FightCamp && window.FS.FightCamp.select) { window.FS.FightCamp.select(state, button.dataset.fightCamp); }\n' +
      '      ctx.saveAndRender();\n' +
      '      return true;\n' +
      '    }\n\n';
    text = replaceOnce(text, needle, block + needle, "fight-actions camp handler");
  }
  write(rel, text);
}
function patchRender() {
  const rel = "src/ui/render.js";
  let text = read(rel);
  const campFunction = `  function renderFightCampCard(state) {
    var camp = window.FS.FightCamp;
    var current;
    var plans;
    var locked = State.isLockedByFatigue && State.isLockedByFatigue(state);
    if (!camp || !camp.plans) { return ""; }
    current = camp.currentPlan ? camp.currentPlan(state) : null;
    plans = camp.plans();

    function button(plan) {
      var active = current && current.id === plan.id;
      var disabled = locked && !plan.recovery ? ' disabled' : '';
      return '<button class="small-btn ' + (active ? 'primary' : '') + '" data-fight-camp="' + U.escapeHtml(plan.id) + '"' + disabled + '>' + U.escapeHtml(plan.label) + '<span class="muted small">' + U.escapeHtml(plan.effect || "") + '</span></button>';
    }

    return '<div class="content-card fight-camp-card"><div class="split-row"><h3>Лагерь</h3><strong>' + U.escapeHtml(current ? current.label : "нет") + '</strong></div>' +
      (current ? '<div class="muted small">' + U.escapeHtml(current.effect || "") + '</div>' : '') +
      '<div class="row" style="margin-top:10px">' + plans.map(button).join("") + '</div></div>';
  }

`;
  text = insertBeforeFunction(text, "renderFightsTab", campFunction, "function renderFightCampCard");

  text = patchFunction(text, "renderFightsTab", function (body) {
    if (body.indexOf("renderFightCampCard(state)") !== -1) { return body; }
    const needle = "return '<div class=\"f1-fights-top\">' +";
    if (body.indexOf(needle) === -1) { fail("renderFightsTab return anchor not found"); }
    return body.replace(needle, "return renderFightCampCard(state) + '<div class=\"f1-fights-top\">' +");
  });

  write(rel, text);
}
function insertAfterRegex(text, regex, block, marker, label) {
  if (text.indexOf(marker) !== -1) { return text; }
  const match = regex.exec(text);
  if (!match) { fail("Patch regex anchor not found: " + label); }
  const at = match.index + match[0].length;
  return text.slice(0, at) + block + text.slice(at);
}

function patchFight() {
  const rel = "src/core/fight.js";
  let text = read(rel);
  const helperBlock = `

  function fightCampModule() {
    return window.FS.FightCamp || null;
  }

  function campModifyWinChance(state, chance) {
    var camp = fightCampModule();
    return camp && camp.modifyWinChance ? camp.modifyWinChance(state, chance) : chance;
  }

  function campAccuracyBonus(fighter) {
    var camp = fightCampModule();
    return camp && camp.accuracyBonus ? camp.accuracyBonus(window.FS.__currentFightState || null, fighter) : 0;
  }

  function campDamageMultiplier(attacker, defender) {
    var camp = fightCampModule();
    return camp && camp.damageMultiplier ? camp.damageMultiplier(window.FS.__currentFightState || null, attacker, defender) : 1;
  }

  function campStaminaBonus(fighter) {
    var camp = fightCampModule();
    return camp && camp.staminaBonus ? camp.staminaBonus(window.FS.__currentFightState || null, fighter) : 0;
  }

  function campKoBonus(fighter) {
    var camp = fightCampModule();
    return camp && camp.koBonus ? camp.koBonus(window.FS.__currentFightState || null, fighter) : 0;
  }

  function campClearAfterFight(state) {
    var camp = fightCampModule();
    if (camp && camp.consumeAfterFight) { camp.consumeAfterFight(state); }
  }
`;

  text = insertAfterRegex(text, /  var RING_SIZE\s*=\s*5\s*;\s*/, helperBlock, "function fightCampModule()", "fight.js RING_SIZE");

  text = patchFunction(text, "estimateWinChanceWithContext", function (body) {
    if (body.indexOf("campModifyWinChance(state,") !== -1) { return body; }
    const pattern = /return\s+U\.clamp\(([^;]+),\s*12,\s*94\);/;
    if (!pattern.test(body)) { fail("estimateWinChanceWithContext return clamp not found"); }
    return body.replace(pattern, "return campModifyWinChance(state, U.clamp($1, 12, 94));");
  });

  text = patchFunction(text, "hitChance", function (body) {
    if (body.indexOf("campAccuracyBonus(attacker)") !== -1) { return body; }
    return replaceOnce(body, '    var attackGrowth = attacker.stats.technique * 0.38 + attacker.stats.speed * 0.27 + fightCoachBonus(attacker) * 0.9;', '    var attackGrowth = attacker.stats.technique * 0.38 + attacker.stats.speed * 0.27 + fightCoachBonus(attacker) * 0.9 + campAccuracyBonus(attacker);', "hitChance camp accuracy");
  });

  text = patchFunction(text, "punchDamage", function (body) {
    if (body.indexOf("campDamageMultiplier(attacker, defender)") !== -1) { return body; }
    return replaceOnce(body, '    var damage = Math.round((basePunchDamage(punch) + variance) * damageScale(attacker) * trackDamageMultiplier(attacker.trackId) * repeatPenalty(attackerState, punch.id));', '    var damage = Math.round((basePunchDamage(punch) + variance) * damageScale(attacker) * trackDamageMultiplier(attacker.trackId) * repeatPenalty(attackerState, punch.id) * campDamageMultiplier(attacker, defender));', "punchDamage camp multiplier");
  });

  text = patchFunction(text, "estimatePunchDamage", function (body) {
    if (body.indexOf("campDamageMultiplier(attacker, defender)") !== -1) { return body; }
    return replaceOnce(body, '    var damage = Math.round(basePunchDamage(punch) * damageScale(attacker) * trackDamageMultiplier(attacker.trackId) * repeatPenalty(attackerState, punch.id));', '    var damage = Math.round(basePunchDamage(punch) * damageScale(attacker) * trackDamageMultiplier(attacker.trackId) * repeatPenalty(attackerState, punch.id) * campDamageMultiplier(attacker, defender));', "estimatePunchDamage camp multiplier");
  });

  text = patchFunction(text, "maxStamina", function (body) {
    if (body.indexOf("campStaminaBonus(fighter)") !== -1) { return body; }
    return replaceOnce(body, '    return Math.round(100 + fighter.stats.stamina * 0.5);', '    return Math.round(100 + fighter.stats.stamina * 0.5 + campStaminaBonus(fighter));', "maxStamina camp stamina");
  });

  text = patchFunction(text, "autoKoChance", function (body) {
    if (body.indexOf("campKoBonus(fighter)") !== -1) { return body; }
    return replaceOnce(body, '    return U.clamp(Math.round(base + powerEdge * 0.18), track === "amateur" ? 6 : 18, track === "street" ? 90 : (track === "pro" ? 80 : 30));', '    return U.clamp(Math.round(base + powerEdge * 0.18 + campKoBonus(fighter)), track === "amateur" ? 6 : 18, track === "street" ? 90 : (track === "pro" ? 80 : 30));', "autoKoChance camp bonus");
  });

  text = patchFunction(text, "completeFightEconomy", function (body) {
    if (body.indexOf("campClearAfterFight(state)") !== -1) { return body; }
    return replaceOnce(body, '    if (State.adjustFatigue) { State.adjustFatigue(state, finalFatigue, "Бой"); }\n', '    if (State.adjustFatigue) { State.adjustFatigue(state, finalFatigue, "Бой"); }\n    campClearAfterFight(state);\n', "completeFightEconomy clear camp");
  });

  write(rel, text);
}

function updateVersionFiles() {
  let data = read("src/data/game-data.js");
  data = data.replace(/"appVersion"\s*:\s*"[^"]+"/, '"appVersion": "' + VERSION + '"');
  write("src/data/game-data.js", data);

  const version = JSON.parse(read("version.json"));
  version.version = VERSION;
  version.mode = "fight-camp-mvp";
  version.cacheVersion = CACHE_VERSION;
  write("version.json", JSON.stringify(version, null, 2) + "\n");

  let sw = read("sw.js");
  if (!/const CACHE_VERSION\s*=/.test(sw)) { fail("sw.js CACHE_VERSION line not found"); }
  sw = sw.replace(/const CACHE_VERSION\s*=\s*"[^"]*"\s*;/, 'const CACHE_VERSION = "' + CACHE_VERSION + '";');
  sw = addPrecache(sw, "./src/core/fight/camp.js");
  write("sw.js", sw);
}
function main() {
  console.log("Fight Simulator Gameplay Pack 1 - Fight Camp MVP 2.8.26 FIX3/RECOVERY");
  console.log("Repository root: " + ROOT);

  const required = ["index.html", "src/core/fight.js", "src/ui/render.js", "src/app/actions/fight-actions.js", "src/data/game-data.js", "version.json", "sw.js"];
  required.forEach(function (rel) { if (!exists(rel)) { fail("Required file missing: " + rel); } });

  write("src/core/fight/camp.js", CAMP_JS);
  patchIndex();
  patchFightActions();
  patchRender();
  patchFight();

  run(["--check", "src/core/fight/camp.js"], "node check camp.js");
  run(["--check", "src/core/fight.js"], "node check fight.js");
  run(["--check", "src/ui/render.js"], "node check render.js");
  run(["--check", "src/app/actions/fight-actions.js"], "node check fight-actions.js");

  updateVersionFiles();

  if (exists("scripts/patch-check.cjs")) { run(["scripts/patch-check.cjs"], "final patch-check after 2.8.26 fix3"); }
  console.log("Patch applied.");
}

try {
  main();
} catch (error) {
  console.error("\nFAILED:");
  console.error(error && (error.stack || error.message) || error);
  process.exit(1);
}
