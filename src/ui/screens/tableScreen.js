import { getPhaseLabel, getAvailableActions, getActionMeta, getHandHint, getCurrentHandInfo } from "../../engine/poker.js?v=0.9.8";
import { describeCards } from "../../engine/cards.js?v=0.9.8";
import { escapeHtml, playingCards } from "../components.js?v=0.9.8";
import { actionLabel, actionTitle, cleanEventText, initials, isPlayerWinner, isSeatWinner, shortName } from "./common.js?v=0.9.8";

export function renderTableScreen(state) {
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

      ${renderActionDock(actions, hand, actionMeta, state)}
      ${renderHandResultModal(state)}
    </section>
  `;
}

function renderNpcSeats(hand, currentEvent, revealCards, highlightedIds = new Set()) {
  const seats = hand?.npcSeats ?? [];
  if (!seats.length) return "";
  return seats
    .map((seat, index) => {
      const isActing = !seat.folded && (currentEvent?.actorId === seat.id || hand?.currentActorId === seat.id);
      const isWinner = isSeatWinner(hand, seat.id);
      const status = seat.folded ? "Fold" : actionLabel(seat.lastAction);
      const amount = !seat.folded && seat.lastAmount ? ` $${seat.lastAmount}` : "";
      const betText = !seat.folded && seat.currentBet ? ` · Bet $${seat.currentBet}` : "";
      const cards = seat.folded ? `<div class="fold-marker">Fold</div>` : playingCards(seat.holeCards, { hidden: !revealCards, highlightedIds, size: revealCards ? "small seat-reveal" : "small" });
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
    return "";
  }
  if (hand.awaitingPlayer) {
    return `<div class="action-bubble waiting"><span>${escapeHtml(hand.heroSeat?.position ?? "")}</span><strong>Твой ход</strong><small>${escapeHtml(getHandHint(hand))}</small></div>`;
  }
  if (hand.currentActorName) {
    return `<div class="action-bubble idle"><strong>${escapeHtml(hand.currentActorName)}</strong><small>думает</small></div>`;
  }
  return "";
}

function renderActionDock(actions, hand, actionMeta = {}, state = {}) {
  const animating = hand?.animation?.isPlaying;
  const terminal = ["finished", "folded", "idle"].includes(hand?.phase);
  const handStarted = Boolean(hand?.playerHoleCards?.length && !terminal);
  const canHeroAct = Boolean(hand?.awaitingPlayer && !animating && !terminal && hand?.heroSeat && !hand.heroSeat.folded && !hand.heroSeat.allIn);
  const canFold = canHeroAct || actions.includes("fold");
  const labels = actionMeta.labels ?? {};
  const raiseText = labels.raise ?? ((hand?.currentBet ?? 0) > 0 ? "Raise" : "Bet");

  if (!handStarted) {
    return `
      <div class="action-dock panel-soft start-only">
        <button class="start-hand-button" data-action="start-hand" ${animating ? "disabled" : ""}>Начать новую раздачу</button>
      </div>
    `;
  }

  return `
    <div class="action-dock panel-soft in-hand">
      <button data-action="player-action" data-id="fold" ${canFold ? "" : "disabled"}>${escapeHtml(labels.fold ?? "Fold")}</button>
      <button data-action="player-action" data-id="check" ${actions.includes("check") ? "" : "disabled"}>${escapeHtml(labels.check ?? "Check")}</button>
      <button data-action="player-action" data-id="call" ${actions.includes("call") ? "" : "disabled"}>${escapeHtml(labels.call ?? "Call")}</button>
      <button class="primary" data-action="player-action" data-id="raise" ${actions.includes("raise") ? "" : "disabled"}>${escapeHtml(raiseText)}</button>
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
    ${session ? `
      <button class="small-button table-leave-bottom" data-action="leave-table">Выйти из стола</button>
    ` : ""}
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

