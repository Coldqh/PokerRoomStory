import { getLifeView } from "../../engine/life.js?v=2.2.0";
import { escapeHtml, progressBar } from "../components.js?v=2.2.0";

export function renderLifeScreen(state) {
  const view = getLifeView(state.career, state.player);
  const { life } = view;
  return `
    <section class="life-screen">
      <article class="life-hero panel-soft">
        <div>
          <span>Life</span>
          <h2>Жизнь</h2>
          <p>День ${escapeHtml(String(life.day))} · Bankroll $${escapeHtml(String(Math.round(state.player?.bankroll ?? 0)))} · Debt $${escapeHtml(String(life.debt))}</p>
        </div>
        <div class="life-day-card">
          <span>Actions</span>
          <strong>${escapeHtml(String(view.actionsLeft))}/${escapeHtml(String(life.actionsPerDay))}</strong>
          <p>Rent $${escapeHtml(String(life.rentAmount))} через ${escapeHtml(String(view.daysUntilRent))} дн.</p>
        </div>
      </article>

      <section class="life-stats-grid">
        ${renderLifeMeter("Hunger", life.needs.hunger, `${life.needs.hunger}/100`)}
        ${renderLifeMeter("Thirst", life.needs.thirst, `${life.needs.thirst}/100`)}
        ${renderLifeMeter("Energy", life.needs.energy, `${life.needs.energy}/100`)}
        ${renderLifeMeter("Stress", life.needs.stress, `${life.needs.stress}/100`)}
      </section>

      <section class="life-home-panel panel-soft">
        <div>
          <span>Housing</span>
          <strong>${escapeHtml(view.currentHousing.name)}</strong>
          <p>Rest: ${escapeHtml(formatEffect(view.currentHousing.restEffect))}</p>
        </div>
        <button class="primary" data-action="life-action" data-id="rest:home" ${view.canRest ? "" : "disabled"}>Отдохнуть дома</button>
        <button data-action="life-action" data-id="playClub" ${view.canPlayClub ? "" : "disabled"}>Играть в клубе</button>
      </section>

      ${view.warnings.length ? `
        <section class="life-warning-panel panel-soft">
          <span>Warnings</span>
          ${view.warnings.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}
        </section>
      ` : ""}

      ${life.lastMessage ? `<section class="life-last-message panel-soft"><span>Result</span><p>${escapeHtml(life.lastMessage)}</p></section>` : ""}

      <section class="life-section panel-soft">
        <header><span>Inventory</span><strong>Инвентарь</strong></header>
        <div class="life-list compact">
          ${view.inventory.length ? view.inventory.map(renderInventoryItem).join("") : `<div class="life-empty">Пусто</div>`}
        </div>
      </section>

      <section class="life-section panel-soft">
        <header><span>Corner Store</span><strong>Магазин</strong></header>
        <div class="life-list">
          ${view.items.map(renderShopItem).join("")}
        </div>
      </section>

      <section class="life-section panel-soft">
        <header><span>Cheap Cafe</span><strong>Кафе</strong></header>
        <div class="life-list">
          ${view.cafeOrders.map(renderCafeOrder).join("")}
        </div>
      </section>

      <section class="life-section panel-soft">
        <header><span>Work</span><strong>Работа</strong></header>
        <div class="life-list">
          ${view.jobs.map(renderJob).join("")}
        </div>
      </section>

      <section class="life-section panel-soft">
        <header><span>Housing</span><strong>Жильё</strong></header>
        <div class="life-list">
          ${view.housing.map(renderHousing).join("")}
        </div>
      </section>

      <section class="life-section panel-soft">
        <header><span>Assets</span><strong>Имущество</strong></header>
        <div class="life-list">
          ${view.assets.map(renderAsset).join("")}
        </div>
      </section>

      <section class="life-section panel-soft">
        <header><span>Transport</span><strong>Транспорт</strong></header>
        <div class="life-list">
          ${view.vehicles.map(renderVehicle).join("")}
        </div>
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

function renderInventoryItem(entry) {
  return `
    <div class="life-row">
      <div><strong>${escapeHtml(entry.item.name)} x${escapeHtml(String(entry.qty))}</strong><span>${escapeHtml(formatEffect(entry.item.effect))}</span></div>
      <button class="small-button" data-action="life-action" data-id="use:${escapeHtml(entry.item.id)}">Использовать</button>
    </div>
  `;
}

function renderShopItem(item) {
  return `
    <div class="life-row">
      <div><strong>${escapeHtml(item.name)}</strong><span>$${escapeHtml(String(item.price))} · ${escapeHtml(formatEffect(item.effect))} · Owned ${escapeHtml(String(item.ownedQty))}</span></div>
      <button class="small-button" data-action="life-action" data-id="buy:${escapeHtml(item.id)}" ${item.canBuy ? "" : "disabled"}>Купить</button>
    </div>
  `;
}

function renderCafeOrder(order) {
  return `
    <div class="life-row">
      <div><strong>${escapeHtml(order.name)}</strong><span>$${escapeHtml(String(order.price))} · ${escapeHtml(formatEffect(order.effect))} · ${escapeHtml(String(order.actionCost))} action</span></div>
      <button class="small-button" data-action="life-action" data-id="cafe:${escapeHtml(order.id)}" ${order.canUse ? "" : "disabled"}>Заказать</button>
    </div>
  `;
}

function renderJob(job) {
  return `
    <div class="life-row">
      <div><strong>${escapeHtml(job.name)}</strong><span>+$${escapeHtml(String(job.pay))} · ${escapeHtml(formatEffect(job.effect))} · ${escapeHtml(String(job.actionCost))} action</span></div>
      <button class="small-button" data-action="life-action" data-id="job:${escapeHtml(job.id)}" ${job.canWork ? "" : "disabled"}>Выйти</button>
    </div>
  `;
}

function renderHousing(housing) {
  const buyText = housing.purchasePrice ? `$${housing.purchasePrice}` : "locked";
  return `
    <div class="life-row ${housing.current ? "current" : ""}">
      <div><strong>${escapeHtml(housing.name)}</strong><span>Rent $${escapeHtml(String(housing.rent))} / 7 days · Rest ${escapeHtml(formatEffect(housing.restEffect))} · Buy ${escapeHtml(String(buyText))}</span></div>
      <div class="life-row-actions">
        <button class="small-button" data-action="life-action" data-id="rentHousing:${escapeHtml(housing.id)}" ${housing.canRent ? "" : "disabled"}>Арендовать</button>
        <button class="small-button" data-action="life-action" data-id="buyHousing:${escapeHtml(housing.id)}" ${housing.canBuy ? "" : "disabled"}>Купить</button>
      </div>
    </div>
  `;
}

function renderAsset(asset) {
  return `
    <div class="life-row ${asset.owned ? "current" : ""}">
      <div><strong>${escapeHtml(asset.name)}</strong><span>$${escapeHtml(String(asset.price))} · Status +${escapeHtml(String(asset.effect?.status ?? 0))}</span></div>
      <button class="small-button" data-action="life-action" data-id="buyAsset:${escapeHtml(asset.id)}" ${asset.canBuy ? "" : "disabled"}>Купить</button>
    </div>
  `;
}

function renderVehicle(vehicle) {
  return `
    <div class="life-row ${vehicle.owned ? "current" : ""}">
      <div><strong>${escapeHtml(vehicle.name)}</strong><span>$${escapeHtml(String(vehicle.price))} · ${escapeHtml(formatEffect(vehicle.effect))}</span></div>
      <button class="small-button" data-action="life-action" data-id="buyVehicle:${escapeHtml(vehicle.id)}" ${vehicle.canBuy ? "" : "disabled"}>Купить</button>
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
