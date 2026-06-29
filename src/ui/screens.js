import { canEnterTable, getClubContext } from "../engine/world.js?v=0.4.8";
import { getPhaseLabel, getAvailableActions, getActionMeta, getHandHint, getCurrentHandInfo } from "../engine/poker.js?v=0.4.8";
import { getXpProgress } from "../engine/career.js?v=0.4.8";
import { describeCards } from "../engine/cards.js?v=0.4.8";
import { badges, emptyState, escapeHtml, metric, playingCards, progressBar } from "./components.js?v=0.4.8";

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
    <section class="home-grid">
      <article class="hero-card panel-soft">
        <div class="kicker">${escapeHtml(country.name)} · ${escapeHtml(city.name)}</div>
        <h2>${escapeHtml(club.name)}</h2>
        <p>${escapeHtml(club.description)}</p>
        <div class="hero-buttons">
          <button class="primary" data-action="screen" data-id="table">Открыть стол</button>
          <button data-action="start-hand">Новая раздача</button>
        </div>
      </article>

      <aside class="panel-soft room-summary">
        <div class="summary-row"><span>Активный стол</span><strong>${escapeHtml(activeTable?.name ?? "—")}</strong></div>
        <div class="summary-row"><span>Лимиты</span><strong>$${club.minBuyIn}–$${club.maxBuyIn}</strong></div>
        <div class="summary-row"><span>Игроки</span><strong>${npcs.length}</strong></div>
        <div class="summary-row"><span>Тип</span><strong>${escapeHtml(club.type)}</strong></div>
      </aside>
    </section>

    <section class="content-section">
      <div class="section-title"><h3>Столы</h3><span>${tables.length}</span></div>
      <div class="table-list clean-list">
        ${tables.map((table) => renderTableListItem(state, table)).join("")}
      </div>
    </section>

    <section class="content-section compact-feed">
      <div class="section-title"><h3>Журнал</h3><span>последнее</span></div>
      <div class="feed-list">
        ${state.log.length ? state.log.slice(-4).reverse().map((line) => `<div class="feed-line">${escapeHtml(line)}</div>`).join("") : emptyState("Пока пусто.")}
      </div>
    </section>

    ${renderSystemPanel(state)}
  `;
}

function renderSystemPanel(state) {
  const system = state.system ?? {};
  const info = system.saveInfo ?? {};
  const updated = system.lastSavedAt ? formatDateTime(system.lastSavedAt) : "—";
  const online = system.online === false ? "Офлайн" : "Онлайн";
  const cache = system.controlled ? "PWA active" : system.serviceWorker ? "PWA ready" : "Browser";

  return `
    <section class="content-section system-panel">
      <div class="section-title"><h3>Система</h3><span>v${escapeHtml(system.appVersion ?? "0.4.8")}</span></div>
      <div class="system-grid">
        <div class="system-line"><span>Сейв</span><strong>${info.exists ? `schema ${escapeHtml(String(info.schemaVersion ?? "?"))}` : "новый"}</strong></div>
        <div class="system-line"><span>Сохранено</span><strong>${escapeHtml(updated)}</strong></div>
        <div class="system-line"><span>Режим</span><strong>${escapeHtml(online)}</strong></div>
        <div class="system-line"><span>Кэш</span><strong>${escapeHtml(cache)}</strong></div>
      </div>
      <div class="system-actions">
        <button class="small-button" data-action="export-save">Экспорт сейва</button>
        <button class="small-button" data-action="import-save">Импорт</button>
        <button class="small-button" data-action="check-update">Проверить</button>
        <button class="small-button" data-action="force-update">Принудительно обновить</button>
        <button class="small-button danger" data-action="reset-save">Сброс</button>
      </div>
    </section>
  `;
}

function formatDateTime(value) {
  try {
    return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
  } catch (error) {
    return "—";
  }
}

function renderTableListItem(state, table) {
  const access = canEnterTable(state.player, table);
  const active = state.activeTableId === table.id;
  return `
    <article class="table-item ${active ? "selected" : ""}">
      <div class="table-symbol">♠</div>
      <div class="table-copy">
        <strong>${escapeHtml(table.name)}</strong>
        <span>$${table.smallBlind}/$${table.bigBlind} · ${escapeHtml(table.limitType)} · D${table.difficulty}</span>
      </div>
      <button class="small-button ${active ? "primary" : ""}" data-action="select-table" data-id="${escapeHtml(table.id)}" ${access.ok ? "" : "disabled"}>
        ${active ? "Выбран" : access.ok ? "Сесть" : access.reason}
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
  const actionMeta = getActionMeta(hand, table);
  const handInfo = getCurrentHandInfo(displayHand);
  const highlightedIds = handInfo.highlightedIds ?? new Set();
  const currentEvent = animation.currentEvent;
  const revealNpcCards = hand?.lastResult?.showdown || currentEvent?.action === "showdown" || currentEvent?.action === "show";
  const heroFolded = Boolean(hand?.heroSeat?.folded || hand?.phase === "folded");
  const heroActing = !heroFolded && (currentEvent?.actorId === "player" || hand?.currentActorId === "player");
  const heroPosition = heroFolded ? "Fold" : (hand?.heroSeat?.position ?? "");
  const heroBetText = !heroFolded && hand?.heroSeat?.currentBet ? ` · Bet $${hand.heroSeat.currentBet}` : "";
  const heroLine = heroFolded
    ? `Fold${hand?.playerInvested ? ` · -$${hand.playerInvested}` : ""}`
    : `$${hand?.heroSeat?.stack ?? state.player.bankroll}${heroBetText}`;
  const heroCards = heroFolded
    ? `<div class="fold-marker hero-fold-marker">Fold</div>`
    : playingCards(hand?.playerHoleCards ?? [], { highlightedIds, size: "large" });

  return `
    <section class="table-page">
      <div class="table-header panel-soft">
        <button class="icon-button" data-action="screen" data-id="club">←</button>
        <div>
          <strong>${escapeHtml(table.name)}</strong>
          <span>${escapeHtml(context.club.name)} · $${table.smallBlind}/$${table.bigBlind}</span>
        </div>
        <div class="phase-pill">${escapeHtml(getPhaseLabel(hand?.phase ?? "idle"))}</div>
      </div>

      <div class="game-area">
        <main class="felt-stage ${animation.isPlaying ? "is-playing" : ""} ${animation.showWinner ? "has-winner" : ""}">
          ${renderNpcSeats(hand, currentEvent, revealNpcCards)}

          <div class="table-ring"></div>

          <div class="pot-chip ${currentEvent?.action === "winner" ? "won" : ""}">
            <span>${escapeHtml(getPhaseLabel(hand?.phase ?? "idle"))}</span>
            <strong>$${hand?.pot ?? 0}</strong>
            <small>${hand?.currentBet ? `Bet $${hand.currentBet}` : "No bet"}</small>
          </div>

          <div class="board-zone">
            ${boardCards(hand?.communityCards ?? [], revealCount, highlightedIds)}
          </div>

          ${currentEvent ? renderActionToast(currentEvent, animation) : renderIdleToast(hand)}

          <div class="hero-player ${heroFolded ? "folded" : ""} ${heroActing ? "acting" : ""} ${isPlayerWinner(hand) ? "winner" : ""}">
            <div class="hero-cards">${heroCards}</div>
            <div class="hero-info">
              <strong>Ты <em>${escapeHtml(heroPosition)}</em></strong>
              <span>${escapeHtml(heroLine)}</span>
            </div>
          </div>
        </main>

        <aside class="table-info panel-soft">
          ${renderCompactHandInfo(handInfo, hand, currentEvent, actionMeta, state.settings)}
        </aside>
      </div>

      ${renderActionDock(actions, hand, actionMeta)}
    </section>
  `;
}

function renderNpcSeats(hand, currentEvent, revealCards) {
  const seats = hand?.npcSeats ?? [];
  if (!seats.length) return `<div class="empty-seat-note">Нажми «Новая раздача».</div>`;
  return seats
    .map((seat, index) => {
      const isActing = !seat.folded && (currentEvent?.actorId === seat.id || hand?.currentActorId === seat.id);
      const isWinner = isSeatWinner(hand, seat.id);
      const status = seat.folded ? "Fold" : actionLabel(seat.lastAction);
      const amount = !seat.folded && seat.lastAmount ? ` $${seat.lastAmount}` : "";
      const betText = !seat.folded && seat.currentBet ? ` · Bet $${seat.currentBet}` : "";
      const cards = seat.folded ? `<div class="fold-marker">Fold</div>` : playingCards(seat.holeCards, { hidden: !revealCards, size: "small" });
      return `
        <div class="seat seat-${index + 1} ${seat.folded ? "folded" : ""} ${isActing ? "acting" : ""} ${isWinner ? "winner" : ""}">
          <div class="seat-avatar">${escapeHtml(initials(seat.name))}</div>
          <div class="seat-main">
            <strong>${escapeHtml(shortName(seat.name))} <em>${escapeHtml(seat.position ?? "")}</em></strong>
            <span>$${seat.stack ?? seat.npc?.bankroll ?? 0}${betText}</span>
          </div>
          <div class="seat-status">${escapeHtml(status)}${escapeHtml(amount)}</div>
          <div class="seat-cards">${cards}</div>
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
  return `<div class="board-cards">${slots.join("")}</div>`;
}

function renderActionToast(event, animation) {
  return `
    <div class="action-bubble action-${escapeHtml(event.action)}">
      <span>${escapeHtml(event.actorName)}</span>
      <strong>${escapeHtml(actionTitle(event.action))}</strong>
      <small>${escapeHtml(cleanEventText(event))}</small>
      <i style="width:${Math.round(((animation.index + 1) / Math.max(animation.total, 1)) * 100)}%"></i>
    </div>
  `;
}

function renderIdleToast(hand) {
  if (hand?.phase === "folded" || hand?.heroSeat?.folded) {
    return `<div class="action-bubble folded"><strong>Пас</strong><small>Раздача закрыта.</small></div>`;
  }
  if (!hand?.playerHoleCards?.length) {
    return `<div class="action-bubble idle"><strong>Стол свободен</strong><small>Новая раздача.</small></div>`;
  }
  if (hand.awaitingPlayer) {
    return `<div class="action-bubble waiting"><span>${escapeHtml(hand.heroSeat?.position ?? "")}</span><strong>Твой ход</strong><small>${escapeHtml(getHandHint(hand))}</small></div>`;
  }
  if (hand.currentActorName) {
    return `<div class="action-bubble idle"><strong>${escapeHtml(hand.currentActorName)}</strong><small>думает</small></div>`;
  }
  return "";
}

function renderActionDock(actions, hand, actionMeta = {}) {
  const animating = hand?.animation?.isPlaying;
  const terminal = ["finished", "folded", "idle"].includes(hand?.phase);
  const canHeroAct = Boolean(hand?.awaitingPlayer && !animating && !terminal && hand?.heroSeat && !hand.heroSeat.folded && !hand.heroSeat.allIn);
  const canFold = canHeroAct || actions.includes("fold");
  const labels = actionMeta.labels ?? {};
  return `
    <div class="action-dock panel-soft ${terminal ? "terminal" : ""}">
      <button data-action="start-hand" ${animating || hand?.awaitingPlayer ? "disabled" : ""}>Новая</button>
      <button data-action="player-action" data-id="fold" ${canFold ? "" : "disabled"}>${escapeHtml(labels.fold ?? "Fold")}</button>
      <button data-action="player-action" data-id="check" ${actions.includes("check") ? "" : "disabled"}>${escapeHtml(labels.check ?? "Check")}</button>
      <button data-action="player-action" data-id="call" ${actions.includes("call") ? "" : "disabled"}>${escapeHtml(labels.call ?? "Call")}</button>
      <button class="primary" data-action="player-action" data-id="raise" ${actions.includes("raise") ? "" : "disabled"}>${escapeHtml(labels.raise ?? "Raise")}</button>
    </div>
  `;
}

function renderCompactHandInfo(handInfo, hand, currentEvent, actionMeta = {}, settings = {}) {
  const result = hand?.lastResult;
  const rows = hand?.animation?.recentEvents ?? [];
  const terminal = hand?.phase === "finished" || hand?.phase === "folded";
  const current = hand?.phase === "folded" ? "Fold" : hand?.awaitingPlayer ? "Ты" : terminal ? "—" : hand?.currentActorName ?? "—";
  const tablePrompt = terminal ? "Раздача закрыта" : actionMeta.toCall ? `Call $${actionMeta.toCall}` : hand?.currentBet ? `Bet $${hand.currentBet}` : "Check available";
  return `
    <div class="info-block table-state-block">
      <span>Ход</span>
      <strong>${escapeHtml(current)}</strong>
      <p>${escapeHtml(tablePrompt)}</p>
    </div>
    <div class="info-block pace-block">
      <span>Темп</span>
      <strong>${escapeHtml(speedLabel(settings?.animationSpeed ?? "normal"))}</strong>
      <button class="small-button" data-action="toggle-speed">Сменить</button>
    </div>
    <div class="info-block">
      <span>Рука</span>
      <strong>${escapeHtml(result?.winningHand?.categoryName ?? handInfo.title)}</strong>
      <p>${escapeHtml(result?.winningHand?.summary ?? handInfo.detail)}</p>
    </div>
    ${result ? `
      <div class="info-block winner-block">
        <span>Победитель</span>
        <strong>${escapeHtml(result.winnerName ?? "—")}</strong>
        <p>${result.bankrollDelta >= 0 ? "+" : "-"}$${Math.abs(result.bankrollDelta)} · банк $${result.pot}</p>
      </div>
      ${renderHandSummary(hand)}
      ${renderHandTranscript(hand)}
      ${result.review ? `
        <div class="info-block review-block">
          <span>${escapeHtml(result.review.title ?? "Разбор")}</span>
          <strong>Короткий разбор</strong>
          <p>${escapeHtml(result.review.text ?? "")}</p>
        </div>
      ` : ""}
    ` : ""}
    <div class="mini-feed">
      ${rows.length ? rows.slice(-5).reverse().map((event) => `<div><b>${escapeHtml(actionTitle(event.action))}</b><span>${escapeHtml(event.actorName)}</span></div>`).join("") : ""}
    </div>
  `;
}


function renderHandSummary(hand) {
  const result = hand?.lastResult;
  if (!result) return "";

  const heroFolded = Boolean(hand?.heroSeat?.folded || hand?.lastPlayerAction === "fold" || hand?.phase === "folded");
  const delta = Number(result.bankrollDelta ?? 0);
  const board = hand?.communityCards?.length ? describeCards(hand.communityCards) : "—";
  const resultLine = heroFolded
    ? `You: Fold · -$${Math.abs(hand?.playerInvested ?? delta)}`
    : `You: ${delta >= 0 ? "+" : "-"}$${Math.abs(delta)}`;
  const winLine = result.showdown && result.winningHand
    ? `${result.winnerName ?? "Winner"}: ${result.winningHand.categoryName}`
    : result.winner === "player"
      ? "Банк забран без вскрытия"
      : "Банк без вскрытия";
  const foldLine = heroFolded && result.showdown ? "Ты сбросил. Остальные доиграли банк." : null;

  return `
    <div class="info-block hand-summary-block">
      <span>Итог</span>
      <strong>${escapeHtml(winLine)}</strong>
      <p>${escapeHtml(resultLine)}</p>
      <p>Board: ${escapeHtml(board)}</p>
      ${foldLine ? `<p>${escapeHtml(foldLine)}</p>` : ""}
    </div>
  `;
}

function renderHandTranscript(hand) {
  const events = Array.isArray(hand?.handEvents) ? hand.handEvents : [];
  if (!events.length) return "";

  const groups = groupHandEvents(events);
  const rows = ["preflop", "flop", "turn", "river"]
    .map((street) => renderTranscriptRow(street, groups[street] ?? []))
    .filter(Boolean);

  if (!rows.length) return "";

  return `
    <div class="info-block transcript-block">
      <span>Ход руки</span>
      <div class="transcript-list">${rows.join("")}</div>
    </div>
  `;
}

function groupHandEvents(events) {
  return events.reduce((acc, event) => {
    const street = ["preflop", "flop", "turn", "river"].includes(event.street) ? event.street : "preflop";
    acc[street] = acc[street] ?? [];
    acc[street].push(event);
    return acc;
  }, {});
}

function renderTranscriptRow(street, events) {
  const playable = events.filter((event) => !["flop", "turn", "river"].includes(event.action));
  if (!playable.length) return "";

  const text = playable.slice(0, 5).map(formatTranscriptEvent).join(", ");
  const tail = playable.length > 5 ? "…" : "";
  return `<div><b>${escapeHtml(streetLabel(street))}</b><span>${escapeHtml(text + tail)}</span></div>`;
}

function formatTranscriptEvent(event) {
  const name = event.actorId === "player" ? "You" : shortName(event.actorName ?? "?");
  const amount = event.amount ? ` $${event.amount}` : "";
  const action = transcriptActionLabel(event.action);
  return `${name} ${action}${amount}`;
}

function transcriptActionLabel(action) {
  const labels = {
    sb: "SB",
    bb: "BB",
    blind: "Blind",
    fold: "fold",
    call: "call",
    check: "check",
    bet: "bet",
    raise: "raise",
    winner: "wins",
  };
  return labels[action] ?? action;
}

function streetLabel(street) {
  const labels = {
    preflop: "Preflop",
    flop: "Flop",
    turn: "Turn",
    river: "River",
  };
  return labels[street] ?? street;
}

function renderCareerScreen(state) {
  const player = state.player;
  return `
    <section class="page-card panel-soft">
      <div class="kicker">Профиль</div>
      <h2>Карьера</h2>
      <div class="rank-line"><strong>${escapeHtml(player.rank)}</strong>${progressBar(getXpProgress(player))}</div>
    </section>

    <section class="stats-grid">
      ${metric("Bankroll", `$${player.bankroll}`)}
      ${metric("Rep", player.reputation)}
      ${metric("Poker", `Lv.${player.pokerLevel}`)}
      ${metric("Knowledge", `Lv.${player.knowledgeLevel}`)}
      ${metric("Рук", player.handsPlayed)}
      ${metric("Побед", player.handsWon)}
      ${metric("Best pot", `$${player.biggestPotWon}`)}
      ${metric("Worst loss", `$${player.biggestPotLost}`)}
    </section>

    <section class="page-card panel-soft save-card">
      <strong>Сохранение</strong>
      <span>localStorage</span>
      <button class="danger small-button" data-action="reset-save">Сбросить</button>
    </section>
  `;
}

function renderNpcScreen(state) {
  const context = getClubContext(state.content, state.activeClubId);
  const npcs = context.npcs.map((npc) => ({ ...npc, archetype: state.content.byId.archetypes[npc.archetypeId] }));

  return `
    <section class="page-card panel-soft">
      <div class="kicker">Room players</div>
      <h2>Игроки</h2>
    </section>
    <section class="npc-list">
      ${npcs.map(renderNpcItem).join("")}
    </section>
  `;
}

function renderNpcItem(npc) {
  return `
    <article class="npc-item panel-soft">
      <div class="seat-avatar">${escapeHtml(initials(npc.name))}</div>
      <div>
        <strong>${escapeHtml(npc.name)}</strong>
        <span>${escapeHtml(npc.archetype?.name ?? npc.archetypeId)} · ${escapeHtml(npc.tier)}</span>
      </div>
      <em>$${npc.bankroll}</em>
    </article>
  `;
}

function renderGlossaryScreen(state) {
  const unlocked = new Set(state.career.unlockedGlossary);
  return `
    <section class="page-card panel-soft">
      <div class="kicker">Terms</div>
      <h2>Словарь</h2>
    </section>
    <section class="cards-grid">
      ${state.content.glossaryTerms.map((term) => renderGlossaryTerm(term, unlocked.has(term.id))).join("")}
    </section>
  `;
}

function renderGlossaryTerm(term, unlocked) {
  return `
    <article class="simple-card panel-soft ${unlocked ? "" : "locked"}">
      <strong>${unlocked ? escapeHtml(term.name) : "Закрыто"}</strong>
      <p>${unlocked ? escapeHtml(term.short) : "Откроется в игре."}</p>
      ${unlocked ? badges([term.category, term.realTerm], "red") : badges([term.category])}
    </article>
  `;
}

function renderCollectionsScreen(state) {
  const unlocked = new Set(state.career.unlockedCollections);
  return `
    <section class="page-card panel-soft">
      <div class="kicker">Vault</div>
      <h2>Коллекции</h2>
    </section>
    <section class="cards-grid">
      ${state.content.collections.map((item) => renderCollectionItem(item, unlocked.has(item.id))).join("")}
    </section>
  `;
}

function renderCollectionItem(item, unlocked) {
  return `
    <article class="simple-card panel-soft ${unlocked ? "" : "locked"}">
      <strong>${unlocked ? escapeHtml(item.name) : "Закрыто"}</strong>
      <p>${unlocked ? escapeHtml(item.flavor) : "Откроется в игре."}</p>
      ${badges([item.category, item.rarity], unlocked ? "gold" : "")}
    </article>
  `;
}

function speedLabel(value) {
  const labels = {
    normal: "Обычный",
    fast: "Быстрый",
    instant: "Мгновенный",
  };
  return labels[value] ?? labels.normal;
}

function isPlayerWinner(hand) {
  return isSeatWinner(hand, "player");
}

function isSeatWinner(hand, seatId) {
  const winnerId = String(hand?.lastResult?.winnerId ?? hand?.lastResult?.winner ?? "");
  return winnerId.split(",").includes(seatId);
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

function shortName(name) {
  const parts = String(name ?? "").split(/\s+/).filter(Boolean);
  if (parts.length <= 2) return name;
  return `${parts[0]} ${parts[1]}`;
}

function actionLabel(action) {
  const labels = {
    blind: "Blind",
    sb: "SB",
    bb: "BB",
    ready: "Ready",
    fold: "Fold",
    folded: "Fold",
    call: "Call",
    check: "Check",
    bet: "Bet",
    raise: "Raise",
    "all-in": "All-in",
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
    bet: "Bet",
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

function cleanEventText(event) {
  if (!event) return "";
  if (event.action === "winner") return event.message;
  if (["flop", "turn", "river"].includes(event.action)) return event.message;
  if (event.amount) return `$${event.amount}`;
  return event.message.replace(event.actorName, "").replace(/^[\s·:—-]+/, "").trim();
}
