import { canEnterClub, canEnterTable, getClubContext } from "../../engine/world.js?v=2.6.0";
import { getClubRoomState } from "../../engine/club.js?v=2.6.0";
import { getClubGoals } from "../../engine/clubGoals.js?v=2.6.0";
import { getClubStorylines } from "../../engine/storylines.js?v=2.6.0";
import { getClubLevelInfo, formatClubReward } from "../../engine/progression.js?v=2.6.0";
import { emptyState, escapeHtml, progressBar } from "../components.js?v=2.6.0";
import { stableIndex } from "./common.js?v=2.6.0";

export function renderClubScreen(state) {
  const context = getClubContext(state.content, state.activeClubId);
  const { club, tables } = context;
  const levelInfo = getClubLevelInfo(state.content, state.career, state.activeClubId);
  const goals = getClubGoals(state.content, state.career, state.activeClubId).slice(0, 5);
  const storylines = getClubStorylines(state.content, state.career, state.activeClubId).slice(0, 1);
  const cityClubs = getCityClubs(state.content, club.cityId);

  return `
    <section class="club-lobby-shell">
      ${renderStorylinePanel(storylines)}
      <section class="club-lobby-main-grid club-lobby-clean-grid">
        <article class="panel-soft club-lobby-home-panel">
          <div class="room-lobby-head">
            <div>
              <span>Cash lobby</span>
              <strong>${escapeHtml(club.name)}</strong>
            </div>
            <em>${tables.length} tables</em>
          </div>
          ${renderClubProgress(levelInfo)}
          ${renderClubActions(state, club, cityClubs, tables)}
        </article>

        <article class="panel-soft club-goals-panel">
          ${renderClubGoals(goals)}
        </article>
      </section>
      ${renderClubPickerModal(state, club, cityClubs)}
      ${renderTablePickerModal(state, tables)}
    </section>
  `;
}

function renderClubActions(state, activeClub, clubs = [], tables = []) {
  const availableTables = tables.filter((table) => canEnterTable(state.player, table).ok).length;
  const clubCount = clubs.length;
  const hasClubPicker = clubCount > 1;
  return `
    <section class="club-action-grid" aria-label="Club actions">
      <article class="club-action-card primary-action">
        <div>
          <span>Play</span>
          <strong>Играть за столом</strong>
          <p>Выбери лимит, состав и buy-in в отдельном окне.</p>
        </div>
        <em>${availableTables}/${tables.length} столов доступны</em>
        <button class="primary club-action-button" type="button" data-action="open-table-picker">Выбрать стол</button>
      </article>
      <article class="club-action-card map-action">
        <div>
          <span>City map</span>
          <strong>Карта локаций</strong>
          <p>Посмотри путь по Москве: текущий клуб, закрытые комнаты и прогресс маршрутов.</p>
        </div>
        <em>Москва · ${clubCount} клуба</em>
        <button class="small-button club-action-button" type="button" data-action="screen" data-id="locations">Вернуться на карту</button>
      </article>
      ${hasClubPicker ? `
        <article class="club-action-card secondary-action">
          <div>
            <span>Quick switch</span>
            <strong>Быстрый выбор клуба</strong>
            <p>Текущий клуб: ${escapeHtml(activeClub.name)}. Полная прогрессия теперь на карте.</p>
          </div>
          <em>${clubCount} клуба в городе</em>
          <button class="small-button club-action-button" type="button" data-action="open-club-picker">Выбрать клуб</button>
        </article>
      ` : ""}
    </section>
  `;
}

function renderClubPickerModal(state, activeClub, clubs = []) {
  if (clubs.length <= 1) return "";
  const open = Boolean(state.system?.clubPickerOpen);
  return `
    <div class="club-picker-backdrop ${open ? "is-open" : ""}" data-action="close-modal" role="dialog" aria-modal="true" aria-label="Выбор клуба">
      <div class="club-picker-dialog panel-soft">
        <div class="club-picker-dialog-head">
          <div>
            <span>Moscow clubs</span>
            <strong>Выбери клуб</strong>
          </div>
          <button class="drawer-close" type="button" data-action="close-modal" aria-label="Закрыть">×</button>
        </div>
        <div class="club-location-list">
          ${clubs.map((club) => renderClubSelectorItem(state, activeClub, club)).join("")}
        </div>
      </div>
    </div>
  `;
}

function renderClubSelectorItem(state, activeClub, club) {
  const access = canEnterClub(state.player, state.career, club);
  const active = activeClub?.id === club.id;
  const tables = club.tables?.length ?? 0;
  const story = getClubStorylines(state.content, state.career, club.id)[0];
  const routeLabel = story ? (story.completed ? "Route complete" : `Route ${story.stepIndex + 1}/${story.steps.length}`) : "No route";
  const label = active ? "Текущий" : access.ok ? "Открыт" : "Закрыт";
  return `
    <button class="club-location-card ${active ? "active" : ""} ${access.ok ? "open" : "locked"}" type="button" data-action="select-club" data-id="${escapeHtml(club.id)}" ${access.ok ? "" : "disabled"}>
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(club.name)}</strong>
      <em>${escapeHtml(club.tier ?? "Club")} · ${tables} tables · ${escapeHtml(routeLabel)}</em>
      ${access.ok ? "" : `<small>${escapeHtml(access.reason)}</small>`}
    </button>
  `;
}

function getCityClubs(content, cityId) {
  return (content?.clubs ?? []).filter((club) => club.cityId === cityId);
}

function renderStorylinePanel(storylines = []) {
  if (!storylines.length) return "";
  const story = storylines[0];
  const step = story.currentStep;
  const reward = formatGoalReward(step.reward);
  const progress = step.type === "club_big_pot" || step.type === "player_bankroll" ? `$${step.current} / $${step.target}` : `${step.current} / ${step.target}`;
  const characters = getSceneCharacters(story, step);
  const stepLabel = story.completed ? "Completed" : `Step ${story.stepIndex + 1}/${story.steps.length}`;
  const sceneLines = Array.isArray(step.cutscene) && step.cutscene.length ? step.cutscene : [story.intro];
  const unlock = step.unlocks ?? story.unlocked ?? (story.completed ? story.unlocks : null);

  return `
    <section class="club-story-cutscene" aria-label="Story cutscene">
      <div class="club-story-cutscene-topline">
        <span>Story cutscene</span>
        <em>${escapeHtml(stepLabel)}</em>
      </div>
      <div class="club-story-cutscene-body">
        <div class="club-story-scene">
          <span>${escapeHtml(story.title)}</span>
          <strong>${escapeHtml(step.title)}</strong>
          <div class="club-story-lines">
            ${sceneLines.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}
          </div>
          ${characters.length ? `<div class="club-story-cast"><span>В сцене</span>${characters.map((character) => `<button class="story-character-chip" type="button" title="${escapeHtml(character.role)} — ${escapeHtml(character.note)}">${escapeHtml(character.name)}</button>`).join("")}</div>` : ""}
          ${unlock?.clubLabel ? `<div class="club-story-location-unlock"><span>Следующая локация</span><strong>${escapeHtml(unlock.clubLabel)}</strong></div>` : ""}
        </div>
        <div class="club-story-objective ${story.completed ? "completed" : "active"}">
          <span>${story.completed ? "Route completed" : "Current objective"}</span>
          <strong>${escapeHtml(story.label ?? story.title)}</strong>
          <p>${escapeHtml(step.objective)}</p>
          <div class="club-story-progress-line">
            <em>${escapeHtml(progress)}</em>
            <b>${escapeHtml(reward)}</b>
          </div>
          ${progressBar(step.percent ?? 0)}
        </div>
      </div>
    </section>
  `;
}

function getSceneCharacters(story, step) {
  const all = story.characters ?? [];
  const ids = new Set(step?.characterIds ?? []);
  if (!ids.size) return all.slice(0, 2);
  return all.filter((character) => ids.has(character.id));
}

function renderClubGoals(goals = []) {
  const completed = goals.filter((goal) => goal.completed).length;
  return `
    <section class="club-goals-board" aria-label="Club Goals">
      <div class="club-goals-head">
        <div>
          <span>Club Goals</span>
          <strong>Доска клуба</strong>
        </div>
        <em>${completed}/${goals.length}</em>
      </div>
      <div class="club-goals-grid">
        ${goals.length ? goals.map(renderClubGoalLine).join("") : emptyState("Цели появятся после открытия клуба.")}
      </div>
    </section>
  `;
}

function renderClubGoalLine(goal) {
  const reward = formatGoalReward(goal.reward);
  const progress = goal.type === "club_big_pot" ? `$${goal.current} / $${goal.target}` : `${goal.current} / ${goal.target}`;
  return `
    <article class="club-goal-card ${goal.completed ? "completed" : "active"}">
      <div class="club-goal-card-head">
        <span>${goal.completed ? "Done" : "Goal"}</span>
        <em>${escapeHtml(progress)}</em>
      </div>
      <strong>${escapeHtml(goal.name)}</strong>
      <p>${escapeHtml(goal.description)}</p>
      ${progressBar(goal.percent ?? 0)}
      <div class="club-goal-reward">${escapeHtml(reward)}</div>
    </article>
  `;
}

function formatGoalReward(reward = {}) {
  const parts = [];
  if (reward.xp) parts.push(`XP +${reward.xp}`);
  if (reward.reputation) parts.push(`Rep +${reward.reputation}`);
  return parts.length ? parts.join(" · ") : "без награды";
}

function renderTablePickerModal(state, tables = []) {
  const open = Boolean(state.system?.tablePickerOpen);
  const availableCount = tables.filter((table) => canEnterTable(state.player, table).ok).length;
  return `
    <div class="table-picker-backdrop ${open ? "is-open" : ""}" data-action="close-modal" role="dialog" aria-modal="true" aria-label="Выбор стола">
      <div class="table-picker-dialog panel-soft">
        <div class="table-picker-dialog-head">
          <div>
            <span>Table select</span>
            <strong>Выбери стол</strong>
          </div>
          <div class="table-picker-dialog-actions">
            <em>${availableCount}/${tables.length} доступны</em>
            <button class="drawer-close" type="button" data-action="close-modal" aria-label="Закрыть">×</button>
          </div>
        </div>
        <div class="room-table-list table-picker-list">
          ${tables.map((table) => renderTableListItem(state, table)).join("")}
        </div>
      </div>
    </div>
  `;
}

function renderFocusedTablePreview(state, table, availableCount, totalCount) {
  const access = canEnterTable(state.player, table);
  const seats = table.seats ?? 6;
  const occupied = Math.min(seats, table.occupiedSeats ?? Math.max(1, seats - 1));
  const status = access.ok ? "доступен" : "закрыт";
  return `
    <div class="club-table-focus-card ${access.ok ? "open" : "locked"}">
      <div>
        <span>Текущий ориентир</span>
        <strong>${escapeHtml(table.name)}</strong>
      </div>
      <p>${escapeHtml(table.tableProfileLabel ?? getTableMoodLabel(table))} · ${escapeHtml(table.gameLabel ?? `$${table.smallBlind}/$${table.bigBlind}`)} · ${occupied}/${seats} seats</p>
      <em>${availableCount}/${totalCount} столов доступны · ${escapeHtml(status)}</em>
    </div>
  `;
}

function getLobbyFocusTable(state, tables = []) {
  if (!tables.length) return null;
  const active = tables.find((table) => table.id === state.tableSession?.tableId);
  if (active) return active;
  return tables.find((table) => canEnterTable(state.player, table).ok) ?? tables[0];
}

function renderTableListItem(state, table) {
  const access = canEnterTable(state.player, table);
  const active = state.tableSession?.tableId === table.id;
  const occupied = Math.min(table.seats ?? 6, table.occupiedSeats ?? Math.max(1, (table.seats ?? 6) - 1));
  const seatsLabel = `${occupied}/${table.seats ?? 6}`;
  const buyIn = `$${table.minBuyIn}–$${table.maxBuyIn}`;
  const players = getLobbyTablePlayers(state, table).map((npc) => escapeHtml(npc.name)).join(" · ");
  const full = occupied >= (table.seats ?? 6);
  const status = active ? "Сидишь" : access.ok ? (full ? "Очередь" : "Свободно") : "Закрыт";
  const buttonLabel = active ? "Играть" : access.ok ? (full ? "Очередь" : "Buy-in") : "Закрыт";
  const statusClass = active ? "seated" : access.ok ? (full ? "waiting" : "open") : "locked";
  const canUseTable = active || (access.ok && !full);

  return `
    <article class="table-item room-table-row ${active ? "selected" : ""} ${access.ok || active ? "" : "locked"}">
      <div class="room-table-number">${escapeHtml(String(table.tableNumber ?? ""))}</div>
      <div class="room-table-main">
        <div class="room-table-title">
          <strong>${escapeHtml(table.name)}</strong>
          <span>${escapeHtml(table.gameLabel ?? `$${table.smallBlind}/$${table.bigBlind} NL Hold’em`)}</span>
        </div>
        <div class="room-table-meta">
          <span>Buy-in ${escapeHtml(buyIn)}</span>
          <span>Seats ${escapeHtml(seatsLabel)}</span>
          <span>Avg pot $${Number(table.avgPot ?? table.bigBlind * 12)}</span>
          <span>${Number(table.handsPerHour ?? 30)} hands/h</span>
          <span>${escapeHtml(table.tableProfileLabel ?? getTableMoodLabel(table))}</span>
        </div>
        <div class="room-table-players">${players || "Состав обновляется"}</div>
        ${access.ok || active ? "" : `<div class="room-table-lock">${escapeHtml(access.reason)}</div>`}
      </div>
      <div class="room-table-side">
        <span class="table-status ${statusClass}">${escapeHtml(status)}</span>
        <button class="small-button ${active ? "primary" : ""}" data-action="select-table" data-id="${escapeHtml(table.id)}" ${canUseTable ? "" : "disabled"}>
          ${escapeHtml(buttonLabel)}
        </button>
      </div>
    </article>
  `;
}

function getLobbyTablePlayers(state, table) {
  const rules = table.npcSelectionRules ?? {};
  const tiers = new Set(rules.tiers ?? []);
  const archetypes = new Set(rules.archetypes ?? []);
  const pool = (state.content.npcs ?? []).filter((npc) => {
    const tierOk = !tiers.size || tiers.has(npc.tier);
    const archetypeOk = !archetypes.size || archetypes.has(npc.archetypeId);
    return tierOk && archetypeOk;
  });

  const source = pool.length ? pool : state.content.npcs ?? [];
  const start = stableIndex(table.id, Math.max(1, source.length));
  return Array.from({ length: Math.min(4, source.length) }, (_, offset) => source[(start + offset) % source.length]).filter(Boolean);
}

function renderClubProgress(info) {
  if (!info?.club) return "";
  const reward = info.nextReward ? formatClubReward(info.nextReward) : "Все награды открыты";
  const xpLine = info.nextLevel ? `${info.xp} / ${info.nextXp} XP` : `${info.xp} XP`;
  return `
    <div class="club-progress-card">
      <div class="club-progress-main">
        <div>
          <span>Room Mastery</span>
          <strong>${escapeHtml(info.club.name)} Lv.${escapeHtml(String(info.level))}</strong>
        </div>
        <em>${escapeHtml(xpLine)}</em>
      </div>
      ${progressBar(info.percent)}
      <div class="club-progress-reward">
        <span>${info.nextLevel ? `Следующая награда · Lv.${info.nextLevel}` : "Максимум"}</span>
        <strong>${escapeHtml(reward)}</strong>
      </div>
    </div>
  `;
}

function getTableMoodLabel(table) {
  const labels = {
    starter: "Стартовый стол",
    short_action: "Короткий стол",
    loose: "Лузовая игра",
    regular: "Регулярский стол",
    back_room: "Закрытый стол",
    underground_entry: "Входной регулярский",
    deep_stack: "Deep stack",
    pressure: "Pressure table",
    owners_table: "Стол владельца",
  };
  return labels[table?.tableMood] ?? "Обычный стол";
}
