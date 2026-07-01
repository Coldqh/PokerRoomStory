import { clearSave, importSaveText } from "../engine/save.js?v=1.3.0";
import { applyPendingUpdate, checkForRemoteVersion, forceAppUpdate } from "../engine/update.js?v=1.3.0";

export const inputController = {
  handleClick(event) {
    const target = event.target.closest("[data-action]");
    if (!target) return;

    const action = target.dataset.action;
    const id = target.dataset.id;

    if (action === "open-menu") {
      this.menuOpen = true;
      this.render();
      return;
    }

    if (action === "close-menu") {
      this.menuOpen = false;
      this.render();
      return;
    }

    if (action === "screen") {
      this.menuOpen = false;
      this.setState({ currentScreen: this.resolveScreen(id) });
      return;
    }

    const animationSafeActions = [
      "apply-update",
      "force-update",
      "check-update",
      "export-save",
      "import-save",
      "dismiss-notice",
      "dismiss-reward",
      "reset-save",
      "set-buyin",
      "confirm-buyin",
      "close-buyin",
      "open-opponent-read",
      "close-opponent-read",
    ];
    if (this.state.tableState?.animation?.isPlaying && !animationSafeActions.includes(action)) return;

    if (action === "select-table") {
      this.menuOpen = false;
      if (this.state.tableSession?.tableId === id) {
        this.setState({ activeTableId: id, currentScreen: "table" });
      } else {
        this.openBuyInModal(id);
      }
      return;
    }

    if (action === "set-buyin") {
      this.setBuyInAmount(Number(id));
      return;
    }

    if (action === "confirm-buyin") {
      this.confirmBuyIn();
      return;
    }

    if (action === "close-buyin") {
      this.setSystem({ buyInModal: null });
      return;
    }

    if (action === "leave-table") {
      this.leaveTable();
      return;
    }

    if (action === "open-opponent-read") {
      if (!id) return;
      this.setSystem({ opponentReadSeatId: id });
      return;
    }

    if (action === "close-opponent-read") {
      this.setSystem({ opponentReadSeatId: null });
      return;
    }

    if (action === "start-hand") {
      this.startHand();
      return;
    }

    if (action === "player-action") {
      if (id === "raise") {
        this.openBetAmountModal();
        return;
      }
      this.playAction(id);
      return;
    }

    if (action === "close-bet-modal") {
      this.setSystem({ betAmountModal: null });
      return;
    }

    if (action === "confirm-bet-raise") {
      this.confirmBetRaise();
      return;
    }

    if (action === "toggle-speed") {
      this.toggleAnimationSpeed();
      return;
    }

    if (action === "apply-update") {
      this.setSystem({ notice: "Обновляю приложение..." });
      applyPendingUpdate().then((result) => {
        if (!result.ok) this.setSystem({ notice: "Готового обновления нет. Используй принудительное обновление." });
      });
      return;
    }

    if (action === "force-update") {
      this.setSystem({ notice: "Чищу кэш и запрашиваю свежую версию..." });
      forceAppUpdate();
      return;
    }

    if (action === "check-update") {
      this.setSystem({ notice: "Проверяю обновления..." });
      checkForRemoteVersion().then((result) => {
        if (result?.updateAvailable) return;
        this.setSystem({ notice: result?.ok ? "Установлена свежая версия." : "Не удалось проверить. Офлайн или кэш." });
      });
      return;
    }

    if (action === "export-save") {
      this.exportSave();
      return;
    }

    if (action === "import-save") {
      this.root.querySelector("#save-import-input")?.click();
      return;
    }

    if (action === "dismiss-notice") {
      this.setSystem({ notice: null, updateAvailable: false, updateMessage: null });
      return;
    }

    if (action === "dismiss-reward") {
      this.setSystem({ rewardToast: null });
      return;
    }

    if (action === "dismiss-result") {
      this.setSystem({ resultModalOpen: false });
      return;
    }

    if (action === "reset-save") {
      const confirmed = confirm("Сбросить прогресс? Backup тоже будет удалён.");
      if (!confirmed) return;
      clearSave();
      this.state = this.createInitialState();
      this.render();
    }
  },

  handleChange(event) {
    const input = event.target;
    if (input.matches?.('[data-action="buy-in-input"]')) {
      this.setBuyInAmount(Number(input.value));
      return;
    }

    if (input.matches?.('[data-action="raise-amount-input"]')) {
      this.setBetAmount(Number(input.value));
      return;
    }

    if (!input.matches?.("#save-import-input")) return;
    const file = input.files?.[0];
    if (!file) return;

    file
      .text()
      .then((text) => {
        importSaveText(text, this.content);
        this.state = this.createInitialState();
        this.setSystem({ notice: "Сейв импортирован." });
      })
      .catch(() => this.setSystem({ notice: "Не удалось импортировать сейв." }))
      .finally(() => {
        input.value = "";
      });
  }
};
