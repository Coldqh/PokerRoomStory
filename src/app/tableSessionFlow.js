import { createInitialTableState } from "../engine/poker.js?v=1.5.0";
import { canEnterTable } from "../engine/world.js?v=1.5.0";

export const tableSessionFlow = {
  openBuyInModal(tableId) {
    const table = this.content.byId.tables[tableId];
    if (!table) return;

    if (isTableHandInProgress(this.state.tableState)) {
      this.setSystem({ notice: "Сначала заверши текущую раздачу." });
      return;
    }

    const access = canEnterTable(this.state.player, table);
    if (!access.ok) {
      this.setSystem({ notice: access.reason });
      return;
    }

    const amount = getRecommendedBuyIn(this.state.player, table);
    this.setSystem({
      notice: null,
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

    const access = canEnterTable(this.state.player, table);
    if (!access.ok) {
      this.setSystem({ notice: access.reason });
      return;
    }

    const amount = clampMoney(Math.round(Number(modal.amount) || table.minBuyIn));
    const min = Number(table.minBuyIn ?? table.bigBlind * 50);
    const max = Math.min(Number(table.maxBuyIn ?? table.bigBlind * 150), Number(this.state.player.bankroll ?? 0));

    if (amount < min || amount > max) {
      this.setSystem({ notice: `Buy-in должен быть от $${min} до $${max}.` });
      return;
    }

    const bankroll = clampMoney(this.state.player?.bankroll ?? 0);

    this.setState({
      player: {
        ...this.state.player,
        bankroll: bankroll - amount,
      },
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
        notice: null,
      },
    });
  },

  topUpTableStack() {
    const session = this.state.tableSession;
    const table = this.content.byId.tables[session?.tableId ?? this.state.activeTableId];
    if (!session || !table) return;

    if (isTableHandInProgress(this.state.tableState)) {
      this.setSystem({ notice: "Сначала заверши текущую раздачу." });
      return;
    }

    const currentStack = clampMoney(session.stack ?? 0);
    const bankroll = clampMoney(this.state.player?.bankroll ?? 0);

    if (bankroll <= 0) {
      this.setSystem({ notice: "Недостаточно банкролла для добора." });
      return;
    }

    const target = getTopUpTarget({ table, currentStack });
    const needed = clampMoney(target - currentStack);
    const amount = Math.min(needed, bankroll);

    if (needed <= 0) {
      this.setSystem({ notice: "Стек уже добран." });
      return;
    }

    this.setState({
      player: {
        ...this.state.player,
        bankroll: bankroll - amount,
      },
      tableSession: {
        ...session,
        buyIn: clampMoney((session.buyIn ?? 0) + amount),
        stack: currentStack + amount,
      },
      system: {
        ...this.state.system,
        notice: null,
      },
    });
  },

  leaveTable() {
    if (isTableHandInProgress(this.state.tableState)) {
      this.setSystem({ notice: "Сначала заверши текущую раздачу." });
      return;
    }

    const returnedStack = clampMoney(this.state.tableSession?.stack ?? 0);
    const bankroll = clampMoney(this.state.player?.bankroll ?? 0);

    this.setState({
      player: {
        ...this.state.player,
        bankroll: bankroll + returnedStack,
      },
      tableSession: null,
      tableState: createInitialTableState(),
      currentScreen: "club",
      system: {
        ...this.state.system,
        resultModalOpen: false,
        betAmountModal: null,
        notice: null,
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

function getTopUpTarget({ table, currentStack }) {
  const min = Number(table?.minBuyIn ?? table?.bigBlind * 50 ?? 0);
  const max = Number(table?.maxBuyIn ?? table?.bigBlind * 150 ?? min);
  const recommended = Number(table?.recommendedBuyIn ?? table?.bigBlind * 100 ?? min);
  const target = Math.min(max, Math.max(min, recommended));
  return clampMoney(Math.max(currentStack, target));
}

function isTableHandInProgress(tableState) {
  if (!tableState) return false;
  return !["idle", "finished", "folded"].includes(tableState.phase ?? "idle") || Boolean(tableState.animation?.isPlaying);
}

function clampMoney(value) {
  return Math.max(0, Math.round(Number(value) || 0));
}
