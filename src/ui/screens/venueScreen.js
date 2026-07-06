import { getVenueView } from "../../engine/venues.js?v=2.9.0";
import { escapeHtml } from "../components.js?v=2.9.0";

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
          <p>${escapeHtml(formatVenueLocation(view))}</p>
        </div>
        <div class="venue-actions-top">
          <button data-action="go-city">Назад в город</button>
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
        <button data-action="go-city">Назад в город</button>
      </article>
    </section>
  `;
}

function renderVenueBody(view, state) {
  const venue = view.venue;
  const lockedAtTable = isSeatedAtTable(state);
  if (venue.type === "poker_club") return renderPokerClubVenue(view, lockedAtTable);
  const warning = lockedAtTable ? renderLocationLockNotice() : "";
  if (venue.type === "store") return warning + renderRows("Товары", view.rows.map((row) => renderStoreRow(row, lockedAtTable)));
  if (["cafe", "restaurant"].includes(venue.type)) return warning + renderRows("Меню", view.rows.map((row) => renderCafeRow(row, lockedAtTable)));
  if (venue.type === "job_site") return warning + renderRows("Смены", view.rows.map((row) => renderJobRow(row, lockedAtTable)));
  if (venue.type === "real_estate_agency") return warning + renderRows("Жильё", view.rows.map((row) => renderHousingRow(row, lockedAtTable)));
  if (venue.type === "car_dealer") return warning + renderRows("Машины", view.rows.map((row) => renderVehicleRow(row, lockedAtTable)));
  if (venue.type === "asset_store") return warning + renderRows("Имущество", view.rows.map((row) => renderAssetRow(row, lockedAtTable)));
  if (venue.type === "business_broker") return warning + renderRows("Бизнесы", view.rows.map((row) => renderBusinessRow(row, lockedAtTable)));
  if (venue.type === "home") return warning + renderRows("Дом", view.rows.map((row) => renderHomeRow(row, lockedAtTable)));
  return renderRows("Действия", [`<div class="life-empty">Действий нет.</div>`]);
}

function renderPokerClubVenue(view, lockedAtTable = false) {
  const club = view.club;
  const locked = !view.status.access.ok || lockedAtTable;
  return `
    <article class="venue-section panel-soft">
      <header><span>Poker club</span><strong>${escapeHtml(club?.name ?? "Клуб")}</strong></header>
      <div class="venue-club-summary">
        <div><span>Tables</span><strong>${escapeHtml(String(view.tables.length))}</strong></div>
        <div><span>Status</span><strong>${escapeHtml(view.status.statusLabel)}</strong></div>
        <div><span>Tier</span><strong>${escapeHtml(club?.tier ?? "—")}</strong></div>
      </div>
      ${locked ? `<p class="venue-warning">${escapeHtml(lockedAtTable ? "Сначала встань из-за стола." : view.status.access.reason)}</p>` : ""}
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

function renderStoreRow(row, lockedAtTable = false) {
  return `
    <div class="life-row">
      <div><strong>${escapeHtml(row.item.name)}</strong><span>$${escapeHtml(String(row.item.price))} · ${escapeHtml(formatEffect(row.item.effect))} · Owned ${escapeHtml(String(row.ownedQty))}</span></div>
      <button class="small-button" data-action="venue-action" data-id="${escapeHtml(row.actionId)}" ${row.canUse && !lockedAtTable ? "" : "disabled"}>Купить</button>
    </div>
  `;
}

function renderCafeRow(row, lockedAtTable = false) {
  return `
    <div class="life-row">
      <div><strong>${escapeHtml(row.order.name)}</strong><span>$${escapeHtml(String(row.order.price))} · ${escapeHtml(formatEffect(row.order.effect))} · ${escapeHtml(String(row.order.actionCost))} action</span></div>
      <button class="small-button" data-action="venue-action" data-id="${escapeHtml(row.actionId)}" ${row.canUse && !lockedAtTable ? "" : "disabled"}>Заказать · ${escapeHtml(actionCostLabel(row.order.actionCost))}</button>
    </div>
  `;
}

function renderJobRow(row, lockedAtTable = false) {
  const job = row.job;
  const stage = row.stage ?? { title: job.title, wage: job.baseWage };
  const next = row.nextStage ? ` → ${row.nextStage.title} @ ${row.nextStage.minXp} XP` : "max";
  const status = row.current ? "Текущая работа" : row.employedElsewhere ? "Уже есть работа" : row.blockedReason ?? "Вакансия";
  return `
    <div class="life-row job-row ${row.current ? "current" : ""}">
      <div class="business-copy">
        <div class="housing-title-line">
          <strong>${escapeHtml(stage.title)}</strong>
          <em>${escapeHtml(status)}</em>
        </div>
        <span>${escapeHtml(job.companyName)} · ${escapeHtml(job.category)} · Rep ${escapeHtml(String(job.minReputation ?? 0))}+</span>
        <div class="housing-specs">
          <small>$${escapeHtml(String(stage.wage))}/смена</small>
          <small>${escapeHtml(actionCostLabel(job.actionCost))}</small>
          <small>Energy ${escapeHtml(String(job.minEnergy ?? 0))}+</small>
          <small>XP ${escapeHtml(String(row.xp ?? 0))}${escapeHtml(next)}</small>
        </div>
        <p>${escapeHtml(formatEffect(job.effect))}</p>
      </div>
      <div class="life-row-actions">
        <button class="small-button" data-action="venue-action" data-id="takeJob:${escapeHtml(job.id)}" ${row.canTake && !lockedAtTable ? "" : "disabled"}>Устроиться · 1 action</button>
        <button class="small-button primary" data-action="venue-action" data-id="workJob:${escapeHtml(job.id)}" ${row.canWork && !lockedAtTable ? "" : "disabled"}>Смена · ${escapeHtml(actionCostLabel(job.actionCost))}</button>
        <button class="small-button" data-action="venue-action" data-id="quitJob:${escapeHtml(job.id)}" ${row.canQuit && !lockedAtTable ? "" : "disabled"}>Уволиться</button>
      </div>
    </div>
  `;
}

function renderHousingRow(row, lockedAtTable = false) {
  const housing = row.housing;
  const buyText = housing.purchasePrice ? `$${housing.purchasePrice}` : "нельзя купить";
  const status = row.view?.current ? "Текущее" : row.view?.owned ? "Куплено" : "Доступно";
  return `
    <div class="life-row housing-row ${row.view?.current ? "current" : ""}">
      <div class="housing-copy">
        <div class="housing-title-line">
          <strong>${escapeHtml(housing.name)}</strong>
          <em>${escapeHtml(status)}</em>
        </div>
        <span>${escapeHtml(housing.district)} · ${escapeHtml(housing.address)}</span>
        <div class="housing-specs">
          <small>${escapeHtml(String(housing.rooms))}к</small>
          <small>${escapeHtml(String(housing.sqm))} м²</small>
          <small>до ${escapeHtml(String(housing.capacity))} чел.</small>
          <small>${escapeHtml(housing.repair)}</small>
        </div>
        <p>Аренда $${escapeHtml(String(housing.rent))} / 7 дней · Отдых ${escapeHtml(formatEffect(housing.restEffect))} · Купить ${escapeHtml(String(buyText))}</p>
      </div>
      <div class="life-row-actions">
        <button class="small-button" data-action="venue-action" data-id="rentHousing:${escapeHtml(housing.id)}" ${row.canRent && !lockedAtTable ? "" : "disabled"}>Снять · 1 action</button>
        <button class="small-button" data-action="venue-action" data-id="moveHousing:${escapeHtml(housing.id)}" ${row.canMove && !lockedAtTable ? "" : "disabled"}>Переехать · 1 action</button>
        <button class="small-button" data-action="venue-action" data-id="buyHousing:${escapeHtml(housing.id)}" ${row.canBuy && !lockedAtTable ? "" : "disabled"}>Купить · 1 action</button>
      </div>
    </div>
  `;
}

function renderVehicleRow(row, lockedAtTable = false) {
  const vehicle = row.vehicle;
  const meta = [
    vehicle.class,
    `upkeep $${vehicle.upkeepPer7Days ?? 0}/7д`,
    `status ${vehicle.status ?? 0}`,
    `${vehicle.seats ?? 5} seats`,
  ].filter(Boolean).join(" · ");
  return `
    <div class="life-row vehicle-row ${row.owned ? "current" : ""}">
      <div>
        <strong>${escapeHtml(vehicle.name)}</strong>
        <span>$${escapeHtml(String(vehicle.price))} · ${escapeHtml(meta)} · ${escapeHtml(formatEffect(vehicle.effect))}</span>
      </div>
      <button class="small-button" data-action="venue-action" data-id="${escapeHtml(row.actionId)}" ${row.canUse && !lockedAtTable ? "" : "disabled"}>Купить · 1 action</button>
    </div>
  `;
}

function renderAssetRow(row, lockedAtTable = false) {
  return `
    <div class="life-row ${row.owned ? "current" : ""}">
      <div><strong>${escapeHtml(row.asset.name)}</strong><span>$${escapeHtml(String(row.asset.price))} · Status +${escapeHtml(String(row.asset.effect?.status ?? 0))}</span></div>
      <button class="small-button" data-action="venue-action" data-id="${escapeHtml(row.actionId)}" ${row.canUse && !lockedAtTable ? "" : "disabled"}>Купить · 1 action</button>
    </div>
  `;
}

function renderBusinessRow(row, lockedAtTable = false) {
  const business = row.template;
  const owned = Boolean(row.owned);
  const status = owned ? `Lv.${row.owned.level} · Condition ${row.owned.condition}` : "Доступно";
  return `
    <div class="life-row business-row ${owned ? "current" : ""}">
      <div class="business-copy">
        <div class="housing-title-line">
          <strong>${escapeHtml(business.name)}</strong>
          <em>${escapeHtml(status)}</em>
        </div>
        <span>${escapeHtml(business.brand)} · ${escapeHtml(business.district)} · ${escapeHtml(business.address)}</span>
        <div class="housing-specs">
          <small>${escapeHtml(business.type)}</small>
          <small>${escapeHtml(business.scale)}</small>
          <small>staff ${escapeHtml(String(business.staffSlots))}</small>
          <small>risk ${escapeHtml(String(business.risk))}</small>
        </div>
        <p>Цена $${escapeHtml(String(business.buyPrice))} · Revenue $${escapeHtml(String(business.dailyRevenue))} · Expenses $${escapeHtml(String(business.dailyExpenses))} · Profit $${escapeHtml(String(row.dailyProfit))}/день</p>
        ${owned ? `<p>К сбору: $${escapeHtml(String(row.collectableProfit))} · дней ${escapeHtml(String(row.collectableDays))} · всего +$${escapeHtml(String(row.owned.totalProfit ?? 0))}</p>` : ""}
      </div>
      <div class="life-row-actions">
        <button class="small-button" data-action="venue-action" data-id="buyBusiness:${escapeHtml(business.id)}" ${row.canBuy && !lockedAtTable ? "" : "disabled"}>Купить · 1 action</button>
        <button class="small-button" data-action="venue-action" data-id="collectBusiness:${escapeHtml(business.id)}" ${row.canCollect && !lockedAtTable ? "" : "disabled"}>Собрать</button>
        <button class="small-button" data-action="venue-action" data-id="upgradeBusiness:${escapeHtml(business.id)}" ${row.canUpgrade && !lockedAtTable ? "" : "disabled"}>Апгрейд $${escapeHtml(String(row.upgradeCost ?? 0))} · 1 action</button>
      </div>
    </div>
  `;
}

function renderHomeRow(row, lockedAtTable = false) {
  if (row.kind === "home_rest") {
    return `
      <div class="life-row housing-row home-current-row">
        <div class="housing-copy">
          <div class="housing-title-line">
            <strong>Отдых</strong>
            <em>${escapeHtml(row.housing.name)}</em>
          </div>
          <span>${escapeHtml(row.housing.district ?? "")} · ${escapeHtml(row.housing.address ?? "")}</span>
          <div class="housing-specs">
            <small>${escapeHtml(String(row.housing.rooms ?? 1))}к</small>
            <small>${escapeHtml(String(row.housing.sqm ?? "—"))} м²</small>
            <small>до ${escapeHtml(String(row.housing.capacity ?? 1))} чел.</small>
            <small>${escapeHtml(row.housing.repair ?? "ремонт")}</small>
          </div>
          <p>${escapeHtml(formatEffect(row.housing.restEffect))} · 1 action · отмечает сон</p>
        </div>
        <button class="small-button" data-action="venue-action" data-id="${escapeHtml(row.actionId)}" ${row.canUse && !lockedAtTable ? "" : "disabled"}>Сон / отдых</button>
      </div>
    `;
  }
  return `
    <div class="life-row">
      <div><strong>${escapeHtml(row.entry.item.name)} x${escapeHtml(String(row.entry.qty))}</strong><span>${escapeHtml(formatEffect(row.entry.item.effect))}</span></div>
      <button class="small-button" data-action="venue-action" data-id="${escapeHtml(row.actionId)}" ${lockedAtTable ? "disabled" : ""}>Использовать</button>
    </div>
  `;
}

function actionCostLabel(cost) {
  const clean = Number(cost) || 0;
  if (clean <= 0) return "0 action";
  return `${clean} action`;
}

function formatVenueLocation(view) {
  const parts = [
    view.country?.name ?? null,
    view.city?.name ?? null,
    view.venue?.district ?? null,
    view.venue?.address ?? null,
  ].filter(Boolean);
  return parts.join(" · ") || "Город";
}

function isSeatedAtTable(state = {}) {
  return Boolean(state.tableSession?.tableId);
}

function renderLocationLockNotice() {
  return `
    <article class="venue-section panel-soft venue-warning-panel">
      <strong>Ты сейчас за столом.</strong>
      <p>Сначала встань из-за стола.</p>
    </article>
  `;
}

function typeLabel(type) {
  const labels = {
    home: "Home",
    store: "Store",
    cafe: "Cafe",
    restaurant: "Restaurant",
    job_site: "Work",
    real_estate_agency: "Real estate",
    car_dealer: "Car dealer",
    asset_store: "Asset store",
    business_broker: "Business broker",
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
