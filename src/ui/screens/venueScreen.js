import { getVenueView } from "../../engine/venues.js?v=2.3.0";
import { escapeHtml } from "../components.js?v=2.3.0";

export function renderVenueScreen(state) {
  const venueId = state.activeVenueId ?? state.career?.city?.activeVenueId;
  const view = getVenueView({ content: state.content, career: state.career, player: state.player, venueId, activeClubId: state.activeClubId });
  const venue = view.venue;
  if (!venue) return renderMissingVenue();

  return `
    <section class="venue-screen">
      <article class="venue-hero panel-soft venue-type-${escapeHtml(venue.type)}">
        <div>
          <span>${escapeHtml(typeLabel(venue.type))}</span>
          <h2>${escapeHtml(venue.name)}</h2>
          <p>${escapeHtml(view.country?.name ?? "Country")} · ${escapeHtml(view.city?.name ?? "City")} · ${escapeHtml(venue.id)}</p>
        </div>
        <div class="venue-actions-top">
          <button data-action="screen" data-id="locations">Карта</button>
          <button data-action="screen" data-id="life">Жизнь</button>
        </div>
      </article>

      ${renderVenueBody(view, state)}
    </section>
  `;
}

function renderMissingVenue() {
  return `
    <section class="venue-screen">
      <article class="panel-soft venue-empty">
        <strong>Объект не найден.</strong>
        <button data-action="screen" data-id="locations">Карта</button>
      </article>
    </section>
  `;
}

function renderVenueBody(view, state) {
  const venue = view.venue;
  if (venue.type === "poker_club") return renderPokerClubVenue(view);
  if (venue.type === "store") return renderRows("Товары", view.rows.map(renderStoreRow));
  if (venue.type === "cafe") return renderRows("Меню", view.rows.map(renderCafeRow));
  if (venue.type === "job_site") return renderRows("Смены", view.rows.map(renderJobRow));
  if (venue.type === "real_estate_agency") return renderRows("Жильё", view.rows.map(renderHousingRow));
  if (venue.type === "car_dealer") return renderRows("Машины", view.rows.map(renderVehicleRow));
  if (venue.type === "asset_store") return renderRows("Имущество", view.rows.map(renderAssetRow));
  if (venue.type === "home") return renderRows("Дом", view.rows.map(renderHomeRow));
  return renderRows("Действия", [`<div class="life-empty">Действий нет.</div>`]);
}

function renderPokerClubVenue(view) {
  const club = view.club;
  const locked = !view.status.access.ok;
  return `
    <article class="venue-section panel-soft">
      <header><span>Poker club</span><strong>${escapeHtml(club?.name ?? "Клуб")}</strong></header>
      <div class="venue-club-summary">
        <div><span>Tables</span><strong>${escapeHtml(String(view.tables.length))}</strong></div>
        <div><span>Status</span><strong>${escapeHtml(view.status.statusLabel)}</strong></div>
        <div><span>Tier</span><strong>${escapeHtml(club?.tier ?? "—")}</strong></div>
      </div>
      ${locked ? `<p class="venue-warning">${escapeHtml(view.status.access.reason)}</p>` : ""}
      <button class="primary" data-action="select-club" data-id="${escapeHtml(club?.id ?? "")}" ${locked ? "disabled" : ""}>Войти в клуб</button>
    </article>
  `;
}

function renderRows(title, rows) {
  return `
    <article class="venue-section panel-soft">
      <header><span>Venue actions</span><strong>${escapeHtml(title)}</strong></header>
      <div class="life-list">
        ${rows.length ? rows.join("") : `<div class="life-empty">Пусто</div>`}
      </div>
    </article>
  `;
}

function renderStoreRow(row) {
  return `
    <div class="life-row">
      <div><strong>${escapeHtml(row.item.name)}</strong><span>$${escapeHtml(String(row.item.price))} · ${escapeHtml(formatEffect(row.item.effect))} · Owned ${escapeHtml(String(row.ownedQty))}</span></div>
      <button class="small-button" data-action="venue-action" data-id="${escapeHtml(row.actionId)}" ${row.canUse ? "" : "disabled"}>Купить</button>
    </div>
  `;
}

function renderCafeRow(row) {
  return `
    <div class="life-row">
      <div><strong>${escapeHtml(row.order.name)}</strong><span>$${escapeHtml(String(row.order.price))} · ${escapeHtml(formatEffect(row.order.effect))} · ${escapeHtml(String(row.order.actionCost))} action</span></div>
      <button class="small-button" data-action="venue-action" data-id="${escapeHtml(row.actionId)}" ${row.canUse ? "" : "disabled"}>Заказать</button>
    </div>
  `;
}

function renderJobRow(row) {
  return `
    <div class="life-row">
      <div><strong>${escapeHtml(row.job.name)}</strong><span>+$${escapeHtml(String(row.job.pay))} · ${escapeHtml(formatEffect(row.job.effect))} · ${escapeHtml(String(row.job.actionCost))} action</span></div>
      <button class="small-button" data-action="venue-action" data-id="${escapeHtml(row.actionId)}" ${row.canUse ? "" : "disabled"}>Выйти</button>
    </div>
  `;
}

function renderHousingRow(row) {
  const housing = row.housing;
  const buyText = housing.purchasePrice ? `$${housing.purchasePrice}` : "locked";
  return `
    <div class="life-row ${row.view?.current ? "current" : ""}">
      <div><strong>${escapeHtml(housing.name)}</strong><span>Rent $${escapeHtml(String(housing.rent))} / 7 days · Rest ${escapeHtml(formatEffect(housing.restEffect))} · Buy ${escapeHtml(String(buyText))}</span></div>
      <div class="life-row-actions">
        <button class="small-button" data-action="venue-action" data-id="rentHousing:${escapeHtml(housing.id)}" ${row.canRent ? "" : "disabled"}>Арендовать</button>
        <button class="small-button" data-action="venue-action" data-id="buyHousing:${escapeHtml(housing.id)}" ${row.canBuy ? "" : "disabled"}>Купить</button>
      </div>
    </div>
  `;
}

function renderVehicleRow(row) {
  return `
    <div class="life-row ${row.owned ? "current" : ""}">
      <div><strong>${escapeHtml(row.vehicle.name)}</strong><span>$${escapeHtml(String(row.vehicle.price))} · ${escapeHtml(formatEffect(row.vehicle.effect))}</span></div>
      <button class="small-button" data-action="venue-action" data-id="${escapeHtml(row.actionId)}" ${row.canUse ? "" : "disabled"}>Купить</button>
    </div>
  `;
}

function renderAssetRow(row) {
  return `
    <div class="life-row ${row.owned ? "current" : ""}">
      <div><strong>${escapeHtml(row.asset.name)}</strong><span>$${escapeHtml(String(row.asset.price))} · Status +${escapeHtml(String(row.asset.effect?.status ?? 0))}</span></div>
      <button class="small-button" data-action="venue-action" data-id="${escapeHtml(row.actionId)}" ${row.canUse ? "" : "disabled"}>Купить</button>
    </div>
  `;
}

function renderHomeRow(row) {
  if (row.kind === "home_rest") {
    return `
      <div class="life-row">
        <div><strong>Отдых</strong><span>${escapeHtml(formatEffect(row.housing.restEffect))}</span></div>
        <button class="small-button" data-action="venue-action" data-id="${escapeHtml(row.actionId)}" ${row.canUse ? "" : "disabled"}>Отдохнуть</button>
      </div>
    `;
  }
  return `
    <div class="life-row">
      <div><strong>${escapeHtml(row.entry.item.name)} x${escapeHtml(String(row.entry.qty))}</strong><span>${escapeHtml(formatEffect(row.entry.item.effect))}</span></div>
      <button class="small-button" data-action="venue-action" data-id="${escapeHtml(row.actionId)}">Использовать</button>
    </div>
  `;
}

function typeLabel(type) {
  const labels = {
    home: "Home",
    store: "Store",
    cafe: "Cafe",
    job_site: "Work",
    real_estate_agency: "Real estate",
    car_dealer: "Car dealer",
    asset_store: "Asset store",
    poker_club: "Poker club",
  };
  return labels[type] ?? "Venue";
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
