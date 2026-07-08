import { badges, escapeHtml } from "../components.js?v=3.7.0";

export function renderGlossaryScreen(state) {
  const unlocked = new Set(state.career.unlockedGlossary);
  return `
    <section class="page-card panel-soft">
      <div class="kicker">Terms</div>
      <h2>Словарь</h2>
    </section>
    <section class="hand-rank-guide panel-soft">
      <div class="section-title"><h3>Комбинации</h3><span>Texas Hold’em</span></div>
      <div class="hand-rank-grid">
        ${HAND_RANK_GUIDE.map(renderHandRankGuideItem).join("")}
      </div>
    </section>
    <section class="cards-grid">
      ${state.content.glossaryTerms.map((term) => renderGlossaryTerm(term, unlocked.has(term.id))).join("")}
    </section>
  `;
}

const HAND_RANK_GUIDE = [
  ["Старшая карта", "Нет пары. Решает самая высокая карта."],
  ["Пара", "Две карты одного ранга."],
  ["Две пары", "Две разные пары."],
  ["Сет", "Три карты одного ранга."],
  ["Стрит", "Пять карт подряд."],
  ["Флеш", "Пять карт одной масти."],
  ["Фулл-хаус", "Сет плюс пара."],
  ["Каре", "Четыре карты одного ранга."],
  ["Стрит-флеш", "Стрит одной масти."],
];

function renderHandRankGuideItem([name, text], index) {
  return `
    <div class="hand-rank-item">
      <em>${index + 1}</em>
      <strong>${escapeHtml(name)}</strong>
      <span>${escapeHtml(text)}</span>
    </div>
  `;
}

function renderGlossaryTerm(term, unlocked) {
  return `
    <article class="simple-card panel-soft ${unlocked ? "" : "locked"}">
      <strong>${unlocked ? escapeHtml(term.name) : "Закрыто"}</strong>
      <p>${unlocked ? escapeHtml(term.short) : "Откроется в игре."}</p>
      ${unlocked ? badges([term.category, term.realTerm], "red") : badges([term.category])}
    </article>
  `;
}

