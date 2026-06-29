import { canEnterTable, getClubContext } from "../engine/world.js";
import { getPhaseLabel, getAvailableActions, getHandHint, getCurrentHandInfo } from "../engine/poker.js";
import { getXpProgress } from "../engine/career.js";
import { badges, emptyState, escapeHtml, metric, playingCards, progressBar } from "./components.js";

export const SCREENS = [
  { id: "club", label: "Лобби" },
  { id: "table", label: "Стол" },
  { id: "career", label: "Профиль" },
  { id: "npcs", label: "Пул игроков" },
  { id: "glossary", label: "Словарь" },
  { id: "collections", label: "Коллекции" },
];

export function renderScreen(state) {
  if (state.currentScreen === "club") return renderClubScreen(state);
  if (state.currentScreen === "table") return renderTableScreen(state);
  if (state.currentScreen === "career") return renderCareerScreen(state);
  if (state.currentScreen === "npcs") return renderNpcScreen(state);
  if (state.currentScreen === "glossary") return renderGlossaryScreen(state);
  if (state.currentScreen === "collections") return renderCollectionsScreen(state);
  return renderClubScreen(state);
}

function renderClubScreen(state) {
  const context = getClubContext(state.content, state.activeClubId);
  const { club, city, country, tables, npcs } = context;
  const activeTable = state.content.byId.tables[state.activeTableId];
  const unlockedCollections = state.career.unlockedCollections?.length ?? 0;
  const unlockedGlossary = state.career.unlockedGlossary?.length ?? 0;

  return `
    <section class="lobby-shell">
      <article class="room-hero surface surface-gold">
        <div class="hero-copy">
          <span class="eyebrow">${escapeHtml(country.name)} / ${escapeHtml(city.name)}</span>
          <h2>${escapeHtml(club.name)}</h2>
          <p>${escapeHtml(club.description)}</p>
          <div class="hero-actions">
            <button class="primary xl" data-action="screen" data-id="table">Открыть стол</button>
            <button class="ghost xl" data-action="start-hand">Быстрая раздача</button>
          </div>
        </div>
        <div class="room-card">
          <span>ACTIVE ROOM</span>
          <strong>${escapeHtml(activeTable?.name ?? "—")}</strong>
          <small>$${club.minBuyIn}–$${club.maxBuyIn} · ${escapeHtml(club.type)} · ${escapeHtml(club.tier)}</small>
        </div>
      </article>

      <aside class="lobby-side">
        <article class="surface profile-tile">
          <span class="eyebrow">Player status</span>
          <div class="metric-grid two-cols">
            ${metric("Bankroll", `$${state.player.bankroll}`)}
            ${metric("Reputation", state.player.reputation)}
            ${metric("Knowledge", `Lv.${state.player.knowledgeLevel}`)}
            ${metric("Poker", `Lv.${state.player.pokerLevel}`)}
          </div>
        </article>

        <article class="surface profile-tile">
          <span class="eyebrow">Room database</span>
          <div class="metric-grid two-cols">
            ${metric("Столов", tables.length)}
            ${metric("NPC", npcs.length)}
            ${metric("Терминов", unlockedGlossary)}
            ${metric("Коллекций", unlockedCollections)}
          </div>
        </article>
      </aside>
    </section>

    <section class="section-block">
      <div class="section-head">
        <div>
          <span class="eyebrow">Cash tables</span>
          <h3>Доступные столы</h3>
        </div>
        <span class="muted">Выбор стола меняет лимиты, состав NPC и темп игры.</span>
      </div>
      <div class="room-table-grid">
        ${tables.map((table) => renderTableListItem(state, table)).join("")}
      </div>
    </section>

    <section class="section-block split-section">
      <article class="surface">
        <div class="section-head compact-head">
          <div>
            <span class="eyebrow">Club feed</span>
            <h3>Журнал клуба</h3>
          </div>
        </div>
        <div class="log-feed">
          ${state.log.length ? state.log.slice(-8).reverse().map((line) => `<div class="feed-item">${escapeHtml(line)}</div>`).join("") : emptyState("Журнал пуст.")}
        </div>
      </article>

      <article class="surface accent-panel">
        <span class="eyebrow">Next expansion</span>
        <h3>Архитектура готова под мир</h3>
        <p>Страны, города, клубы, NPC, словарь и коллекции подключаются через content packs. MVP держится на одном живом клубе.</p>
        ${badges(["data-driven", "mobile-first", "GitHub Pages"], "gold")}
      </article>
    </section>
  `;
}

function renderTableListItem(state, table) {
  const access = canEnterTable(state.player, table);
  const active = state.activeTableId === table.id;
  return `
    <article class="room-table-card ${active ? "selected" : ""}">
      <div class="table-card-top">
        <span class="table-limit">$${table.smallBlind}/$${table.bigBlind}</span>
        <span class="table-status ${active ? "live" : ""}">${active ? "LIVE" : `D${table.difficulty}`}</span>
      </div>
      <h4>${escapeHtml(table.name)}</h4>
      <p>${escapeHtml(table.gameType)} · ${escapeHtml(table.limitType)} · ${table.seats} max</p>
      ${badges([table.tableMood, `Buy-in $${table.minBuyIn}–$${table.maxBuyIn}`], active ? "gold" : "")}
      <button class="${active ? "primary" : "ghost"}" data-action="select-table" data-id="${escapeHtml(table.id)}" ${access.ok ? "" : "disabled"}>
        ${active ? "За столом" : access.ok ? "Сесть" : access.reason}
      </button>
    </article>
  `;
}

function renderTableScreen(state) {
  const context = getClubContext(state.content, state.activeClubId);
  const table = state.content.byId.tables[state.activeTableId];
  const hand = state.tableState;
  const actions = getAvailableActions(hand);
  const handInfo = getCurrentHandInfo(hand);
  const highlightedIds = handInfo.highlightedIds ?? new Set();
  const seats = hand?.npcSeats ?? [];

  return `
    <section class="poker-world-layout">
      <article class="poker-table-card surface">
        <div class="table-toolbar">
          <div>
            <span class="eyebrow">${escapeHtml(context.club.name)}</span>
            <h2>${escapeHtml(table.name)}</h2>
          </div>
          <div class="toolbar-stats">
            <span>${escapeHtml(getPhaseLabel(hand?.phase ?? "idle"))}</span>
            <strong>$${hand?.pot ?? 0}</strong>
          </div>
        </div>

        <div class="poker-felt-shell">
          <div class="poker-felt">
            <div class="felt-ring"></div>
            ${renderOpponentSeats(seats, hand?.phase === "finished")}

            <div class="center-board">
              <div class="pot-stack">
                <span>MAIN POT</span>
                <strong>$${hand?.pot ?? 0}</strong>
              </div>
              <div class="board-cards">
                <span class="zone-label">Board</span>
                ${playingCards(hand?.communityCards ?? [], { highlightedIds, size: "board" })}
              </div>
            </div>

            <div class="hero-seat">
              <div class="hero-seat-info">
                <span>YOU</span>
                <strong>$${state.player.bankroll}</strong>
              </div>
              ${playingCards(hand?.playerHoleCards ?? [], { highlightedIds, size: "hero" })}
            </div>
          </div>
        </div>

        <div class="decision-dock">
          <button class="primary" data-action="start-hand" ${hand?.awaitingPlayer ? "disabled" : ""}>Новая раздача</button>
          <button data-action="player-action" data-id="fold" ${actions.includes("fold") ? "" : "disabled"}>Fold</button>
          <button data-action="player-action" data-id="check" ${actions.includes("check") ? "" : "disabled"}>Check</button>
          <button data-action="player-action" data-id="call" ${actions.includes("call") ? "" : "disabled"}>Call</button>
          <button data-action="player-action" data-id="raise" ${actions.includes("raise") ? "" : "disabled"}>Raise</button>
        </div>
      </article>

      <aside class="table-inspector">
        <article class="surface hand-panel">
          <span class="eyebrow">Best hand</span>
          <h3>${escapeHtml(handInfo.title)}</h3>
          <p>${escapeHtml(handInfo.detail)}</p>
          <div class="divider"></div>
          <span class="eyebrow">Coach note</span>
          <p>${escapeHtml(getHandHint(hand))}</p>
        </article>

        <article class="surface compact-panel">
          <div class="section-head compact-head">
            <div>
              <span class="eyebrow">Table HUD</span>
              <h3>Игроки</h3>
            </div>
          </div>
          <div class="seat-list inspector-list">
            ${seats.length ? seats.map((seat) => renderSeatInspector(seat, hand.phase === "finished")).join("") : emptyState("Начни раздачу, чтобы собрать стол.")}
          </div>
        </article>
      </aside>
    </section>

    <section class="section-block split-section log-section">
      <article class="surface">
        <div class="section-head compact-head">
          <div>
            <span class="eyebrow">Hand timeline</span>
            <h3>Ход раздачи</h3>
          </div>
        </div>
        <div class="log-feed compact">
          ${hand?.actionLog?.length ? hand.actionLog.slice(-14).reverse().map((line) => `<div class="feed-item">${escapeHtml(line)}</div>`).join("") : emptyState("Пока нет действий.")}
        </div>
      </article>

      <article class="surface accent-panel">
        <span class="eyebrow">Read the room</span>
        <h3>Главная панель</h3>
        <p>Смотри на банк, фазу, борд, свою комбинацию и действия NPC. На телефоне кнопки остаются внизу, стол не превращается в кашу.</p>
      </article>
    </section>
  `;
}

function renderOpponentSeats(seats, revealCards) {
  if (!seats.length) {
    return `<div class="empty-table-hint">Нажми «Новая раздача»</div>`;
  }

  return seats
    .map((seat, index) => {
      const pos = `seat-pos-${index}`;
      return `
        <div class="opponent-seat ${pos} ${seat.folded ? "folded" : ""}">
          <div class="seat-avatar">${escapeHtml(initials(seat.npc.name))}</div>
          <div class="seat-meta">
            <strong>${escapeHtml(shortName(seat.npc.name))}</strong>
            <span>${seat.folded ? "Fold" : escapeHtml(seat.npc.archetype?.name ?? seat.npc.archetypeId)}</span>
          </div>
          ${playingCards(seat.holeCards, { hidden: !revealCards, size: "mini" })}
        </div>
      `;
    })
    .join("");
}

function renderSeatInspector(seat, revealCards) {
  return `
    <div class="seat-card ${seat.folded ? "folded" : ""}">
      <div>
        <strong>${escapeHtml(seat.npc.name)}</strong>
        <span>${seat.folded ? "пас" : escapeHtml(seat.npc.archetype?.name ?? seat.npc.archetypeId)}</span>
      </div>
      ${playingCards(seat.holeCards, { hidden: !revealCards, size: "small" })}
    </div>
  `;
}

function renderCareerScreen(state) {
  const player = state.player;
  return `
    <section class="profile-layout">
      <article class="surface room-hero profile-hero">
        <div>
          <span class="eyebrow">Career profile</span>
          <h2>Профиль игрока</h2>
          <p>Ранг: <strong>${escapeHtml(player.rank)}</strong>. Рост идёт через банкролл, знания, репутацию и открытые коллекции.</p>
          ${progressBar(getXpProgress(player))}
        </div>
      </article>
      <aside class="surface profile-tile">
        <span class="eyebrow">Core stats</span>
        <div class="metric-grid two-cols">
          ${metric("Bankroll", `$${player.bankroll}`)}
          ${metric("Rep", player.reputation)}
          ${metric("Poker", `Lv.${player.pokerLevel}`)}
          ${metric("Knowledge", `Lv.${player.knowledgeLevel}`)}
        </div>
      </aside>
    </section>

    <section class="section-block stat-cards">
      ${metric("Рук сыграно", player.handsPlayed)}
      ${metric("Побед", player.handsWon)}
      ${metric("Крупнейший банк", `$${player.biggestPotWon}`)}
      ${metric("Крупнейший проигрыш", `$${player.biggestPotLost}`)}
    </section>

    <section class="surface danger-zone">
      <h3>Сохранение</h3>
      <p>Прогресс хранится в браузере через localStorage. На GitHub Pages это работает без backend.</p>
      <button class="danger" data-action="reset-save">Сбросить прогресс</button>
    </section>
  `;
}

function renderNpcScreen(state) {
  const context = getClubContext(state.content, state.activeClubId);
  const npcs = context.npcs.map((npc) => ({ ...npc, archetype: state.content.byId.archetypes[npc.archetypeId] }));

  return `
    <section class="surface page-hero">
      <span class="eyebrow">NPC database</span>
      <h2>Пул игроков клуба</h2>
      <p>Основная масса игроков — данные. Важными становятся только те, кого поднимает карьера, события или история.</p>
      ${badges(["T0 фон", "T1 реги", "T2 важные", "T3 ключевые"], "blue")}
    </section>

    <section class="npc-grid">
      ${npcs.map(renderNpcItem).join("")}
    </section>
  `;
}

function renderNpcItem(npc) {
  return `
    <article class="surface npc-card">
      <div class="npc-topline">
        <div>
          <span class="eyebrow">${escapeHtml(npc.tier)}</span>
          <h4>${escapeHtml(npc.name)}</h4>
        </div>
        <span class="npc-bankroll">$${escapeHtml(npc.bankroll)}</span>
      </div>
      <p>${escapeHtml(npc.archetype?.name ?? npc.archetypeId)}</p>
      <div class="metric-grid two-cols">
        ${metric("Skill", npc.skillLevel)}
        ${metric("Fame", npc.fame ?? 0)}
      </div>
      <p class="muted small-text">${escapeHtml(npc.knownFor)}</p>
    </article>
  `;
}

function renderGlossaryScreen(state) {
  const unlocked = new Set(state.career.unlockedGlossary);
  return `
    <section class="surface page-hero">
      <span class="eyebrow">Poker language</span>
      <h2>Словарь клуба</h2>
      <p>Настоящие термины + локальные названия. Учёба идёт через игру, а не через сухую стену текста.</p>
    </section>

    <section class="collection-grid">
      ${state.content.glossaryTerms.map((term) => renderGlossaryTerm(term, unlocked.has(term.id))).join("")}
    </section>
  `;
}

function renderGlossaryTerm(term, unlocked) {
  return `
    <article class="surface collection-card ${unlocked ? "unlocked" : "locked"}">
      <span class="eyebrow">${escapeHtml(term.category)}</span>
      <h4>${unlocked ? escapeHtml(term.name) : "???"}</h4>
      <p>${unlocked ? escapeHtml(term.short) : "Откроется через игру."}</p>
      ${unlocked ? badges([term.rarity, term.realTerm], "green") : badges(["locked"])}
    </article>
  `;
}

function renderCollectionsScreen(state) {
  const unlocked = new Set(state.career.unlockedCollections);
  return `
    <section class="surface page-hero">
      <span class="eyebrow">Vault</span>
      <h2>Коллекции</h2>
      <p>Руки, архетипы, термины и редкие ситуации. Потом сюда лягут страны, клубы, турниры и Макао.</p>
    </section>

    <section class="collection-grid">
      ${state.content.collections.map((item) => renderCollectionItem(item, unlocked.has(item.id))).join("")}
    </section>
  `;
}

function renderCollectionItem(item, unlocked) {
  return `
    <article class="surface collection-card ${unlocked ? "unlocked" : "locked"}">
      <span class="eyebrow">${escapeHtml(item.category)}</span>
      <h4>${unlocked ? escapeHtml(item.name) : "Закрыто"}</h4>
      <p>${unlocked ? escapeHtml(item.flavor) : "Нужно открыть в игре."}</p>
      ${badges([item.rarity, unlocked ? "unlocked" : "locked"], unlocked ? "gold" : "")}
    </article>
  `;
}

function initials(name) {
  return String(name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function shortName(name) {
  const clean = String(name).replaceAll("\"", "");
  if (clean.length <= 14) return clean;
  return `${clean.slice(0, 13)}…`;
}
