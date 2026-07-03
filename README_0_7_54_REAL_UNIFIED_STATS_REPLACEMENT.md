# MMOWorldSimulator 0.7.54 — Real Unified Stats Replacement

Этот архив НЕ содержит старый `.patch` для `git apply`. Он содержит один локальный replacement-скрипт, который жёстко переписывает нужные участки в текущих файлах проекта и делает backup.

## Что чинит

- Убирает hidden arena scaling: `applyArenaRoleScaling`, `gearPulse`.
- Убирает flat enhancement stats: `enhancementBonus`.
- Заточка: `+1 = +10%` к статам предмета и GS предмета, `+12 = 220%`.
- Убирает hidden NPC stat boost от `displayedGear/missingGear`.
- Убирает fake player GS в PvP: `Object.values(equipment).length * 100`.
- Dungeon party NPC stats идут через player-equivalent stats.
- Чинит mojibake `СѓС€С‘Р» РІ РіРѕСЂРѕРґ`.
- Убирает debug `last.scoreSummary` из UI замков.
- Обновляет версию до 0.7.54.

## Как применить

```powershell
cd C:/MMOWorldSimulator/mmoworldsimulator
Expand-Archive -Path C:/Users/pahom/Downloads/mmows_0_7_54_real_unified_stats_replacement.zip -DestinationPath . -Force
node .pply_0_7_54_real_unified_stats_replacement.mjs
```

## Проверка

```powershell
npm run typecheck
npm run build
npm run content:check
npm run perf:scale
npm run perf:runtime
npm run smoke
```

## Жёсткие grep-проверки

Должно быть пусто:

```powershell
git grep -n "applyArenaRoleScaling"
git grep -n "gearPulse"
git grep -n "enhancementBonus"
git grep -n "calculateEnhancementValue(enhancement"
git grep -n "missingGear"
git grep -n "displayedGear"
git grep -n "Object.values(server.player.equipment"
git grep -n "СѓС€С"
git grep -n "<small>{last.scoreSummary}</small>"
```

Должно что-то найти:

```powershell
git grep -n "getEnhancementMultiplier"
git grep -n "getGearScore(server.player.equipment"
git grep -n "getNpcPlayerEquivalentStats"
```

## Коммит

```powershell
del apply_0_7_54_real_unified_stats_replacement.mjs

git status
git diff --stat

git add package.json public/version.json public/sw.js src/engine/version.ts scripts/smoke.mjs scripts/perf-runtime-scale.mjs src/balance/formulas.ts src/systems/itemSystem.ts src/systems/pvpStatSystem.ts src/systems/combatSystem.ts src/systems/arena3v3System.ts src/systems/pvpDuelSystem.ts src/systems/npcLocationSystem.ts src/ui/components/CastlePanel.tsx

git commit -m "fix: replace hidden stat scaling with unified rules"
git push origin main
```
