import { canEnterTable, getClubContext } from "../engine/world.js?v=0.8.5";
import { getClubRoomState } from "../engine/club.js?v=0.8.5";
import { getPhaseLabel, getAvailableActions, getActionMeta, getHandHint, getCurrentHandInfo } from "../engine/poker.js?v=0.8.5";
import { getActiveChallenges, getChallengeDifficultyLabel, getChallengeProgress, getCompletedChallenges, getRankInfo, getRankLabel, getRankProgress, getXpProgress } from "../engine/career.js?v=0.8.5";
import { describeCards } from "../engine/cards.js?v=0.8.5";
import { badges, emptyState, escapeHtml, metric, playingCards, progressBar } from "./components.js?v=0.8.5";

export const SCREENS = [
  { id: "club", label: "Клуб" },
  { id: "table", label: "Стол" },
  { id: "career", label: "Карьера" },
  { id: "tasks", label: "Задания" },
  { id: "npcs", label: "Игроки" },
  { id: "glossary", label: "Словарь" },
  { id: "collections", label: "Коллекции" },
  { id: "settings", label: "Настройки" },
];

export function getVisibleScreens(state = {}) {
  const seated = Boolean(state.tableSession?.tableId);
  return SCREENS.filter((screen) => {
    if (screen.id === "table") return seated;
    if (screen.id === "club") return !seated;
    return true;
  });
}

export function renderScreen(state) {
  const seated = Boolean(state.tableSession?.tableId);
  const currentScreen = seated && state.currentScreen === "club" ? "table" : !seated && state.currentScreen === "table" ? "club" : state.currentScreen;
  let screen = "";
  if (currentScreen === "club") screen = renderClubScreen(state);
  else if (currentScreen === "table") screen = renderTableScreen(state);
  else if (currentScreen === "career") screen = renderCareerScreen(state);
  else if (currentScreen === "tasks") screen = renderTasksScreen(state);
  else if (currentScreen === "npcs") screen = renderNpcScreen(state);
  else if (currentScreen === "glossary") screen = renderGlossaryScreen(state);
  else if (currentScreen === "collections") screen = renderCollectionsScreen(state);
  else if (currentScreen === "settings") screen = renderSettingsScreen(state);
  else screen = renderClubScreen(state);
  return `${screen}${renderBuyInModal(state)}`;
}

function renderClubScreen(state) {
  const context = getClubContext(state.content, state.activeClubId);
  const { club, tables } = context;
  const room = getClubRoomState(state.content, state.clubNpcState, state.activeClubId);
  const journal = room.journal ?? [];

  return `
    <section class="room-lobby-layout">
      <article class="panel-soft room-lobby-panel">
        <div class="room-lobby-head">
          <div>
            <span>Cash lobby</span>
            <strong>${escapeHtml(club.name)}</strong>
          </div>
          <em>${tables.length} tables</em>
        </div>
        <div class="room-table-list">
          ${tables.map((table) => renderTableListItem(state, table)).join("")}
        </div>
      </article>

      <article class="panel-soft club-journal-panel room-journal-panel">
        <div class="section-title"><h3>Журнал</h3><span>последнее</span></div>
        <div class="feed-list club-journal-list">
          ${journal.length ? journal.slice(-6).reverse().map((line) => `<div class="feed-line journal-${escapeHtml(line.type ?? "club")}">${escapeHtml(line.text ?? line)}</div>`).join("") : emptyState("Пока пусто.")}
        </div>
      </article>
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
  const active = state.tableSession?.tableId === table.id;
  const occupied = Math.min(table.seats ?? 6, table.occupiedSeats ?? Math.max(1, (table.seats ?? 6) - 1));
  const seatsLabel = `${occupied}/${table.seats ?? 6}`;
  const buyIn = `$${table.minBuyIn}–$${table.maxBuyIn}`;
  const players = getLobbyTablePlayers(state, table).map((npc) => escapeHtml(npc.name)).join(" · ");
  const full = occupied >= (table.seats ?? 6);
  const status = active ? "Сидишь" : access.ok ? (full ? "Очередь" : "Свободно") : "Закрыт";
  const buttonLabel = active ? "Играть" : access.ok ? (full ? "Очередь" : "Buy-in") : "Закрыт";
  const statusClass = active ? "seated" : access.ok ? (full ? "waiting" : "open") : "locked";
  const canUseTable = active || (access.ok && !full);

  return `
    <article class="table-item room-table-row ${active ? "selected" : ""} ${access.ok || active ? "" : "locked"}">
      <div class="room-table-number">${escapeHtml(String(table.tableNumber ?? ""))}</div>
      <div class="room-table-main">
        <div class="room-table-title">
          <strong>${escapeHtml(table.name)}</strong>
          <span>${escapeHtml(table.gameLabel ?? `$${table.smallBlind}/$${table.bigBlind} NL Hold’em`)}</span>
        </div>
        <div class="room-table-meta">
          <span>Buy-in ${escapeHtml(buyIn)}</span>
          <span>Seats ${escapeHtml(seatsLabel)}</span>
          <span>Avg pot $${Number(table.avgPot ?? table.bigBlind * 12)}</span>
          <span>${Number(table.handsPerHour ?? 30)} hands/h</span>
        </div>
        <div class="room-table-players">${players || "Состав обновляется"}</div>
        ${access.ok || active ? "" : `<div class="room-table-lock">${escapeHtml(access.reason)}</div>`}
      </div>
      <div class="room-table-side">
        <span class="table-status ${statusClass}">${escapeHtml(status)}</span>
        <button class="small-button ${active ? "primary" : ""}" data-action="select-table" data-id="${escapeHtml(table.id)}" ${canUseTable ? "" : "disabled"}>
          ${escapeHtml(buttonLabel)}
        </button>
      </div>
    </article>
  `;
}

function getLobbyTablePlayers(state, table) {
  const rules = table.npcSelectionRules ?? {};
  const tiers = new Set(rules.tiers ?? []);
  const archetypes = new Set(rules.archetypes ?? []);
  const pool = (state.content.npcs ?? []).filter((npc) => {
    const tierOk = !tiers.size || tiers.has(npc.tier);
    const archetypeOk = !archetypes.size || archetypes.has(npc.archetypeId);
    return tierOk && archetypeOk;
  });

  const source = pool.length ? pool : state.content.npcs ?? [];
  const start = stableIndex(table.id, Math.max(1, source.length));
  return Array.from({ length: Math.min(4, source.length) }, (_, offset) => source[(start + offset) % source.length]).filter(Boolean);
}

function stableIndex(value, modulo) {
  let hash = 0;
  for (const char of String(value ?? "")) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return modulo ? hash % modulo : 0;
}

function renderBuyInModal(state) {
  const modal = state.system?.buyInModal;
  if (!modal?.tableId) return "";

  const table = state.content.byId.tables[modal.tableId];
  if (!table) return "";

  const access = canEnterTable(state.player, table);
  const bankroll = Number(state.player?.bankroll ?? 0);
  const min = Number(table.minBuyIn ?? table.bigBlind * 50);
  const max = Math.min(Number(table.maxBuyIn ?? table.bigBlind * 150), bankroll);
  const recommended = Math.max(min, Math.min(max, Number(table.recommendedBuyIn ?? table.bigBlind * 100)));
  const amount = Math.round(Number(modal.amount ?? recommended));
  const invalid = !access.ok || amount < min || amount > max;
  const seated = state.tableSession?.tableId === table.id;

  const chips = [min, recommended, max]
    .filter((value, index, arr) => Number.isFinite(value) && value > 0 && arr.indexOf(value) === index)
    .map((value) => `<button class="small-button ${value === amount ? "primary" : ""}" data-action="set-buyin" data-id="${escapeHtml(String(value))}">$${escapeHtml(String(value))}</button>`)
    .join("");

  return `
    <div class="buyin-modal-layer" role="dialog" aria-modal="true" aria-label="Buy-in">
      <article class="buyin-modal panel-soft">
        <header class="buyin-modal-head">
          <div>
            <span>Buy-in</span>
            <strong>${escapeHtml(table.name)}</strong>
            <p>${escapeHtml(table.gameLabel ?? `$${table.smallBlind}/$${table.bigBlind} NL Hold’em`)}</p>
          </div>
          <button class="drawer-close" data-action="close-buyin" aria-label="Закрыть">×</button>
        </header>

        <div class="buyin-range">
          <span>Диапазон</span>
          <strong>$${escapeHtml(String(min))}–$${escapeHtml(String(max))}</strong>
          <small>Bankroll $${escapeHtml(String(bankroll))}</small>
        </div>

        <label class="buyin-input-row">
          <span>Стек за столом</span>
          <input data-action="buy-in-input" type="number" inputmode="numeric" min="${escapeHtml(String(min))}" max="${escapeHtml(String(max))}" value="${escapeHtml(String(amount))}" />
        </label>

        <div class="buyin-chip-row">${chips}</div>
        ${access.ok ? "" : `<p class="buyin-warning">${escapeHtml(access.reason)}</p>`}
        ${seated ? `<p class="buyin-warning">Ты уже сидишь за этим столом.</p>` : ""}

        <footer class="buyin-actions">
          <button class="primary" data-action="confirm-buyin" ${invalid ? "disabled" : ""}>Сесть</button>
          <button data-action="close-buyin">Отмена</button>
        </footer>
      </article>
    </div>
  `;
}

function renderTableScreen(state) {
  const table = state.content.byId.tables[state.activeTableId];
  const hand = state.tableState;
  const animation = hand?.animation ?? {};
  const revealCount = typeof animation.revealedCommunityCount === "number" ? animation.revealedCommunityCount : hand?.communityCards?.length ?? 0;
  const visibleCommunityCards = (hand?.communityCards ?? []).slice(0, revealCount);
  const displayHand = { ...hand, communityCards: visibleCommunityCards };
  const actions = getAvailableActions(hand);
  const actionMeta = getActionMeta(hand, table);
  const handInfo = getCurrentHandInfo(displayHand);
  const resultHighlightIds = hand?.lastResult?.showdown && hand?.lastResult?.winningHand?.cardIds?.length
    ? new Set(hand.lastResult.winningHand.cardIds)
    : null;
  const highlightedIds = resultHighlightIds ?? handInfo.highlightedIds ?? new Set();
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
      <div class="game-area">
        <main class="felt-stage ${animation.isPlaying ? "is-playing" : ""} ${animation.showWinner ? "has-winner" : ""}">
          ${renderNpcSeats(hand, currentEvent, revealNpcCards, highlightedIds)}

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
          ${renderCompactHandInfo(handInfo, hand, currentEvent, actionMeta, state.settings, state, table)}
        </aside>
      </div>

      ${renderActionDock(actions, hand, actionMeta)}
      ${renderHandResultModal(state)}
    </section>
  `;
}

function renderNpcSeats(hand, currentEvent, revealCards, highlightedIds = new Set()) {
  const seats = hand?.npcSeats ?? [];
  if (!seats.length) return `<div class="empty-seat-note">Нажми «Новая раздача».</div>`;
  return seats
    .map((seat, index) => {
      const isActing = !seat.folded && (currentEvent?.actorId === seat.id || hand?.currentActorId === seat.id);
      const isWinner = isSeatWinner(hand, seat.id);
      const status = seat.folded ? "Fold" : actionLabel(seat.lastAction);
      const amount = !seat.folded && seat.lastAmount ? ` $${seat.lastAmount}` : "";
      const betText = !seat.folded && seat.currentBet ? ` · Bet $${seat.currentBet}` : "";
      const cards = seat.folded ? `<div class="fold-marker">Fold</div>` : playingCards(seat.holeCards, { hidden: !revealCards, highlightedIds, size: "small" });
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

function renderCompactHandInfo(handInfo, hand, currentEvent, actionMeta = {}, settings = {}, state = {}, table = null) {
  const result = hand?.lastResult;
  const rows = hand?.animation?.recentEvents ?? [];
  const terminal = hand?.phase === "finished" || hand?.phase === "folded";
  const current = hand?.phase === "folded" ? "Fold" : hand?.awaitingPlayer ? "Ты" : terminal ? "—" : hand?.currentActorName ?? "—";
  const tablePrompt = terminal ? "Раздача закрыта" : actionMeta.toCall ? `Call $${actionMeta.toCall}` : hand?.currentBet ? `Bet $${hand.currentBet}` : "Check available";
  const session = state?.tableSession?.tableId === table?.id ? state.tableSession : null;
  return `
    ${session ? `
      <div class="info-block table-session-block">
        <span>Стек за столом</span>
        <strong>$${escapeHtml(String(session.stack ?? 0))}</strong>
        <p>${escapeHtml(table?.gameLabel ?? "NL Hold’em")} · Buy-in $${escapeHtml(String(session.buyIn ?? 0))}</p>
        <button class="small-button ghost" data-action="leave-table">Выйти</button>
      </div>
    ` : ""}
    <div class="info-block table-hand-row">
      <div>
        <span>Ход</span>
        <strong>${escapeHtml(current)}</strong>
        <p>${escapeHtml(tablePrompt)}</p>
      </div>
      <div>
        <span>Рука</span>
        <strong>${escapeHtml(result?.winningHand?.categoryName ?? handInfo.title)}</strong>
        <p>${escapeHtml(result?.winningHand?.summary ?? handInfo.detail)}</p>
      </div>
    </div>
    ${result ? `
      <div class="info-block winner-block">
        <span>Победитель</span>
        <strong>${escapeHtml(result.winnerName ?? "—")}</strong>
        <p>${result.bankrollDelta >= 0 ? "+" : "-"}$${Math.abs(result.bankrollDelta)} · банк $${result.pot}</p>
      </div>
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



function renderHandResultModal(state) {
  const hand = state?.tableState;
  const result = hand?.lastResult;
  const open = Boolean(state?.system?.resultModalOpen && result && (hand?.phase === "finished" || hand?.phase === "folded"));
  if (!open) return "";

  const heroFolded = Boolean(hand?.heroSeat?.folded || hand?.lastPlayerAction === "fold" || hand?.phase === "folded");
  const delta = Number(result.bankrollDelta ?? 0);
  const playerLine = heroFolded
    ? `Fold · -$${Math.abs(hand?.playerInvested ?? 0)}`
    : `${delta >= 0 ? "+" : "-"}$${Math.abs(delta)}`;
  const title = result.winner === "player"
    ? "Ты забрал банк"
    : `${result.winnerName ?? "Победитель"} забрал банк`;
  const winningHand = result.winningHand?.categoryName ?? (result.showdown ? "Showdown" : "Без вскрытия");
  const board = hand?.communityCards?.length ? describeCards(hand.communityCards) : "—";
  const foldNote = heroFolded && result.showdown ? "Ты сбросил. Остальные доиграли банк." : heroFolded ? "Ты сбросил карты." : "";

  return `
    <div class="result-modal-layer" role="dialog" aria-modal="true" aria-label="Итог раздачи">
      <article class="result-modal panel-soft">
        <header class="result-modal-head">
          <div>
            <span>Итог раздачи</span>
            <strong>${escapeHtml(title)}</strong>
          </div>
          <button class="drawer-close" data-action="dismiss-result" aria-label="Закрыть">×</button>
        </header>

        <section class="result-modal-grid">
          <div><span>Банк</span><strong>$${escapeHtml(String(result.pot ?? hand?.pot ?? 0))}</strong></div>
          <div><span>Ты</span><strong>${escapeHtml(playerLine)}</strong></div>
          <div><span>Комбинация</span><strong>${escapeHtml(winningHand)}</strong></div>
          <div><span>Board</span><strong>${escapeHtml(board)}</strong></div>
        </section>

        ${foldNote ? `<p class="result-modal-note">${escapeHtml(foldNote)}</p>` : ""}
        ${renderHandClarity(hand, result, heroFolded)}
        ${renderHandTranscript(hand)}
        ${result.review ? `<div class="result-modal-review"><span>${escapeHtml(result.review.title ?? "Разбор")}</span><p>${escapeHtml(result.review.text ?? "")}</p></div>` : ""}

        <footer class="result-modal-actions">
          <button class="primary" data-action="start-hand">Новая раздача</button>
          <button data-action="dismiss-result">Закрыть</button>
        </footer>
      </article>
    </div>
  `;
}

function renderHandClarity(hand, result, heroFolded) {
  if (!result?.showdown || !result?.winningHand) {
    return `<div class="result-modal-clarity"><span>Без вскрытия</span><p>Банк забрали фолдами. Победную комбинацию не показывали.</p></div>`;
  }

  const winningCards = result.winningHand.cards ?? [];
  const highlightedIds = new Set(result.winningHand.cardIds ?? winningCards.map((card) => card.id));
  const cardsLine = winningCards.length ? playingCards(winningCards, { highlightedIds, size: "small" }) : "";
  const why = explainWinningHand(result, heroFolded);
  const summary = result.winningHand.summary ?? result.winningHand.categoryName ?? "Showdown";

  return `
    <div class="result-modal-clarity">
      <span>Победные 5 карт</span>
      ${cardsLine ? `<div class="winning-card-row">${cardsLine}</div>` : ""}
      <strong>${escapeHtml(summary)}</strong>
      <p>${escapeHtml(why)}</p>
    </div>
  `;
}

function explainWinningHand(result, heroFolded) {
  if (result.split) return "Одинаковая сила руки. Банк поделен.";
  if (heroFolded) return "Ты уже вышел из раздачи, поэтому сравнивались только оставшиеся игроки.";

  const winning = result.winningHand;
  const player = result.playerHand;
  if (player && result.winner !== "player" && player.category === winning.category) {
    return "Категория одинаковая. Решили старшие карты или кикер.";
  }
  if (player && result.winner !== "player" && player.category < winning.category) {
    return `${winning.categoryName} старше, чем ${player.categoryName}.`;
  }

  const reasons = {
    high_card: "Ни у кого не было пары. Сравнили старшие карты.",
    pair: "Одна пара старше старшей карты.",
    two_pair: "Две пары старше одной пары.",
    three_of_a_kind: "Три карты одного ранга старше двух пар.",
    straight: "Пять карт идут подряд по рангу.",
    flush: "Все пять карт одной масти.",
    full_house: "Сет и пара вместе сильнее флеша.",
    four_of_a_kind: "Четыре карты одного ранга почти всегда забирают банк.",
    straight_flush: "Пять карт подряд одной масти — сильнейшая редкая рука.",
  };
  return reasons[winning?.categoryKey] ?? "Победила самая сильная пятёрка карт.";
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
  const rankProgress = getRankProgress(player);
  const rankInfo = getRankInfo(player);
  return `
    <section class="career-hero panel-soft">
      <div>
        <div class="kicker">Профиль</div>
        <h2>${escapeHtml(getRankLabel(player.rank))}</h2>
        <p>${rankInfo.next ? `Следующий ранг: ${escapeHtml(rankInfo.next.label)}` : "В этом клубе ты уже наверху."}</p>
      </div>
      <div class="career-rank-card">
        <span>Rank progress</span>
        <strong>${rankProgress.percent}%</strong>
        ${progressBar(rankProgress.percent)}
        <small>${rankProgress.next ? escapeHtml(rankProgress.missing.length ? rankProgress.missing.join(" · ") : "готово") : "max"}</small>
      </div>
    </section>

    <section class="stats-grid career-stats-grid">
      ${metric("Bankroll", `$${player.bankroll}`)}
      ${metric("Rep", player.reputation)}
      ${metric("Poker", `Lv.${player.pokerLevel}`)}
      ${metric("Knowledge", `Lv.${player.knowledgeLevel}`)}
      ${metric("Hands", player.handsPlayed)}
      ${metric("Winrate", `${winRate(player)}%`)}
      ${metric("Showdown", player.showdownsSeen ?? 0)}
      ${metric("Folds", player.foldsMade ?? 0)}
      ${metric("Best pot", `$${player.biggestPotWon}`)}
      ${metric("Biggest seen", `$${player.biggestPotSeen ?? 0}`)}
      ${metric("Worst loss", `$${player.biggestPotLost}`)}
      ${metric("XP", player.xp)}
    </section>

    <section class="career-grid">
      <article class="panel-soft career-panel career-wide-panel">
        <div class="section-title"><h3>Столы</h3><span>доступ</span></div>
        <div class="table-unlock-list">
          ${state.content.tables.filter((table) => table.clubId === state.activeClubId).map((table) => renderTableUnlockItem(state, table)).join("")}
        </div>
      </article>
    </section>
  `;
}

function renderTasksScreen(state) {
  const player = state.player;
  const activeChallenges = getActiveChallenges(state.content, state.career);
  const completedChallenges = getCompletedChallenges(state.content, state.career);
  const completedLog = new Map((state.career?.completedChallengeLog ?? []).map((entry) => [entry.id, entry]));
  const challengeContext = { player, tableState: state.tableState, result: state.tableState?.lastResult, unlockConditions: [] };

  return `
    <section class="page-card panel-soft tasks-hero">
      <div class="kicker">Career tasks</div>
      <h2>Задания</h2>
    </section>

    <section class="tasks-board">
      <input class="task-tab-input" type="radio" name="task-tab" id="task-tab-active" checked />
      <input class="task-tab-input" type="radio" name="task-tab" id="task-tab-completed" />

      <div class="task-tab-switch panel-soft">
        <label for="task-tab-active">Активные <span>${activeChallenges.length}/6</span></label>
        <label for="task-tab-completed">Выполненные <span>${completedChallenges.length}</span></label>
      </div>

      <article class="panel-soft career-panel task-tab-panel task-panel-active">
        <div class="section-title"><h3>Активные</h3><span>${activeChallenges.length}/6</span></div>
        <div class="challenge-list active-task-list">
          ${activeChallenges.length ? activeChallenges.map((challenge) => renderChallengeItem(challenge, false, challengeContext)).join("") : emptyState("Активных заданий нет.")}
        </div>
      </article>

      <article class="panel-soft career-panel task-tab-panel task-panel-completed">
        <div class="section-title"><h3>Выполненные</h3><span>${completedChallenges.length}</span></div>
        <div class="challenge-list completed-task-list">
          ${completedChallenges.length ? completedChallenges.slice().reverse().map((challenge) => renderChallengeItem(challenge, true, challengeContext, completedLog.get(challenge.id))).join("") : emptyState("Пока пусто.")}
        </div>
      </article>
    </section>
  `;
}

function renderChallengeItem(challenge, completed, context, completedLog = null) {
  const progress = completed ? { current: 1, target: 1, completed: true } : getChallengeProgress(challenge, context);
  const percent = completed ? 100 : Math.round((progress.current / Math.max(progress.target, 1)) * 100);
  const reward = formatChallengeReward(challenge.reward ?? completedLog ?? {});
  const difficultyId = challenge.difficulty ?? completedLog?.difficulty ?? "easy";
  const difficulty = getChallengeDifficultyLabel(difficultyId);
  const category = challenge.category ?? "task";
  const progressText = completed ? "Выполнено" : `${progress.current}/${progress.target}`;
  const completedAt = completedLog?.completedAt ? formatDateShort(completedLog.completedAt) : "";

  return `
    <div class="challenge-item ${completed ? "completed" : ""} difficulty-${escapeHtml(difficultyId)}">
      <div class="challenge-copy">
        <div class="challenge-headline">
          <strong>${escapeHtml(challenge.name)}</strong>
          <em>${escapeHtml(difficulty)}</em>
        </div>
        <span>${escapeHtml(challenge.description)}</span>
        <div class="challenge-meta">
          <small>${escapeHtml(categoryLabel(category))}</small>
          ${completedAt ? `<small>${escapeHtml(completedAt)}</small>` : ""}
        </div>
      </div>
      <div class="challenge-progress">
        <em>${escapeHtml(progressText)}</em>
        ${progressBar(percent)}
        <small class="reward-pill">${escapeHtml(reward)}</small>
      </div>
    </div>
  `;
}

function categoryLabel(category) {
  const labels = {
    starter: "старт",
    winning: "победа",
    decision: "решение",
    learning: "обучение",
    pot: "банк",
    collection: "коллекция",
    volume: "объём",
    hand_made: "комбинация",
  };
  return labels[category] ?? category ?? "задание";
}

function formatDateShort(value) {
  try {
    return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit" }).format(new Date(value));
  } catch (error) {
    return "";
  }
}

function formatChallengeReward(reward = {}) {
  const parts = [];
  if (reward.xp) parts.push(`XP +${reward.xp}`);
  if (reward.reputation) parts.push(`Rep +${reward.reputation}`);
  return parts.join(" · ") || "—";
}

function renderTableUnlockItem(state, table) {
  const access = canEnterTable(state.player, table);
  const active = state.tableSession?.tableId === table.id;
  const req = table.unlockRequirement;
  const reqText = req ? [`$${req.bankroll ?? 0}`, `Rep ${req.reputation ?? 0}`].join(" · ") : "доступен сразу";
  return `
    <div class="table-unlock-item ${access.ok ? "open" : "locked"} ${active ? "active" : ""}">
      <div>
        <strong>${escapeHtml(table.name)}</strong>
        <span>$${table.smallBlind}/$${table.bigBlind} · ${escapeHtml(reqText)}</span>
      </div>
      <em>${active ? "active" : access.ok ? "open" : "locked"}</em>
    </div>
  `;
}

function renderSettingsScreen(state) {
  const system = state.system ?? {};
  const info = system.saveInfo ?? {};
  const updated = system.lastSavedAt ? formatDateTime(system.lastSavedAt) : "—";
  const online = system.online === false ? "Офлайн" : "Онлайн";
  const cache = system.controlled ? "PWA active" : system.serviceWorker ? "PWA ready" : "Browser";
  const speed = state.settings?.animationSpeed ?? "normal";

  return `
    <section class="page-card panel-soft settings-hero">
      <div class="kicker">System</div>
      <h2>Настройки</h2>
    </section>

    <section class="settings-grid">
      <article class="panel-soft settings-card">
        <div class="section-title"><h3>Игра</h3><span>темп</span></div>
        <div class="settings-line">
          <div><span>Анимации</span><strong>${escapeHtml(speedLabel(speed))}</strong></div>
          <button class="small-button" data-action="toggle-speed">Сменить</button>
        </div>
      </article>

      <article class="panel-soft settings-card settings-wide">
        <div class="section-title"><h3>Система</h3><span>v${escapeHtml(system.appVersion ?? "0.8.5")}</span></div>
        <div class="system-grid">
          <div class="system-line"><span>Сейв</span><strong>${info.exists ? `schema ${escapeHtml(String(info.schemaVersion ?? "?"))}` : "новый"}</strong></div>
          <div class="system-line"><span>Сохранено</span><strong>${escapeHtml(updated)}</strong></div>
          <div class="system-line"><span>Режим</span><strong>${escapeHtml(online)}</strong></div>
          <div class="system-line"><span>Кэш</span><strong>${escapeHtml(cache)}</strong></div>
        </div>
        <div class="system-actions settings-actions">
          <button class="small-button" data-action="export-save">Экспорт сейва</button>
          <button class="small-button" data-action="import-save">Импорт</button>
          <button class="small-button" data-action="check-update">Проверить</button>
          <button class="small-button" data-action="force-update">Принудительно обновить</button>
          <button class="small-button danger" data-action="reset-save">Сброс</button>
        </div>
      </article>
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
    <section class="hand-rank-guide panel-soft">
      <div class="section-title"><h3>Комбинации</h3><span>Texas Hold’em</span></div>
      <div class="hand-rank-grid">
        ${HAND_RANK_GUIDE.map(renderHandRankGuideItem).join("")}
      </div>
    </section>
    <section class="cards-grid">
      ${state.content.glossaryTerms.map((term) => renderGlossaryTerm(term, unlocked.has(term.id))).join("")}
    </section>
  `;
}

const HAND_RANK_GUIDE = [
  ["Старшая карта", "Нет пары. Решает самая высокая карта."],
  ["Пара", "Две карты одного ранга."],
  ["Две пары", "Две разные пары."],
  ["Сет", "Три карты одного ранга."],
  ["Стрит", "Пять карт подряд."],
  ["Флеш", "Пять карт одной масти."],
  ["Фулл-хаус", "Сет плюс пара."],
  ["Каре", "Четыре карты одного ранга."],
  ["Стрит-флеш", "Стрит одной масти."],
];

function renderHandRankGuideItem([name, text], index) {
  return `
    <div class="hand-rank-item">
      <em>${index + 1}</em>
      <strong>${escapeHtml(name)}</strong>
      <span>${escapeHtml(text)}</span>
    </div>
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

function winRate(player) {
  if (!player?.handsPlayed) return 0;
  return Math.round(((player.handsWon ?? 0) / Math.max(player.handsPlayed, 1)) * 100);
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
