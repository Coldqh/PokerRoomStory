import { getActionMeta, getAvailableActions } from "../engine/poker.js?v=1.0.1";

export const bettingModalFlow = {
  getBetAmountBounds() {
    const table = this.content.byId.tables[this.state.activeTableId];
    const hand = this.state.tableState;
    const hero = hand?.heroSeat;
    const actions = getAvailableActions(hand);
    const meta = getActionMeta(hand, table);

    if (!table || !hero || !actions.includes("raise")) {
      return { ok: false, min: 0, max: 0, amount: 0, meta };
    }

    const min = Number(meta.betOptions?.[0]?.target ?? meta.raiseTarget ?? 0);
    const max = Math.max(min, Math.round(Number(hero.currentBet ?? 0) + Number(hero.stack ?? 0)));
    const fallback = Number(this.state.system?.selectedBetTarget ?? meta.raiseTarget ?? min);
    const amount = this.clampBetAmount(fallback, min, max);
    return { ok: true, min, max, amount, meta };
  },

  clampBetAmount(value, min, max) {
    const amount = Math.round(Number(value));
    if (!Number.isFinite(amount)) return min;
    return Math.max(min, Math.min(max, amount));
  },

  openBetAmountModal() {
    const bounds = this.getBetAmountBounds();
    if (!bounds.ok) return;
    this.setSystem({
      betAmountModal: {
        amount: bounds.amount,
        min: bounds.min,
        max: bounds.max,
      },
    });
  },

  setBetAmount(value) {
    const modal = this.state.system?.betAmountModal;
    const bounds = this.getBetAmountBounds();
    if (!modal || !bounds.ok) return;
    this.setSystem({
      betAmountModal: {
        ...modal,
        min: bounds.min,
        max: bounds.max,
        amount: this.clampBetAmount(value, bounds.min, bounds.max),
      },
    });
  },

  confirmBetRaise() {
    const bounds = this.getBetAmountBounds();
    if (!bounds.ok) {
      this.setSystem({ betAmountModal: null });
      return;
    }

    const inputValue = this.root.querySelector('[data-action="raise-amount-input"]')?.value;
    const requested = inputValue !== undefined && inputValue !== ""
      ? Number(inputValue)
      : this.state.system?.betAmountModal?.amount ?? this.state.system?.selectedBetTarget ?? bounds.amount;
    const amount = this.clampBetAmount(requested, bounds.min, bounds.max);
    this.setSystem({ betAmountModal: null, selectedBetTarget: amount });
    this.playAction("raise", amount);
  }
};
