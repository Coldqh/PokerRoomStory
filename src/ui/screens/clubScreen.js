import { canEnterTable, getClubContext } from "../../engine/world.js?v=1.7.2";
import { getClubRoomState } from "../../engine/club.js?v=1.7.2";
import { getClubGoals } from "../../engine/clubGoals.js?v=1.7.2";
import { getClubStorylines } from "../../engine/storylines.js?v=1.7.2";
import { getClubLevelInfo, formatClubReward } from "../../engine/progression.js?v=1.7.2";
import { emptyState, escapeHtml, progressBar } from "../components.js?v=1.7.2";
import { stableIndex } from "./common.js?v=1.7.2";

export function renderClubScreen(state) {
  const context = getClubContext(state.content, state.activeClubId);
  const { club, tables } = context;
  const room = getClubRoomState(state.content, state.clubNpcState, state.activeClubId);
  const journal = room.journal ?? [];
  const visibleJournal = journal.slice(-12).reverse();
  const levelInfo = getClubLevelInfo(state.content, state.career, state.activeClubId);
  const goals = getClubGoals(state.content, state.career, state.activeClubId).slice(0, 5);
  const storylines = getClubStorylines(state.content, state.career, state.activeClubId).slice(0, 1);

  return `
    <section class="room-lobby-layout">
      <article class="panel-soft room-lobby-panel">
        <div class="room-lobby-head">
          <div>
            <span>Cash lobby</span>
            <strong>${escapeHtml(club.name)}</strong>
          </div>
          <em>${tables.length} tables</em>
        </div>
        ${renderClubProgress(levelInfo)}
        <div class="room-table-list">
          ${tables.map((table) => renderTableListItem(state, table)).join("")}
        </div>
      </article>

      <article class="panel-soft club-journal-panel room-journal-panel">
        ${renderStorylinePanel(storylines)}
        ${renderClubGoals(goals)}
        <div class="section-title"><h3>Журнал</h3><span>${visibleJournal.length ? `${visibleJournal.length} последних` : "последнее"}</span></div>
        <div class="feed-list club-journal-list">
          ${visibleJournal.length ? visibleJournal.map((line) => `<div class="feed-line journal-${escapeHtml(line.type ?? "club")}">${escapeHtml(line.text ?? line)}</div>`).join("") : emptyState("Пока пусто.")}
        </div>
      </article>
    </section>
  `;
}



function renderStorylinePanel(storylines = []) {
  if (!storylines.length) return "";
  const story = storylines[0];
  const step = story.currentStep;
  const reward = formatGoalReward(step.reward);
  const progress = step.type === "club_big_pot" ? `$${step.current} / $${step.target}` : `${step.current} / ${step.target}`;
  const characters = (story.characters ?? []).slice(0, 5);
  const stepLabel = story.completed ? "Completed" : `Step ${story.stepIndex + 1}/${story.steps.length}`;

  return `
    <section class="club-story-cutscene" aria-label="Story cutscene">
      <div class="club-story-cutscene-topline">
        <span>Story cutscene</span>
        <em>${escapeHtml(stepLabel)}</em>
      </div>
      <div class="club-story-cutscene-body">
        <div class="club-story-scene">
          <strong>${escapeHtml(story.label ?? story.title)}</strong>
          <span>${escapeHtml(story.title)}</span>
          <p>${escapeHtml(story.intro)}</p>
        </div>
        <div class="club-story-objective ${story.completed ? "completed" : "active"}">
          <span>Current objective</span>
          <strong>${escapeHtml(step.title)}</strong>
          <p>${escapeHtml(step.objective)}</p>
          <div class="club-story-progress-line">
            <em>${escapeHtml(progress)}</em>
            <b>${escapeHtml(reward)}</b>
          </div>
          ${progressBar(step.percent ?? 0)}
        </div>
      </div>
      ${characters.length ? `<div class="club-story-cast"><span>First characters</span>${characters.map((character) => `<button class="story-character-chip" type="button" title="${escapeHtml(character.role)} — ${escapeHtml(character.note)}">${escapeHtml(character.name)}</button>`).join("")}</div>` : ""}
    </section>
  `;
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
  };
  return labels[table?.tableMood] ?? "Обычный стол";
}
