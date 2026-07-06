import { getLifeView } from "../../engine/life.js?v=2.7.0";
import { getBusinessView } from "../../engine/businesses.js?v=2.7.0";
import { getVenueById } from "../../engine/venues.js?v=2.7.0";
import { escapeHtml, progressBar } from "../components.js?v=2.7.0";

export function renderLifeScreen(state) {
  const view = getLifeView(state.career, state.player);
  const { life } = view;
  const homeVenue = getVenueById(state.content, state.activeVenueId) ?? getVenueById(state.content, state.career?.city?.activeVenueId) ?? getVenueById(state.content, "VENUE_RU_MOS_HOME_CHEAP_ROOM");
  const vehicle = view.vehicles.find((entry) => entry.owned);
  const assets = view.assets.filter((entry) => entry.owned);
  const businesses = getBusinessView(state.career, state.player).owned;
  const dailyBusinessProfit = businesses.reduce((sum, row) => sum + Number(row.dailyProfit ?? 0), 0);
  const lockedAtTable = Boolean(state.tableSession?.tableId);
  return `
    <section class="life-screen">
      <article class="life-hero panel-soft">
        <div>
          <span>Life status</span>
          <h2>Жизнь</h2>
          <p>День ${escapeHtml(String(life.day))} · Bankroll $${escapeHtml(String(Math.round(state.player?.bankroll ?? 0)))} · Debt $${escapeHtml(String(life.debt))}</p>
        </div>
        <div class="life-day-card">
          <span>Actions</span>
          <strong>${escapeHtml(String(view.actionsLeft))}/${escapeHtml(String(life.actionsPerDay))}</strong>
          <p>${life.rentAmount > 0 ? `Rent $${escapeHtml(String(life.rentAmount))} через ${escapeHtml(String(view.daysUntilRent))} дн.` : "Жильё куплено · аренды нет"}</p>
        </div>
      </article>

      <section class="life-stats-grid">
        ${renderLifeMeter("Hunger", life.needs.hunger, `${life.needs.hunger}/100`)}
        ${renderLifeMeter("Thirst", life.needs.thirst, `${life.needs.thirst}/100`)}
        ${renderLifeMeter("Energy", life.needs.energy, `${life.needs.energy}/100`)}
        ${renderLifeMeter("Stress", life.needs.stress, `${life.needs.stress}/100`)}
      </section>

      ${lockedAtTable ? `
        <section class="life-warning-panel panel-soft">
          <span>Location</span>
          <p>Ты сейчас за столом. Сначала встань из-за стола.</p>
        </section>
      ` : ""}

      <section class="life-home-panel panel-soft">
        <div>
          <span>Current home</span>
          <strong>${escapeHtml(view.currentHousing.name)}</strong>
          <p>${escapeHtml(view.currentHousing.district)} · ${escapeHtml(view.currentHousing.address)}</p>
          <div class="housing-specs life-home-specs">
            <small>${escapeHtml(String(view.currentHousing.rooms))}к</small>
            <small>${escapeHtml(String(view.currentHousing.sqm))} м²</small>
            <small>до ${escapeHtml(String(view.currentHousing.capacity))} чел.</small>
            <small>${escapeHtml(view.currentHousing.repair)}</small>
          </div>
          <p>Rest: ${escapeHtml(formatEffect(view.currentHousing.restEffect))}</p>
        </div>
        <button class="primary" data-action="life-action" data-id="rest:home" ${view.canRest && !lockedAtTable ? "" : "disabled"}>Отдохнуть дома</button>
        <button data-action="screen" data-id="locations">Выйти в город</button>
      </section>

      ${view.warnings.length ? `
        <section class="life-warning-panel panel-soft">
          <span>Warnings</span>
          ${view.warnings.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}
        </section>
      ` : ""}

      ${life.lastMessage ? `<section class="life-last-message panel-soft"><span>Result</span><p>${escapeHtml(life.lastMessage)}</p></section>` : ""}

      <section class="life-overview-grid">
        <article class="life-section panel-soft">
          <header><span>Inventory</span><strong>Инвентарь</strong></header>
          <div class="life-list compact">
            ${view.inventory.length ? view.inventory.map((entry) => renderInventoryItem(entry, lockedAtTable)).join("") : `<div class="life-empty">Пусто</div>`}
          </div>
        </article>



        <article class="life-section panel-soft">
          <header><span>Business</span><strong>Бизнесы</strong></header>
          <div class="life-list compact">
            ${businesses.length ? businesses.slice(0, 6).map(renderBusinessItem).join("") : `<div class="life-empty">Нет бизнесов</div>`}
          </div>
          <button class="small-button" data-action="select-venue" data-id="VENUE_RU_MOS_BUSINESS_BROKER_001">Business Broker</button>
        </article>

        <article class="life-section panel-soft">
          <header><span>Property</span><strong>Имущество</strong></header>
          <div class="life-summary-list">
            <div><span>Жильё</span><strong>${escapeHtml(view.currentHousing.name)} · ${escapeHtml(view.currentHousing.district)}</strong></div>
            <div><span>Адрес</span><strong>${escapeHtml(view.currentHousing.address)}</strong></div>
            <div><span>Площадь</span><strong>${escapeHtml(String(view.currentHousing.rooms))}к · ${escapeHtml(String(view.currentHousing.sqm))} м² · до ${escapeHtml(String(view.currentHousing.capacity))} чел.</strong></div>
            <div><span>Ремонт</span><strong>${escapeHtml(view.currentHousing.repair)}</strong></div>
            <div><span>Транспорт</span><strong>${escapeHtml(vehicle ? `${vehicle.name} · ${vehicle.class ?? "car"} · upkeep $${vehicle.upkeepPer7Days ?? 0}/7д` : "Нет")}</strong></div>
            <div><span>Вещи</span><strong>${escapeHtml(assets.length ? assets.map((asset) => asset.name).join(", ") : "Нет")}</strong></div>
            <div><span>Бизнесы</span><strong>${escapeHtml(businesses.length ? `${businesses.length} · Profit $${dailyBusinessProfit}/день` : "Нет")}</strong></div>
            <div><span>Текущий объект</span><strong>${escapeHtml(homeVenue?.name ?? "Город")}</strong></div>
          </div>
        </article>
      </section>
    </section>
  `;
}

function renderLifeMeter(label, percent, value) {
  return `
    <article class="life-stat-card panel-soft">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      ${progressBar(percent)}
    </article>
  `;
}

function renderInventoryItem(entry, lockedAtTable = false) {
  return `
    <div class="life-row">
      <div><strong>${escapeHtml(entry.item.name)} x${escapeHtml(String(entry.qty))}</strong><span>${escapeHtml(formatEffect(entry.item.effect))}</span></div>
      <button class="small-button" data-action="life-action" data-id="use:${escapeHtml(entry.item.id)}" ${lockedAtTable ? "disabled" : ""}>Использовать</button>
    </div>
  `;
}

function renderBusinessItem(row) {
  return `
    <div class="life-row">
      <div><strong>${escapeHtml(row.template.name)}</strong><span>Lv.${escapeHtml(String(row.owned.level))} · Profit $${escapeHtml(String(row.dailyProfit))}/день · к сбору $${escapeHtml(String(row.collectableProfit))}</span></div>
      <button class="small-button" data-action="select-venue" data-id="VENUE_RU_MOS_BUSINESS_BROKER_001">Управлять</button>
    </div>
  `;
}

function formatEffect(effect = {}) {
  const labels = {
    hunger: "Hunger",
    thirst: "Thirst",
    energy: "Energy",
    stress: "Stress",
    status: "Status",
  };
  return Object.entries(effect)
    .filter(([, value]) => Number(value) !== 0)
    .map(([key, value]) => `${labels[key] ?? key} ${Number(value) > 0 ? "+" : ""}${Number(value)}`)
    .join(" · ") || "—";
}
