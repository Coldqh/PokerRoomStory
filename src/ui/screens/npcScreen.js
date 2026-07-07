import { getClubContext } from "../../engine/world.js?v=3.5.0";
import { escapeHtml } from "../components.js?v=3.5.0";
import { initials } from "./common.js?v=3.5.0";

export function renderNpcScreen(state) {
  const context = getClubContext(state.content, state.activeClubId);
  const npcs = context.npcs.map((npc) => ({ ...npc, archetype: state.content.byId.archetypes[npc.archetypeId] }));

  return `
    <section class="page-card panel-soft">
      <div class="kicker">Room players</div>
      <h2>Игроки</h2>
    </section>
    <section class="npc-list">
      ${npcs.map(renderNpcItem).join("")}
    </section>
  `;
}

function renderNpcItem(npc) {
  return `
    <article class="npc-item panel-soft">
      <div class="seat-avatar">${escapeHtml(initials(npc.name))}</div>
      <div>
        <strong>${escapeHtml(npc.name)}</strong>
        <span>${escapeHtml(npc.archetype?.name ?? npc.archetypeId)} · ${escapeHtml(npc.tier)}</span>
      </div>
      <em>$${npc.bankroll}</em>
    </article>
  `;
}

