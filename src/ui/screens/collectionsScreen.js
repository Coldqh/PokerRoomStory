import { badges, escapeHtml } from "../components.js?v=3.7.0";

export function renderCollectionsScreen(state) {
  const unlocked = new Set(state.career.unlockedCollections);
  return `
    <section class="page-card panel-soft">
      <div class="kicker">Vault</div>
      <h2>Коллекции</h2>
    </section>
    <section class="cards-grid">
      ${state.content.collections.map((item) => renderCollectionItem(item, unlocked.has(item.id))).join("")}
    </section>
  `;
}

function renderCollectionItem(item, unlocked) {
  return `
    <article class="simple-card panel-soft ${unlocked ? "" : "locked"}">
      <strong>${unlocked ? escapeHtml(item.name) : "Закрыто"}</strong>
      <p>${unlocked ? escapeHtml(item.flavor) : "Откроется в игре."}</p>
      ${badges([item.category, item.rarity], unlocked ? "gold" : "")}
    </article>
  `;
}

