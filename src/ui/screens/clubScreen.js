import { canEnterTable, getClubContext } from "../../engine/world.js?v=0.9.9";
import { getClubRoomState } from "../../engine/club.js?v=0.9.9";
import { emptyState, escapeHtml } from "../components.js?v=0.9.9";
import { stableIndex } from "./common.js?v=0.9.9";

export function renderClubScreen(state) {
  const context = getClubContext(state.content, state.activeClubId);
  const { club, tables } = context;
  const room = getClubRoomState(state.content, state.clubNpcState, state.activeClubId);
  const journal = room.journal ?? [];

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
        <div class="room-table-list">
          ${tables.map((table) => renderTableListItem(state, table)).join("")}
        </div>
      </article>

      <article class="panel-soft club-journal-panel room-journal-panel">
        <div class="section-title"><h3>Журнал</h3><span>последнее</span></div>
        <div class="feed-list club-journal-list">
          ${journal.length ? journal.slice(-6).reverse().map((line) => `<div class="feed-line journal-${escapeHtml(line.type ?? "club")}">${escapeHtml(line.text ?? line)}</div>`).join("") : emptyState("Пока пусто.")}
        </div>
      </article>
    </section>
  `;
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

