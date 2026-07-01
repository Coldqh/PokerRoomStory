import { createInitialTableState } from "../engine/poker.js?v=1.0.1";

export const tableSessionFlow = {
  openBuyInModal(tableId) {
    const table = this.content.byId.tables[tableId];
    if (!table) return;

    if (isTableHandInProgress(this.state.tableState)) {
      this.setSystem({ notice: "Сначала заверши текущую раздачу." });
      return;
    }

    const amount = getRecommendedBuyIn(this.state.player, table);
    this.setSystem({
      buyInModal: {
        tableId,
        amount,
      },
    });
  },

  setBuyInAmount(amount) {
    const modal = this.state.system?.buyInModal;
    if (!modal) return;
    const table = this.content.byId.tables[modal.tableId];
    if (!table) return;

    const cleanAmount = clampMoney(Math.round(Number(amount) || table.minBuyIn));
    this.setSystem({
      buyInModal: {
        ...modal,
        amount: cleanAmount,
      },
    });
  },

  confirmBuyIn() {
    const modal = this.state.system?.buyInModal;
    if (!modal) return;

    const table = this.content.byId.tables[modal.tableId];
    if (!table) return;

    const amount = clampMoney(Math.round(Number(modal.amount) || table.minBuyIn));
    const min = Number(table.minBuyIn ?? table.bigBlind * 50);
    const max = Math.min(Number(table.maxBuyIn ?? table.bigBlind * 150), Number(this.state.player.bankroll ?? 0));

    if (amount < min || amount > max) {
      this.setSystem({ notice: `Buy-in должен быть от $${min} до $${max}.` });
      return;
    }

    this.setState({
      activeTableId: table.id,
      currentScreen: "table",
      tableSession: {
        tableId: table.id,
        buyIn: amount,
        stack: amount,
        handsPlayed: 0,
        seatedAt: Date.now(),
      },
      tableState: createInitialTableState(),
      system: {
        ...this.state.system,
        buyInModal: null,
        resultModalOpen: false,
        selectedBetTarget: null,
        betAmountModal: null,
      },
    });
  },

  leaveTable() {
    if (isTableHandInProgress(this.state.tableState)) {
      this.setSystem({ notice: "Сначала заверши текущую раздачу." });
      return;
    }

    const table = this.content.byId.tables[this.state.tableSession?.tableId ?? this.state.activeTableId];
    this.setState({
      tableSession: null,
      tableState: createInitialTableState(),
      currentScreen: "club",
      system: {
        ...this.state.system,
        resultModalOpen: false,
        betAmountModal: null,
        notice: table ? `Ты вышел из ${table.name}.` : "Ты вышел из-за стола.",
      },
    });
  }
};

function getRecommendedBuyIn(player, table) {
  const bankroll = Number(player?.bankroll ?? 0);
  const min = Number(table?.minBuyIn ?? table?.bigBlind * 50 ?? 0);
  const max = Math.min(Number(table?.maxBuyIn ?? table?.bigBlind * 150 ?? min), bankroll);
  const target = Number(table?.recommendedBuyIn ?? table?.bigBlind * 100 ?? min);
  return clampMoney(Math.max(min, Math.min(max, target)));
}

function isTableHandInProgress(tableState) {
  if (!tableState) return false;
  return !["idle", "finished", "folded"].includes(tableState.phase ?? "idle") || Boolean(tableState.animation?.isPlaying);
}

function clampMoney(value) {
  return Math.max(0, Math.round(Number(value) || 0));
}
