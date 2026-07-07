import { getCityMapView } from "../../engine/locations.js?v=3.4.0";
import { getTravelView } from "../../engine/travel.js?v=3.4.0";
import { escapeHtml } from "../components.js?v=3.4.0";

const VENUE_GROUPS = [
  { id: "home", title: "Home" },
  { id: "poker", title: "Poker Clubs" },
  { id: "groceries", title: "Groceries" },
  { id: "cafes", title: "Cafes" },
  { id: "restaurants", title: "Restaurants" },
  { id: "work", title: "Work" },
  { id: "property", title: "Property" },
  { id: "business", title: "Business" },
  { id: "transport", title: "Transport" },
];

export function renderCityMapScreen(state) {
  const cityId = state.playerLocation?.cityId ?? state.career?.travel?.currentCityId ?? state.content?.byId?.clubs?.[state.activeClubId]?.cityId ?? "CITY_RU_NORTH_DISTRICT";
  const activeVenueId = state.activeVenueId ?? state.career?.city?.activeVenueId ?? null;
  const view = getCityMapView(state.content, state.career, state.player, cityId, state.activeClubId, activeVenueId);
  const travel = getTravelView(state.content, state.career, state.player, cityId);
  const cityName = view.city?.name ?? "Город";
  const countryName = view.country?.name ?? "Россия";

  return `
    <section class="city-map-screen">
      <article class="panel-soft city-map-hero">
        <div>
          <span>Местонахождение</span>
          <h2>${escapeHtml(cityName)}</h2>
          <p>${escapeHtml(countryName)} · ${escapeHtml(cityName)}. Ты в городе. Выбери, куда идти дальше: дом, клуб, магазин, кафе, работа, жильё, машины или аэропорт.</p>
          ${state.tableSession?.tableId ? `<p class="venue-warning">Ты сейчас за столом. Сначала встань из-за стола.</p>` : ""}
        </div>
        <div class="city-map-summary">
          <div><span>Объекты</span><strong>${escapeHtml(String(view.summary.total))}</strong></div>
          <div><span>Открыто</span><strong>${escapeHtml(String(view.summary.unlocked))}</strong></div>
          <div><span>Клубы</span><strong>${escapeHtml(String(view.summary.clubs))}</strong></div>
          <div><span>Действия</span><strong>${escapeHtml(formatActions(state.career?.life))}</strong></div>
        </div>
      </article>

      ${renderTravelPanel(travel, Boolean(state.tableSession?.tableId))}

      <section class="city-venue-map" aria-label="Объекты города">
        ${VENUE_GROUPS.map((group) => renderVenueGroup(group, view.venues, Boolean(state.tableSession?.tableId))).join("")}
      </section>
    </section>
  `;
}

function renderTravelPanel(travel, lockedAtTable = false) {
  return `
    <section class="travel-panel panel-soft">
      <header class="travel-head">
        <div>
          <span>Airport</span>
          <strong>Перелёт в другую страну</strong>
          <p>Билет тратит деньги и дневные действия. После перелёта город реально меняется: магазины, кафе, бизнесы, машины и клубы будут местными.</p>
        </div>
      </header>
      <div class="travel-route-grid">
        ${travel.routes.map((route) => renderTravelRoute(route, lockedAtTable)).join("")}
      </div>
    </section>
  `;
}

function renderTravelRoute(route, lockedAtTable = false) {
  const city = route.city;
  const country = route.country;
  const locked = lockedAtTable || !route.access.ok;
  return `
    <article class="travel-route-card ${locked ? "is-locked" : ""}">
      <div class="travel-route-title">
        <div>
          <span>${escapeHtml(country?.name ?? "World")}</span>
          <strong>${escapeHtml(city?.name ?? route.toCityId)}</strong>
        </div>
        <em>$${escapeHtml(String(route.price))}</em>
      </div>
      <div class="travel-route-meta">
        <span>${escapeHtml(String(route.actionCost))} actions</span>
        <span>${escapeHtml(city?.averageLimit ?? "international")}</span>
      </div>
      ${lockedAtTable ? `<p class="travel-lock">Сначала встань из-за стола.</p>` : route.access.reason ? `<p class="travel-lock">${escapeHtml(route.access.reason)}</p>` : ""}
      <button class="primary" data-action="travel-route" data-id="${escapeHtml(route.id)}" ${locked ? "disabled" : ""}>Перелететь</button>
    </article>
  `;
}

function renderVenueGroup(group, venues, lockedAtTable = false) {
  const entries = venues.filter((entry) => (entry.venue?.category ?? "") === group.id);
  if (!entries.length) return "";
  return `
    <section class="city-venue-group">
      <header><span>City layer</span><strong>${escapeHtml(group.title)}</strong></header>
      <div class="city-venue-grid">
        ${entries.map((entry) => renderVenueCard(entry, lockedAtTable)).join("")}
      </div>
    </section>
  `;
}

function renderVenueCard(entry, lockedAtTable = false) {
  const venue = entry.venue;
  const locked = !entry.access.ok;
  const meta = getVenueMeta(entry);
  return `
    <article class="city-venue-card venue-${escapeHtml(venue.type)} ${entry.current ? "is-current" : ""} ${locked ? "is-locked" : ""}">
      <div class="city-venue-head">
        <div>
          <span>${escapeHtml(typeLabel(venue.type))}</span>
          <strong>${escapeHtml(venue.name)}</strong>
        </div>
        <em>${escapeHtml(entry.statusLabel)}</em>
      </div>
      <div class="city-venue-meta">
        ${meta.map((line) => `<span>${escapeHtml(line)}</span>`).join("")}
        ${locked ? `<span>${escapeHtml(entry.access.reason)}</span>` : ""}
      </div>
      <button class="${entry.current ? "small-button" : "primary"}" data-action="select-venue" data-id="${escapeHtml(venue.id)}" ${locked || lockedAtTable ? "disabled" : ""}>${escapeHtml(lockedAtTable ? "За столом" : entry.actionLabel)}</button>
    </article>
  `;
}

function getVenueMeta(entry) {
  const venue = entry.venue;
  if (venue.type === "poker_club") {
    const club = entry.linkedClub;
    return [club?.tier ?? "Club", club?.name ?? venue.name];
  }
  if (venue.type === "store") return [`${venue.inventoryIds?.length ?? 0} товаров`];
  if (["cafe", "restaurant"].includes(venue.type)) return [`${venue.orderIds?.length ?? 0} позиций`];
  if (venue.type === "job_site") return [`${venue.jobIds?.length ?? 0} смены`];
  if (venue.type === "real_estate_agency") return [`${venue.housingIds?.length ?? 0} варианта`];
  if (venue.type === "car_dealer") return [`${venue.vehicleIds?.length ?? 0} машин`];
  if (venue.type === "asset_store") return [`${venue.assetIds?.length ?? 0} вещи`];
  if (venue.type === "business_broker") return [`${venue.businessIds?.length ?? 0} бизнесов`];
  if (venue.type === "home") return [venue.district ?? "отдых", "инвентарь"];
  return [];
}

function typeLabel(type) {
  const labels = {
    home: "Home",
    poker_club: "Poker",
    store: "Store",
    cafe: "Cafe",
    restaurant: "Restaurant",
    job_site: "Work",
    real_estate_agency: "Housing",
    car_dealer: "Cars",
    asset_store: "Assets",
    business_broker: "Business",
  };
  return labels[type] ?? "Venue";
}

function formatActions(life = {}) {
  const used = Number(life?.actionsUsed ?? life?.actionsToday ?? 0) || 0;
  const total = Number(life?.actionsPerDay ?? 6) || 6;
  return `${Math.max(0, total - used).toFixed(1)}/${total}`;
}
