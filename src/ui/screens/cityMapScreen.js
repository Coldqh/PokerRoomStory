import { getCityMapView } from "../../engine/locations.js?v=3.3.0";
import { getGlobalPokerAtlasView } from "../../engine/globalPokerAtlas.js?v=3.3.0";
import { escapeHtml } from "../components.js?v=3.3.0";

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
  const activeClub = state.content?.byId?.clubs?.[state.activeClubId] ?? null;
  const activeVenueId = state.activeVenueId ?? state.career?.city?.activeVenueId ?? null;
  const view = getCityMapView(state.content, state.career, state.player, activeClub?.cityId, state.activeClubId, activeVenueId);
  const cityName = view.city?.name ?? "Город";
  const countryName = view.country?.name ?? "Россия";
  const atlas = getGlobalPokerAtlasView(state.content, state.career, state.player);

  return `
    <section class="city-map-screen">
      <article class="panel-soft city-map-hero">
        <div>
          <span>Местонахождение</span>
          <h2>Город</h2>
          <p>${escapeHtml(countryName)} · ${escapeHtml(cityName)}. Ты в городе. Выбери, куда идти дальше: дом, клуб, магазин, кафе, работа, жильё или машины.</p>
          ${state.tableSession?.tableId ? `<p class="venue-warning">Ты сейчас за столом. Сначала встань из-за стола.</p>` : ""}
        </div>
        <div class="city-map-summary">
          <div><span>Объекты</span><strong>${escapeHtml(String(view.summary.total))}</strong></div>
          <div><span>Открыто</span><strong>${escapeHtml(String(view.summary.unlocked))}</strong></div>
          <div><span>Клубы</span><strong>${escapeHtml(String(view.summary.clubs))}</strong></div>
          <div><span>Мир</span><strong>${escapeHtml(String(atlas.summary.countries))}/${escapeHtml(String(atlas.summary.cities))}</strong></div>
          <div><span>План клубов</span><strong>${escapeHtml(String(atlas.summary.plannedClubs))}</strong></div>
        </div>
      </article>

      <section class="city-venue-map" aria-label="Объекты города">
        ${VENUE_GROUPS.map((group) => renderVenueGroup(group, view.venues, Boolean(state.tableSession?.tableId))).join("")}
      </section>

      ${renderGlobalAtlas(atlas)}
    </section>
  `;
}

function renderGlobalAtlas(atlas) {
  return `
    <section class="global-atlas panel-soft">
      <header class="global-atlas-head">
        <div>
          <span>World route foundation</span>
          <strong>Глобальный покерный атлас</strong>
          <p>Долгий маршрут: Москва → Россия → Азия → США → Европа → Macau endgame. Большинство городов пока закрыты и работают как roadmap будущих клубов.</p>
        </div>
        <div class="global-atlas-summary">
          <span>${escapeHtml(String(atlas.summary.countries))} стран / зон</span>
          <span>${escapeHtml(String(atlas.summary.cities))} город</span>
          <span>${escapeHtml(String(atlas.summary.plannedClubs))} клубов в плане</span>
        </div>
      </header>
      <div class="global-country-grid">
        ${atlas.countries.map(renderCountryAtlasCard).join("")}
      </div>
    </section>
  `;
}

function renderCountryAtlasCard(row) {
  return `
    <article class="global-country-card status-${escapeHtml(row.status)}">
      <div class="global-country-title">
        <div>
          <span>${escapeHtml(row.country.region ?? "World")}</span>
          <strong>${escapeHtml(row.country.name)}</strong>
        </div>
        <em>${escapeHtml(row.statusLabel)}</em>
      </div>
      <div class="global-country-meta">
        <span>${escapeHtml(String(row.cityCount))} город</span>
        <span>${escapeHtml(String(row.plannedClubCount))} клубов</span>
        <span>${escapeHtml(routeRoleLabel(row.country.routeRole))}</span>
      </div>
      ${row.reason ? `<p class="global-atlas-lock">${escapeHtml(row.reason)}</p>` : ""}
      <div class="global-city-list">
        ${row.cities.map(renderCityAtlasRow).join("")}
      </div>
    </article>
  `;
}

function renderCityAtlasRow(row) {
  const city = row.city;
  const clubNames = [...row.anchorClubNames, ...row.futureClubNames].slice(0, 4);
  return `
    <div class="global-city-row status-${escapeHtml(row.status)}">
      <div class="global-city-main">
        <strong>${escapeHtml(city.name)}</strong>
        <span>${escapeHtml(city.averageLimit ?? "future route")} · ${escapeHtml(String(row.plannedClubCount))} клубов</span>
      </div>
      <em>${escapeHtml(row.statusLabel)}</em>
      ${row.reason ? `<small>${escapeHtml(row.reason)}</small>` : ""}
      ${clubNames.length ? `<div class="global-city-clubs">${clubNames.map((name) => `<span>${escapeHtml(name)}</span>`).join("")}</div>` : ""}
    </div>
  `;
}

function routeRoleLabel(role) {
  const labels = {
    starter_campaign: "старт",
    high_stakes_campaign: "high stakes",
    asian_endgame: "Asia endgame",
    technical_campaign: "техника",
    connector_campaign: "connector",
    europe_private_campaign: "private",
    europe_style_campaign: "style",
    europe_luxury_endgame: "luxury",
    europe_grinder_campaign: "grind",
    tourist_campaign: "tourist",
  };
  return labels[role] ?? role ?? "route";
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
  if (venue.type === "home") return ["отдых", "инвентарь"];
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
