import { clearSave, importSaveText } from "../engine/save.js?v=2.8.0";
import { applyLifeAction, spendLifeActionCost } from "../engine/life.js?v=2.8.0";
import { applyVenueAction, canEnterVenue, getVenueById } from "../engine/venues.js?v=2.8.0";
import { normalizePlayer } from "../engine/career.js?v=2.8.0";
import { getClubTables } from "../engine/selectors.js?v=2.8.0";
import { canEnterClub } from "../engine/world.js?v=2.8.0";
import { applyPendingUpdate, checkForRemoteVersion, forceAppUpdate } from "../engine/update.js?v=2.8.0";
import { createCityLocation, createClubLocation, createHomeLocation, createTableLocation, createVenueLocation } from "../engine/locationState.js?v=2.8.0";

export const inputController = {
  handleClick(event) {
    const target = event.target.closest("[data-action]");
    if (!target) {
      if (isModalBackdrop(event.target)) this.closeOpenWindows();
      return;
    }

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
      if (this.state.tableSession?.tableId && ["locations", "venue", "club"].includes(id)) {
        this.setSystem({ notice: "Сначала встань из-за стола." });
        return;
      }
      this.menuOpen = false;
      const locationPatch = getScreenLocationPatch(this.state, this.content, id);
      this.setState({
        ...locationPatch,
        currentScreen: this.resolveScreen(id),
        system: {
          ...this.state.system,
          tablePickerOpen: false,
          clubPickerOpen: false,
        },
      });
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
      "dismiss-session-summary",
      "reset-save",
      "set-buyin",
      "confirm-buyin",
      "close-buyin",
      "open-opponent-read",
      "close-opponent-read",
      "top-up-table-stack",
      "select-club",
      "open-club-picker",
      "open-table-picker",
      "close-modal",
      "life-action",
      "select-venue",
      "venue-action",
      "go-home",
      "go-city",
    ];
    if (this.state.tableState?.animation?.isPlaying && !animationSafeActions.includes(action)) return;

    if (isLocationLockedAtTable(this.state, action, id)) {
      this.setSystem({ notice: "Сначала встань из-за стола." });
      return;
    }

    if (action === "select-venue") {
      const venue = getVenueById(this.content, id);
      const access = canEnterVenue(this.state.player, this.state.career, venue, this.content);
      if (!venue) return;
      if (!access.ok) {
        this.setSystem({ notice: access.reason });
        return;
      }
      const visited = new Set(this.state.career?.city?.visitedVenueIds ?? []);
      visited.add(venue.id);
      const travel = spendLocationAction(this.state, `Переход: ${venue.name}.`);
      this.setState({
        activeVenueId: venue.id,
        player: normalizePlayer(travel.player),
        playerLocation: venue.type === "home" ? createHomeLocation(this.content) : createVenueLocation(this.content, venue.id),
        currentScreen: "location",
        career: {
          ...travel.career,
          city: {
            ...(travel.career?.city ?? {}),
            activeVenueId: venue.id,
            visitedVenueIds: [...visited],
          },
        },
        system: {
          ...this.state.system,
          notice: travel.message || null,
          tablePickerOpen: false,
          clubPickerOpen: false,
        },
      });
      return;
    }

    if (action === "venue-action") {
      const result = applyVenueAction({
        content: this.content,
        venueId: getActionVenueId(this.state),
        actionId: id,
        career: this.state.career,
        player: this.state.player,
      });
      if (!result.ok) {
        this.setSystem({ notice: result.message });
        return;
      }
      this.setState({
        career: result.career,
        player: normalizePlayer(result.player),
        currentScreen: result.nextScreen ? this.resolveScreen(result.nextScreen) : "location",
        log: [...(this.state.log ?? []), result.message].slice(-100),
        system: {
          ...this.state.system,
          notice: result.message,
          tablePickerOpen: false,
          clubPickerOpen: false,
        },
      });
      return;
    }

    if (action === "life-action") {
      const result = applyLifeAction({ actionId: id, career: this.state.career, player: this.state.player });
      if (!result.ok) {
        this.setSystem({ notice: result.message });
        return;
      }
      this.setState({
        career: result.career,
        player: normalizePlayer(result.player),
        currentScreen: result.nextScreen ? this.resolveScreen(result.nextScreen) : "location",
        log: [...(this.state.log ?? []), result.message].slice(-100),
        system: {
          ...this.state.system,
          notice: result.message,
          tablePickerOpen: false,
          clubPickerOpen: false,
        },
      });
      return;
    }

    if (action === "open-table-picker") {
      this.setSystem({ tablePickerOpen: true, clubPickerOpen: false });
      return;
    }

    if (action === "open-club-picker") {
      this.setSystem({ clubPickerOpen: true, tablePickerOpen: false });
      return;
    }

    if (action === "close-modal") {
      if (target.classList?.contains("table-picker-backdrop") && event.target.closest(".table-picker-dialog")) return;
      if (target.classList?.contains("club-picker-backdrop") && event.target.closest(".club-picker-dialog")) return;
      this.closeOpenWindows();
      return;
    }

    if (action === "select-club") {
      const club = this.content.byId.clubs[id];
      if (!club) return;
      const access = canEnterClub(this.state.player, this.state.career, club);
      if (!access.ok) {
        this.setSystem({ notice: access.reason, clubPickerOpen: true });
        return;
      }
      const tables = getClubTables(this.content, id);
      const clubVenueId = (this.content.venues ?? []).find((venue) => venue.type === "poker_club" && venue.clubId === id)?.id ?? this.state.activeVenueId;
      const travel = spendLocationAction(this.state, `Переход: ${club.name}.`);
      this.menuOpen = false;
      this.setState({
        activeClubId: id,
        activeVenueId: clubVenueId,
        player: normalizePlayer(travel.player),
        career: {
          ...travel.career,
          city: {
            ...(travel.career?.city ?? {}),
            activeVenueId: clubVenueId ?? travel.career?.city?.activeVenueId ?? null,
            visitedVenueIds: [...new Set([...(travel.career?.city?.visitedVenueIds ?? []), clubVenueId].filter(Boolean))],
          },
        },
        activeTableId: tables[0]?.id ?? this.state.activeTableId,
        playerLocation: createClubLocation(this.content, id),
        currentScreen: "location",
        system: {
          ...this.state.system,
          notice: travel.message || null,
          buyInModal: null,
          clubPickerOpen: false,
          tablePickerOpen: false,
        },
      });
      return;
    }

    if (action === "select-table") {
      this.menuOpen = false;
      this.setSystem({ tablePickerOpen: false, clubPickerOpen: false });
      if (this.state.tableSession?.tableId === id) {
        this.setState({ activeTableId: id, playerLocation: createTableLocation(this.content, this.state.activeClubId, id), currentScreen: "location" });
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

    if (action === "top-up-table-stack") {
      this.topUpTableStack();
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

    if (action === "go-home") {
      const travel = spendLocationAction(this.state, "Переход: дом.");
      this.setState({
        activeVenueId: "VENUE_RU_MOS_HOME_CHEAP_ROOM",
        player: normalizePlayer(travel.player),
        career: travel.career,
        playerLocation: createHomeLocation(this.content),
        currentScreen: "location",
        system: {
          ...this.state.system,
          sessionSummary: null,
          tablePickerOpen: false,
          clubPickerOpen: false,
          notice: travel.message || null,
        },
      });
      return;
    }

    if (action === "go-city") {
      const travel = spendLocationAction(this.state, "Переход: город.");
      this.setState({
        player: normalizePlayer(travel.player),
        career: travel.career,
        playerLocation: createCityLocation(this.content, this.state.playerLocation?.cityId ?? this.content?.byId?.clubs?.[this.state.activeClubId]?.cityId),
        currentScreen: "location",
        system: {
          ...this.state.system,
          sessionSummary: null,
          tablePickerOpen: false,
          clubPickerOpen: false,
          notice: travel.message || null,
        },
      });
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

    if (action === "dismiss-session-summary") {
      this.setSystem({ sessionSummary: null });
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

  closeOpenWindows() {
    this.setSystem({
      tablePickerOpen: false,
      clubPickerOpen: false,
      buyInModal: null,
      betAmountModal: null,
      opponentReadSeatId: null,
      resultModalOpen: false,
    });
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

function spendLocationAction(state = {}, message = "Переход.") {
  return spendLifeActionCost({
    career: state.career,
    player: state.player,
    cost: 1,
    message,
  });
}

function getActionVenueId(state = {}) {
  if (["home", "venue"].includes(state.playerLocation?.type) && state.playerLocation?.venueId) {
    return state.playerLocation.venueId;
  }
  return state.activeVenueId ?? state.career?.city?.activeVenueId;
}

function getScreenLocationPatch(state = {}, content = null, screenId = "") {
  if (screenId === "location") {
    return {};
  }
  if (screenId === "locations") {
    return { playerLocation: createCityLocation(content, state.playerLocation?.cityId ?? content?.byId?.clubs?.[state.activeClubId]?.cityId) };
  }
  if (screenId === "club") {
    return { playerLocation: createClubLocation(content, state.activeClubId) };
  }
  if (screenId === "table") {
    return { playerLocation: createTableLocation(content, state.activeClubId, state.tableSession?.tableId ?? state.activeTableId) };
  }
  if (screenId === "venue") {
    return { playerLocation: createVenueLocation(content, state.activeVenueId ?? state.career?.city?.activeVenueId) };
  }
  return {};
}

function isLocationLockedAtTable(state = {}, action = "", id = "") {
  const seated = Boolean(state.tableSession?.tableId);
  if (!seated) return false;

  if (["select-venue", "venue-action", "life-action", "select-club", "go-home", "go-city"].includes(action)) return true;

  if (action === "select-table") {
    const currentTableId = state.tableSession?.tableId ?? null;
    return Boolean(id && currentTableId && id !== currentTableId);
  }

  return false;
}

function isModalBackdrop(target) {
  return Boolean(target?.classList?.contains("table-picker-backdrop")
    || target?.classList?.contains("club-picker-backdrop")
    || target?.classList?.contains("buyin-modal-layer")
    || target?.classList?.contains("bet-modal-layer")
    || target?.classList?.contains("opponent-read-layer")
    || target?.classList?.contains("result-modal-layer"));
}
