import { canEnterTable } from "../../engine/world.js?v=0.9.6";
import { getActionMeta } from "../../engine/poker.js?v=0.9.6";
import { escapeHtml } from "../components.js?v=0.9.6";

export function renderBuyInModal(state) {
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

export function renderBetAmountModal(state) {
  const modal = state.system?.betAmountModal;
  if (!modal) return "";

  const table = state.content.byId.tables[state.activeTableId];
  const hand = state.tableState;
  const hero = hand?.heroSeat;
  if (!table || !hero) return "";

  const actionMeta = getActionMeta(hand, table);
  const min = Math.max(0, Number(modal.min ?? actionMeta.betOptions?.[0]?.target ?? actionMeta.raiseTarget ?? 0));
  const max = Math.max(min, Math.round(Number(hero.currentBet ?? 0) + Number(hero.stack ?? 0)));
  const rawAmount = Math.round(Number(modal.amount ?? state.system?.selectedBetTarget ?? actionMeta.raiseTarget ?? min));
  const amount = Math.max(min, Math.min(max, Number.isFinite(rawAmount) ? rawAmount : min));
  const toCall = Number(actionMeta.toCall ?? 0);
  const cost = Math.max(0, amount - Number(hero.currentBet ?? 0));
  const actionTitle = (hand?.currentBet ?? 0) > 0 ? "Raise" : "Bet";
  const sessionStack = state.tableSession?.stack ?? hero.stack ?? 0;
  const bankroll = Number(state.player?.bankroll ?? 0);
  const invalid = amount < min || amount > max || cost <= 0;

  return `
    <div class="bet-modal-layer" role="dialog" aria-modal="true" aria-label="Размер ставки">
      <article class="bet-modal panel-soft">
        <header class="bet-modal-head">
          <div>
            <span>${escapeHtml(actionTitle)}</span>
            <strong>Размер ставки</strong>
            <p>${escapeHtml(table.gameLabel ?? "NL Hold’em")}</p>
          </div>
          <button class="drawer-close" data-action="close-bet-modal" aria-label="Закрыть">×</button>
        </header>

        <div class="bet-modal-limits">
          <div><span>Min</span><strong>$${escapeHtml(String(min))}</strong></div>
          <div><span>Max</span><strong>$${escapeHtml(String(max))}</strong></div>
          <div><span>Stack</span><strong>$${escapeHtml(String(sessionStack))}</strong></div>
          <div><span>Bankroll</span><strong>$${escapeHtml(String(bankroll))}</strong></div>
        </div>

        <label class="bet-modal-input-row">
          <span>Итоговая ставка</span>
          <input data-action="raise-amount-input" type="number" inputmode="numeric" min="${escapeHtml(String(min))}" max="${escapeHtml(String(max))}" value="${escapeHtml(String(amount))}" />
        </label>

        <p class="bet-modal-hint">Call: $${escapeHtml(String(toCall))}. Списать сейчас: $${escapeHtml(String(cost))}. Можно любое число в пределах min/max.</p>

        <footer class="bet-modal-actions">
          <button class="primary" data-action="confirm-bet-raise" ${invalid ? "disabled" : ""}>${escapeHtml(actionTitle)} $${escapeHtml(String(amount))}</button>
          <button data-action="close-bet-modal">Отмена</button>
        </footer>
      </article>
    </div>
  `;
}

