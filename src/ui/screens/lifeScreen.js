import { getLifeView } from "../../engine/life.js?v=2.1.0";
import { escapeHtml, progressBar } from "../components.js?v=2.1.0";

export function renderLifeScreen(state) {
  const view = getLifeView(state.career, state.player);
  const { life } = view;
  return `
    <section class="life-screen">
      <article class="life-hero panel-soft">
        <div>
          <span>Life Hub</span>
          <h2>Жизнь вокруг покера</h2>
          <p>Деньги, энергия, стресс и подготовка теперь важны между сессиями. Выбери, как провести день.</p>
        </div>
        <div class="life-day-card">
          <span>Day</span>
          <strong>${escapeHtml(String(life.day))}</strong>
          <p>${escapeHtml(String(view.actionsLeft))}/${escapeHtml(String(life.actionsPerDay))} действий осталось</p>
        </div>
      </article>

      <section class="life-stats-grid">
        ${renderLifeMeter("Energy", life.energy, `${life.energy}/100`, "Низкая энергия ограничивает действия.")}
        ${renderLifeMeter("Stress", life.stress, `${life.stress}/100`, "Высокий стресс предупреждает о риске тильта.")}
        ${renderLifeMeter("Focus", view.focusPercent, `${life.focusTokens}/3`, "Focus пригодится для будущих reads и разборов.")}
        <article class="life-stat-card panel-soft">
          <span>Rent</span>
          <strong>$${escapeHtml(String(life.rentAmount))}</strong>
          <p>Через ${escapeHtml(String(view.daysUntilRent))} дн. · Долг $${escapeHtml(String(life.debt))}</p>
        </article>
      </section>

      ${view.warnings.length ? `
        <section class="life-warning-panel panel-soft">
          <span>Предупреждения</span>
          ${view.warnings.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}
        </section>
      ` : ""}

      ${life.lastMessage ? `<section class="life-last-message panel-soft"><span>Последнее</span><p>${escapeHtml(life.lastMessage)}</p></section>` : ""}

      <section class="life-actions-grid">
        ${view.actions.map(renderLifeAction).join("")}
      </section>
    </section>
  `;
}

function renderLifeMeter(label, percent, value, hint) {
  return `
    <article class="life-stat-card panel-soft">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      ${progressBar(percent)}
      <p>${escapeHtml(hint)}</p>
    </article>
  `;
}

function renderLifeAction(action) {
  return `
    <article class="life-action-card panel-soft ${action.disabled ? "disabled" : ""}">
      <div>
        <span>${escapeHtml(action.kicker)}</span>
        <strong>${escapeHtml(action.label)}</strong>
        <p>${escapeHtml(action.description)}</p>
        <em>${escapeHtml(action.disabledReason ?? action.effect)}</em>
      </div>
      <button class="primary" type="button" data-action="life-action" data-id="${escapeHtml(action.id)}" ${action.disabled ? "disabled" : ""}>Выбрать</button>
    </article>
  `;
}
