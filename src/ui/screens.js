import { canEnterTable, getClubContext } from "../engine/world.js";
import { getPhaseLabel, getAvailableActions, getHandHint, getCurrentHandInfo } from "../engine/poker.js";
import { getXpProgress } from "../engine/career.js";
import { badge, badges, emptyState, escapeHtml, metric, playingCards, progressBar } from "./components.js";

export const SCREENS = [
  { id: "club", label: "Клуб" },
  { id: "table", label: "Стол" },
  { id: "career", label: "Карьера" },
  { id: "npcs", label: "Игроки" },
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

  return `
    <section class="dashboard-grid">
      <article class="club-hero luxury-panel">
        <div class="screen-title-row">
          <div>
            <span class="eyebrow">${escapeHtml(country.name)} · ${escapeHtml(city.name)}</span>
            <h2>${escapeHtml(club.name)}</h2>
          </div>
          <div class="club-mark">♠</div>
        </div>
        <p>${escapeHtml(club.description)}</p>
        <div class="hero-actions">
          <button class="primary red-primary" data-action="screen" data-id="table">Перейти к столу</button>
          <button data-action="start-hand">Быстрая раздача</button>
        </div>
      </article>

      <aside class="luxury-panel account-card">
        <span class="eyebrow">Room Status</span>
        <div class="metric-grid two-cols">
          ${metric("Лимиты", `$${club.minBuyIn}–$${club.maxBuyIn}`)}
          ${metric("NPC", npcs.length)}
          ${metric("Стол", activeTable?.name ?? "—")}
          ${metric("Игры", club.availableGames.length)}
        </div>
        ${badges([club.type, club.tier, "content pack"], "gold")}
      </aside>
    </section>

    <section class="section-block">
      <div class="section-head">
        <div>
          <span class="eyebrow">Recommended tables</span>
          <h3>Столы клуба</h3>
        </div>
      </div>
      <div class="table-list premium-list">
        ${tables.map((table) => renderTableListItem(state, table)).join("")}
      </div>
    </section>

    <section class="section-block">
      <div class="section-head">
        <div>
          <span class="eyebrow">Club feed</span>
          <h3>Журнал</h3>
        </div>
      </div>
      <div class="log-feed">
        ${state.log.length ? state.log.slice(-6).reverse().map((line) => `<div class="feed-item">${escapeHtml(line)}</div>`).join("") : emptyState("Журнал пуст.")}
      </div>
    </section>
  `;
}

function renderTableListItem(state, table) {
  const access = canEnterTable(state.player, table);
  const active = state.activeTableId === table.id;
  return `
    <article class="table-row ${active ? "selected" : ""}">
      <div class="table-icon">♣</div>
      <div>
        <div class="row-title">${escapeHtml(table.name)}</div>
        <p>${escapeHtml(table.gameType)} · $${table.smallBlind}/$${table.bigBlind} · ${escapeHtml(table.limitType)}</p>
        ${badges([table.tableMood, `${table.seats} max`, `D${table.difficulty}`], active ? "red" : "")}
      </div>
      <button class="${active ? "primary red-primary" : ""}" data-action="select-table" data-id="${escapeHtml(table.id)}" ${access.ok ? "" : "disabled"}>
        ${active ? "Открыт" : access.ok ? "Выбрать" : access.reason}
      </button>
    </article>
  `;
}

function renderTableScreen(state) {
  const context = getClubContext(state.content, state.activeClubId);
  const table = state.content.byId.tables[state.activeTableId];
  const hand = state.tableState;
  const animation = hand?.animation ?? {};
  const revealCount = typeof animation.revealedCommunityCount === "number" ? animation.revealedCommunityCount : hand?.communityCards?.length ?? 0;
  const visibleCommunityCards = (hand?.communityCards ?? []).slice(0, revealCount);
  const displayHand = { ...hand, communityCards: visibleCommunityCards };
  const actions = getAvailableActions(hand);
  const handInfo = getCurrentHandInfo(displayHand);
  const highlightedIds = handInfo.highlightedIds ?? new Set();
  const currentEvent = animation.currentEvent;
  const revealNpcCards = hand?.phase === "finished" || currentEvent?.action === "showdown" || currentEvent?.action === "winner";

  return `
    <section class="poker-world-screen">
      <div class="poker-table-card luxury-panel">
        <div class="table-meta">
          <button class="ghost-button" data-action="screen" data-id="club">×</button>
          <div>
            <span class="eyebrow">${escapeHtml(context.club.name)}</span>
            <h2>${escapeHtml(table.name)}</h2>
            <p>$${table.smallBlind}/$${table.bigBlind} NLH · Hand #${hand?.handNumber ? String(hand.handNumber).slice(-6) : "—"}</p>
          </div>
          <div class="phase-chip">${escapeHtml(getPhaseLabel(hand?.phase ?? "idle"))}</div>
        </div>

        <div class="cinematic-table ${animation.isPlaying ? "animating" : ""} ${animation.showWinner ? "winner-mode" : ""}">
          ${renderNpcSeats(hand, currentEvent, revealNpcCards)}

          <div class="red-orbit"></div>
          <div class="pot-center ${currentEvent?.action === "winner" ? "pot-won" : ""}">
            <small>POT</small>
            <strong>$${hand?.pot ?? 0}</strong>
          </div>

          <div class="board-stack">
            <span class="zone-label">Board</span>
            ${boardCards(hand?.communityCards ?? [], revealCount, highlightedIds)}
          </div>

          ${currentEvent ? renderActionToast(currentEvent, animation) : renderIdleToast(hand)}

          <div class="hero-seat ${currentEvent?.actorId === "player" ? "acting" : ""} ${hand?.lastResult?.winnerId === "player" || hand?.lastResult?.winner === "player" ? "winner-seat" : ""}">
            <div class="hero-cards">${playingCards(hand?.playerHoleCards ?? [], { highlightedIds, size: "large" })}</div>
            <div class="hero-nameplate">
              <strong>You</strong>
              <span>$${state.player.bankroll} · invested $${hand?.playerInvested ?? 0}</span>
            </div>
          </div>
        </div>

        ${renderActionDock(actions, hand)}
      </div>

      <aside class="hand-sidebar luxury-panel">
        ${renderHandInspector(handInfo, hand, currentEvent)}
        ${renderTimeline(hand)}
      </aside>
    </section>
  `;
}

function renderNpcSeats(hand, currentEvent, revealCards) {
  const seats = hand?.npcSeats ?? [];
  if (!seats.length) return `<div class="empty-table-note">Начни раздачу, чтобы собрать стол.</div>`;
  return seats
    .map((seat, index) => {
      const seatClass = `seat-pos-${index + 1}`;
      const isActing = currentEvent?.actorId === seat.npc.id;
      const isWinner = hand?.lastResult?.winnerId === seat.npc.id || hand?.lastResult?.winner === seat.npc.id;
      return `
        <div class="player-seat ${seatClass} ${seat.folded ? "folded" : ""} ${isActing ? "acting" : ""} ${isWinner ? "winner-seat" : ""}">
          <div class="avatar-ring"><span>${escapeHtml(initials(seat.npc.name))}</span></div>
          <div class="seat-info">
            <strong>${escapeHtml(seat.npc.name)}</strong>
            <span>$${seat.stack ?? seat.npc.bankroll}</span>
          </div>
          <div class="seat-action">${escapeHtml(actionLabel(seat.lastAction))}${seat.lastAmount ? ` $${seat.lastAmount}` : ""}</div>
          <div class="seat-cards">${playingCards(seat.holeCards, { hidden: !revealCards, size: "small" })}</div>
        </div>
      `;
    })
    .join("");
}

function boardCards(cards, revealCount, highlightedIds) {
  const slots = [];
  for (let index = 0; index < 5; index += 1) {
    const card = cards[index];
    if (card && index < revealCount) {
      slots.push(playingCards([card], { highlightedIds, size: "large" }));
    } else {
      slots.push(`<div class="card-slot"></div>`);
    }
  }
  return `<div class="board-cards cinematic-cards">${slots.join("")}</div>`;
}

function renderActionToast(event, animation) {
  return `
    <div class="action-toast action-${escapeHtml(event.action)}" key="${escapeHtml(event.id)}">
      <small>${escapeHtml(event.actorName)}</small>
      <strong>${escapeHtml(actionTitle(event.action))}</strong>
      <p>${escapeHtml(event.message)}</p>
      <div class="event-progress"><span style="width:${Math.round(((animation.index + 1) / Math.max(animation.total, 1)) * 100)}%"></span></div>
    </div>
  `;
}

function renderIdleToast(hand) {
  if (!hand?.playerHoleCards?.length) {
    return `<div class="table-start-card"><strong>Ready to play?</strong><p>Нажми «Новая раздача». Стол оживёт ход за ходом.</p></div>`;
  }
  if (hand.awaitingPlayer) {
    return `<div class="table-start-card waiting"><strong>Твой ход</strong><p>Выбери действие. После этого NPC будут ходить по очереди.</p></div>`;
  }
  return "";
}

function renderActionDock(actions, hand) {
  const animating = hand?.animation?.isPlaying;
  return `
    <div class="table-controls">
      <button class="primary red-primary new-hand-button" data-action="start-hand" ${hand?.awaitingPlayer || animating ? "disabled" : ""}>Новая раздача</button>
      <button data-action="player-action" data-id="fold" ${actions.includes("fold") ? "" : "disabled"}>Fold</button>
      <button data-action="player-action" data-id="check" ${actions.includes("check") ? "" : "disabled"}>Check</button>
      <button data-action="player-action" data-id="call" ${actions.includes("call") ? "" : "disabled"}>Call</button>
      <button class="raise-button" data-action="player-action" data-id="raise" ${actions.includes("raise") ? "" : "disabled"}>Raise</button>
    </div>
  `;
}

function renderHandInspector(handInfo, hand, currentEvent) {
  const result = hand?.lastResult;
  return `
    <article class="inspector-card">
      <span class="eyebrow">Best Hand</span>
      <h3>${escapeHtml(result?.winningHand?.categoryName ?? handInfo.title)}</h3>
      <p>${escapeHtml(result?.winningHand?.summary ?? handInfo.detail)}</p>
      ${result ? `<div class="winner-card"><small>Winner</small><strong>${escapeHtml(result.winnerName ?? (result.winner === "player" ? "Ты" : "Стол"))}</strong><span>Pot $${result.pot}</span></div>` : ""}
      <div class="divider"></div>
      <strong>Подсказка</strong>
      <p>${escapeHtml(currentEvent?.message ?? getHandHint(hand))}</p>
    </article>
  `;
}

function renderTimeline(hand) {
  const events = hand?.animation?.recentEvents ?? [];
  const logFallback = hand?.actionLog?.slice(-4).map((message, index) => ({ id: `log-${index}`, message, actorName: "Log", action: "log" })) ?? [];
  const rows = events.length ? events : logFallback;
  return `
    <article class="inspector-card timeline-card">
      <span class="eyebrow">Action Feed</span>
      <h3>Ход раздачи</h3>
      <div class="mini-timeline">
        ${rows.length ? rows.slice(-5).reverse().map((event) => `
          <div class="timeline-row">
            <span>${escapeHtml(actionTitle(event.action))}</span>
            <p>${escapeHtml(event.message)}</p>
          </div>
        `).join("") : emptyState("Пока нет действий.")}
      </div>
    </article>
  `;
}

function renderCareerScreen(state) {
  const player = state.player;
  return `
    <section class="dashboard-grid">
      <article class="club-hero luxury-panel">
        <span class="eyebrow">Career profile</span>
        <h2>Карьера</h2>
        <p>Ранг: <strong>${escapeHtml(player.rank)}</strong>. Рост идёт через банкролл, знания, репутацию и открытые коллекции.</p>
        ${progressBar(getXpProgress(player))}
      </article>
      <aside class="luxury-panel account-card">
        <h3>Статы</h3>
        <div class="metric-grid two-cols">
          ${metric("Bankroll", `$${player.bankroll}`)}
          ${metric("Rep", player.reputation)}
          ${metric("Poker", `Lv.${player.pokerLevel}`)}
          ${metric("Knowledge", `Lv.${player.knowledgeLevel}`)}
        </div>
      </aside>
    </section>

    <section class="section-block">
      <div class="stat-cards">
        ${metric("Рук сыграно", player.handsPlayed)}
        ${metric("Побед", player.handsWon)}
        ${metric("Крупнейший банк", `$${player.biggestPotWon}`)}
        ${metric("Крупнейший проигрыш", `$${player.biggestPotLost}`)}
      </div>
    </section>

    <section class="luxury-panel danger-zone">
      <h3>Сохранение</h3>
      <p>Прогресс сохраняется в браузере через localStorage.</p>
      <button class="danger" data-action="reset-save">Сбросить прогресс</button>
    </section>
  `;
}

function renderNpcScreen(state) {
  const context = getClubContext(state.content, state.activeClubId);
  const npcs = context.npcs.map((npc) => ({ ...npc, archetype: state.content.byId.archetypes[npc.archetypeId] }));

  return `
    <section class="luxury-panel page-intro">
      <span class="eyebrow">NPC database</span>
      <h2>Игроки клуба</h2>
      <p>Большая масса игроков — данные. Важными становятся только те, кого поднимает карьера, события или история.</p>
      ${badges(["T0 фон", "T1 реги", "T2 важные", "T3 ключевые"], "red")}
    </section>

    <section class="npc-grid">
      ${npcs.map(renderNpcItem).join("")}
    </section>
  `;
}

function renderNpcItem(npc) {
  return `
    <article class="luxury-panel npc-card">
      <div class="npc-topline">
        <h4>${escapeHtml(npc.name)}</h4>
        <span>${escapeHtml(npc.tier)}</span>
      </div>
      <p>${escapeHtml(npc.archetype?.name ?? npc.archetypeId)}</p>
      <div class="metric-grid two-cols">
        ${metric("Skill", npc.skillLevel)}
        ${metric("Bankroll", `$${npc.bankroll}`)}
      </div>
      <p class="muted small-text">${escapeHtml(npc.knownFor)}</p>
    </article>
  `;
}

function renderGlossaryScreen(state) {
  const unlocked = new Set(state.career.unlockedGlossary);
  return `
    <section class="luxury-panel page-intro">
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
    <article class="luxury-panel collection-card ${unlocked ? "unlocked" : "locked"}">
      <h4>${unlocked ? escapeHtml(term.name) : "???"}</h4>
      <p>${unlocked ? escapeHtml(term.short) : "Откроется через игру."}</p>
      ${unlocked ? badges([term.category, term.rarity, term.realTerm], "red") : badges([term.category, "locked"])}
    </article>
  `;
}

function renderCollectionsScreen(state) {
  const unlocked = new Set(state.career.unlockedCollections);
  return `
    <section class="luxury-panel page-intro">
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
    <article class="luxury-panel collection-card ${unlocked ? "unlocked" : "locked"}">
      <h4>${unlocked ? escapeHtml(item.name) : "Закрыто"}</h4>
      <p>${unlocked ? escapeHtml(item.flavor) : "Нужно открыть в игре."}</p>
      ${badges([item.category, item.rarity, unlocked ? "unlocked" : "locked"], unlocked ? "gold" : "")}
    </article>
  `;
}

function initials(name) {
  return String(name ?? "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function actionLabel(action) {
  const labels = {
    blind: "Blind",
    fold: "Fold",
    folded: "Folded",
    call: "Call",
    check: "Check",
    raise: "Raise",
  };
  return labels[action] ?? "Ready";
}

function actionTitle(action) {
  const labels = {
    shuffle: "Deal",
    blind: "Blinds",
    deal: "Cards",
    fold: "Fold",
    call: "Call",
    check: "Check",
    raise: "Raise",
    flop: "Flop",
    turn: "Turn",
    river: "River",
    showdown: "Showdown",
    show: "Reveal",
    winner: "Winner",
    log: "Log",
  };
  return labels[action] ?? action;
}
