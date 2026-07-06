import { getPhaseLabel, getAvailableActions, getActionMeta, getHandHint, getCurrentHandInfo } from "../../engine/poker.js?v=2.7.4";
import { describeCards } from "../../engine/cards.js?v=2.7.4";
import { getClubLevelInfo } from "../../engine/progression.js?v=2.7.4";
import { escapeHtml, playingCards } from "../components.js?v=2.7.4";
import { actionLabel, actionTitle, cleanEventText, initials, isPlayerWinner, isSeatWinner, shortName } from "./common.js?v=2.7.4";

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
      ${renderOpponentReadModal(state, hand)}
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
        <div class="seat opponent-seat seat-${index + 1} ${seat.folded ? "folded" : ""} ${isActing ? "acting" : ""} ${isWinner ? "winner" : ""}" data-action="open-opponent-read" data-id="${escapeHtml(seat.id)}" role="button" aria-label="Профиль игрока ${escapeHtml(seat.name)}" title="Профиль игрока">
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

function getTableTopUpTarget(state = {}, table = null, session = null) {
  if (!table || !session) return 0;
  const bankroll = Number(state.player?.bankroll ?? 0);
  const min = Number(table.minBuyIn ?? table.bigBlind * 50 ?? 0);
  const max = Math.min(Number(table.maxBuyIn ?? table.bigBlind * 150 ?? min), Number(session.stack ?? 0) + bankroll);
  const target = Number(table.recommendedBuyIn ?? table.bigBlind * 100 ?? min);
  return Math.max(Number(session.stack ?? 0), Math.min(max, target));
}

function renderActionDock(actions, hand, actionMeta = {}, state = {}) {
  const animating = hand?.animation?.isPlaying;
  const terminal = ["finished", "folded", "idle"].includes(hand?.phase);
  const handStarted = Boolean(hand?.playerHoleCards?.length && !terminal);
  const canHeroAct = Boolean(hand?.awaitingPlayer && !animating && !terminal && hand?.heroSeat && !hand.heroSeat.folded && !hand.heroSeat.allIn);
  const canFold = canHeroAct || actions.includes("fold");
  const labels = actionMeta.labels ?? {};
  const raiseText = labels.raise ?? ((hand?.currentBet ?? 0) > 0 ? "Raise" : "Bet");
  const table = state?.content?.byId?.tables?.[state?.activeTableId];
  const session = state?.tableSession?.tableId === table?.id ? state.tableSession : null;
  const lowStack = Boolean(session && table && Number(session.stack ?? 0) < Number(table.bigBlind ?? 0));
  const waitingForNextHand = Boolean(session?.waitingForNextHand || hand?.observedHand || hand?.waitingHero || hand?.heroSeat?.waitingForNextHand);
  const startLabel = waitingForNextHand ? "Дождаться следующей раздачи" : "Начать новую раздачу";

  if (!handStarted) {
    return `
      <div class="action-dock panel-soft start-only">
        ${waitingForNextHand ? `<div class="table-stack-warning"><strong>Ты ждёшь следующей раздачи.</strong><span>Текущая рука уже идёт. Войдёшь со следующей.</span></div>` : ""}
        ${lowStack ? `<div class="table-stack-warning"><strong>Недостаточно стека.</strong><span>Добери фишки или выйди из стола.</span></div>` : ""}
        <button class="start-hand-button" data-action="start-hand" ${animating || lowStack ? "disabled" : ""}>${escapeHtml(startLabel)}</button>
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
  const targetBuyIn = getTableTopUpTarget(state, table, session);
  const canTopUp = Boolean(session && targetBuyIn > Number(session.stack ?? 0));
  const lowStack = Boolean(session && table && Number(session.stack ?? 0) < Number(table.bigBlind ?? 0));
  const waitingForNextHand = Boolean(session?.waitingForNextHand || hand?.observedHand || hand?.waitingHero || hand?.heroSeat?.waitingForNextHand);
  return `
    ${session ? `
      <div class="info-block table-session-block">
        <span>Стек за столом</span>
        <strong>$${escapeHtml(String(session.stack ?? 0))}</strong>
        <p>${escapeHtml(table?.gameLabel ?? "NL Hold’em")} · Buy-in $${escapeHtml(String(session.buyIn ?? 0))}</p>
        ${waitingForNextHand ? `<p>Ожидание следующей раздачи.</p>` : ""}
        ${lowStack ? `<p>Недостаточно стека. Добери фишки или выйди из стола.</p>` : ""}
        ${canTopUp ? `<button class="small-button" data-action="top-up-table-stack">Добрать стек</button>` : ""}
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
  const clubInfo = getClubLevelInfo(state.content, state.career, state.activeClubId);
  const clubGain = clubInfo.lastGain?.xp ?? 0;

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
        ${renderClubProgressResult(clubInfo, clubGain)}
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
  const cardsText = winningCards.length ? describeCards(winningCards) : "";
  const why = explainWinningHand(result, heroFolded);
  const summary = result.winningHand.summary ?? result.winningHand.categoryName ?? "Showdown";

  return `
    <div class="result-modal-clarity">
      <span>Победные 5 карт</span>
      ${cardsLine ? `<div class="winning-card-row">${cardsLine}</div>` : ""}
      ${cardsText ? `<p class="winning-card-text">${escapeHtml(cardsText)}</p>` : ""}
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
  const reason = event.reason ? ` · ${event.reason}` : "";
  return `${name} ${action}${amount}${reason}`;
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

function renderClubProgressResult(info, gain = 0, reward = null) {
  if (!info?.club || !gain) return "";
  const levelLine = info.nextLevel ? `${info.xp} / ${info.nextXp} XP` : `${info.xp} XP`;
  const rewardLine = reward ? ` · ${reward}` : "";
  return `
    <div class="result-club-progress">
      <span>Club XP +${escapeHtml(String(gain))}</span>
      <strong>${escapeHtml(info.club.name)} Lv.${escapeHtml(String(info.level))}</strong>
      <p>${escapeHtml(levelLine + rewardLine)}</p>
    </div>
  `;
}


function renderOpponentReadModal(state, hand) {
  const seatId = state?.system?.opponentReadSeatId;
  if (!seatId) return "";

  const seat = (hand?.npcSeats ?? []).find((entry) => entry.id === seatId);
  if (!seat) return "";

  const read = buildOpponentRead(seat);
  const lastAction = formatOpponentLastAction(seat);
  const stats = normalizeReadStats(seat.npc?.stats);

  return `
    <div class="opponent-read-layer" role="dialog" aria-modal="true" aria-label="Профиль игрока">
      <article class="opponent-read-card panel-soft">
        <header class="opponent-read-head">
          <div>
            <span>Opponent Read</span>
            <strong>${escapeHtml(seat.name ?? "Игрок")}</strong>
            <p>${escapeHtml(read.archetype)}</p>
          </div>
          <button class="drawer-close" data-action="close-opponent-read" aria-label="Закрыть">×</button>
        </header>

        <section class="opponent-read-snapshot">
          <div><span>Позиция</span><strong>${escapeHtml(seat.position ?? "—")}</strong></div>
          <div><span>Стек</span><strong>$${escapeHtml(String(seat.stack ?? 0))}</strong></div>
          <div><span>Настрой</span><strong>${escapeHtml(read.mood)}</strong></div>
          <div><span>Последнее</span><strong>${escapeHtml(lastAction)}</strong></div>
        </section>

        <section class="opponent-read-tags">
          ${read.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}
        </section>

        <section class="opponent-read-meters">
          ${renderReadMeter("Вход в банк", stats.vpip, readLevel(stats.vpip, "vpip"))}
          ${renderReadMeter("Рейзы", stats.pfr, readLevel(stats.pfr, "pfr"))}
          ${renderReadMeter("Агрессия", stats.aggression, readLevel(stats.aggression, "aggression"))}
          ${renderReadMeter("Дисциплина", stats.discipline, readLevel(stats.discipline, "discipline"))}
        </section>

        <section class="opponent-read-lines">
          <span>Что видно за столом</span>
          <ul>
            ${read.tendencies.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}
          </ul>
        </section>

        <footer class="opponent-read-advice">
          <span>План</span>
          <strong>${escapeHtml(read.advice)}</strong>
        </footer>
      </article>
    </div>
  `;
}

function buildOpponentRead(seat) {
  const npc = seat?.npc ?? {};
  const archetypeId = npc.archetypeId ?? "";
  const archetype = npc.archetype?.name ?? getArchetypeFallbackName(archetypeId);
  const mood = getMoodLabel(seat?.mood);

  const reads = {
    ARCH_TIGHT_NIT: {
      tags: ["тайтовый", "бережёт стек", "давит редко"],
      tendencies: ["Часто выкидывает слабые руки.", "Не любит дорогие коллы без готовой силы.", "Его рейз обычно значит сильный диапазон."],
      advice: "Воруй малые банки, но уважай крупный рейз.",
    },
    ARCH_LOOSE_CALLER: {
      tags: ["лузовый", "любит флоп", "часто платит"],
      tendencies: ["Широко заходит в раздачи.", "Дешёвые ставки коллит чаще нормы.", "Может дотянуть слабую пару до шоудауна."],
      advice: "Ставь на вэлью чаще, меньше пустых блефов.",
    },
    ARCH_CALLING_STATION: {
      tags: ["телефон", "липкий", "showdown"],
      tendencies: ["Плохо отпускает руку после флопа.", "Любит проверить, чем всё закончится.", "Редко сам разгоняет банк без причины."],
      advice: "Не блефуй в воздух. Забирай деньги готовыми руками.",
    },
    ARCH_TOURIST_GAMBLER: {
      tags: ["турист", "хаос", "широкий диапазон"],
      tendencies: ["Может сыграть странный колл.", "Переоценивает красивые руки.", "На короткой дистанции непредсказуем."],
      advice: "Играй проще. Наказывай ошибки крупными вэлью-ставками.",
    },
    ARCH_AGGRESSIVE_REG: {
      tags: ["агрессор", "давление", "рейзы"],
      tendencies: ["Часто атакует слабость.", "Может ставить вторым темпом.", "Не даёт бесплатно смотреть улицы."],
      advice: "Не колли мусор. Лови его с сильной рукой.",
    },
    ARCH_MATH_GRINDER: {
      tags: ["математик", "аккуратный", "по шансам"],
      tendencies: ["Смотрит на цену банка.", "Редко платит совсем без причины.", "Хорошо выбирает дешёвые продолжения."],
      advice: "Давай плохую цену дро и не раздавай бесплатные карты.",
    },
    ARCH_BANKROLL_BULLY: {
      tags: ["давит стеком", "дорогие решения", "банкролл"],
      tendencies: ["Любит ставить так, чтобы решение было неприятным.", "Охотно разгоняет банк против пассивных.", "Может переигрывать давление."],
      advice: "Выбирай крепкие руки и не защищай всё подряд.",
    },
    ARCH_OLD_SCHOOL_REG: {
      tags: ["старый рег", "ровный", "без суеты"],
      tendencies: ["Играет спокойно и прямолинейно.", "Не любит лишний риск.", "Сильные линии часто честные."],
      advice: "Забирай маленькие банки, но не спорь с явной силой.",
    },
  };

  const profile = reads[archetypeId] ?? {
    tags: ["неизвестный стиль", "наблюдай", "адаптируйся"],
    tendencies: ["Данных мало.", "Смотри на частоту коллов и рейзов.", "Первые руки лучше играть осторожно."],
    advice: "Собери информацию до крупных решений.",
  };

  return { archetype, mood, ...profile };
}

function renderReadMeter(label, value, text) {
  const width = clampPercent(value);
  return `
    <div class="opponent-read-meter">
      <div><span>${escapeHtml(label)}</span><strong>${escapeHtml(text)}</strong></div>
      <i><b style="width:${width}%"></b></i>
    </div>
  `;
}

function normalizeReadStats(stats = {}) {
  return {
    vpip: statToPercent(stats.vpip ?? 35),
    pfr: statToPercent(stats.pfr ?? 14),
    aggression: statToPercent(stats.aggression ?? 40),
    discipline: statToPercent(stats.discipline ?? 50),
  };
}

function readLevel(value, type) {
  const v = clampPercent(value);
  if (type === "vpip") return v >= 55 ? "часто" : v >= 34 ? "средне" : "редко";
  if (type === "pfr") return v >= 28 ? "много" : v >= 14 ? "умеренно" : "мало";
  if (type === "aggression") return v >= 60 ? "высокая" : v >= 38 ? "средняя" : "низкая";
  if (type === "discipline") return v >= 60 ? "строгая" : v >= 38 ? "средняя" : "слабая";
  return v >= 60 ? "высоко" : v >= 38 ? "средне" : "низко";
}

function statToPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return clampPercent(number <= 1 ? number * 100 : number);
}

function clampPercent(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

function formatOpponentLastAction(seat) {
  const action = actionLabel(seat?.lastAction ?? "ready");
  const amount = seat?.lastAmount ? ` $${seat.lastAmount}` : "";
  return `${action}${amount}`;
}

function getMoodLabel(mood = "calm") {
  const labels = {
    calm: "ровный",
    hot: "разогрет",
    tilted: "тильт",
    locked: "закрыт",
    pressure: "под давлением",
  };
  return labels[mood] ?? "ровный";
}

function getArchetypeFallbackName(archetypeId = "") {
  const labels = {
    ARCH_TIGHT_NIT: "Tight Nit",
    ARCH_LOOSE_CALLER: "Loose Caller",
    ARCH_CALLING_STATION: "Calling Station",
    ARCH_TOURIST_GAMBLER: "Tourist Gambler",
    ARCH_AGGRESSIVE_REG: "Aggressive Reg",
    ARCH_MATH_GRINDER: "Math Grinder",
    ARCH_BANKROLL_BULLY: "Bankroll Bully",
    ARCH_OLD_SCHOOL_REG: "Old School Reg",
  };
  return labels[archetypeId] ?? "Unknown Player";
}
