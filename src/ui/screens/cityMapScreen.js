import { getCityMapView } from "../../engine/locations.js?v=2.2.0";
import { escapeHtml, progressBar } from "../components.js?v=2.2.0";

export function renderCityMapScreen(state) {
  const activeClub = state.content?.byId?.clubs?.[state.activeClubId] ?? null;
  const view = getCityMapView(state.content, state.career, state.player, activeClub?.cityId, state.activeClubId);
  const cityName = view.city?.name ?? "Город";
  const countryName = view.country?.name ?? "Россия";

  return `
    <section class="city-map-screen">
      <article class="panel-soft city-map-hero">
        <div>
          <span>Location progression</span>
          <h2>Карта города</h2>
          <p>${escapeHtml(countryName)} · ${escapeHtml(cityName)}. Проходи клубы как локации: сцены, задания, доступ к следующей комнате.</p>
        </div>
        <div class="city-map-summary">
          <div><span>Клубы</span><strong>${escapeHtml(String(view.summary.total))}</strong></div>
          <div><span>Открыто</span><strong>${escapeHtml(String(view.summary.unlocked))}</strong></div>
          <div><span>Пройдено</span><strong>${escapeHtml(String(view.summary.completed))}</strong></div>
        </div>
      </article>

      <section class="city-map-path" aria-label="Клубы города">
        ${view.clubs.length ? view.clubs.map(renderClubLocationCard).join("") : renderEmptyCity()}
      </section>
    </section>
  `;
}

function renderClubLocationCard(entry, index) {
  const club = entry.club;
  const route = entry.route;
  const mastery = entry.mastery;
  const tableCount = entry.tables.length;
  const locked = !entry.access.ok;
  const canEnter = entry.access.ok && !entry.current;
  const description = club?.description ?? getThemeLine(club);
  const routeTitle = route.story?.label ?? route.story?.title ?? "Club route";
  const routeLine = route.total ? `${route.current}/${route.total} scenes` : "No route";
  const masteryLine = mastery?.club ? `Room Mastery Lv.${mastery.level}` : "Room Mastery —";

  return `
    <article class="city-club-card status-${escapeHtml(entry.statusId)} ${entry.current ? "is-current" : ""} ${locked ? "is-locked" : ""}">
      <div class="city-club-node">${escapeHtml(String(index + 1).padStart(2, "0"))}</div>
      <div class="city-club-main">
        <div class="city-club-head">
          <div>
            <span>${escapeHtml(entry.statusLabel)}</span>
            <strong>${escapeHtml(club?.name ?? "Club")}</strong>
          </div>
          <em>${escapeHtml(club?.tier ?? "Club")}</em>
        </div>
        <p>${escapeHtml(description)}</p>
        <div class="city-club-route">
          <div>
            <span>${escapeHtml(routeTitle)}</span>
            <strong>${escapeHtml(routeLine)}</strong>
          </div>
          ${progressBar(route.percent ?? 0)}
        </div>
        <div class="city-club-meta">
          <span>${escapeHtml(String(tableCount))} tables</span>
          <span>${escapeHtml(masteryLine)}</span>
          ${locked ? `<span>${escapeHtml(entry.access.reason)}</span>` : ""}
        </div>
      </div>
      <div class="city-club-actions">
        <button class="${entry.current ? "small-button" : "primary"}" data-action="select-club" data-id="${escapeHtml(club?.id ?? "")}" ${canEnter ? "" : "disabled"}>
          ${escapeHtml(entry.actionLabel)}
        </button>
      </div>
    </article>
  `;
}

function renderEmptyCity() {
  return `<article class="panel-soft city-map-empty"><strong>Локаций нет.</strong><p>Клубы появятся после подключения content pack.</p></article>`;
}

function getThemeLine(club = {}) {
  const tags = club.styleTags ?? [];
  if (tags.includes("mid_stakes")) return "Закрытая комната с дорогими решениями и сильными регулярами.";
  if (tags.includes("starter")) return "Первый локальный клуб: дешёвые лимиты, знакомые лица, маршрут новичка.";
  return "Покерная локация города.";
}
