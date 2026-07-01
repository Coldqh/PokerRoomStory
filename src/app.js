import { buildContentRegistry } from "./data/contentRegistry.js?v=0.9.9";
import { buildClubHandPatch, getClubSnapshotForTable, normalizeClubNpcState } from "./engine/club.js?v=0.9.9";
import { createNewCareer, createNewPlayer, applyHandResult, addPlayerRewards, applyChallenges, ensureActiveChallenges, normalizeCareer, normalizePlayer, updateCareerUnlocks } from "./engine/career.js?v=0.9.9";
import { applyUnlocks } from "./engine/collections.js?v=0.9.9";
import {
  buildStartHandTimeline,
  createAnimationState,
  createInitialTableState,
  getUnlockConditionsFromHand,
  startNewHand,
  advanceUntilPlayerOrEnd,
  applyPlayerAction,
  getActionMeta,
  getAvailableActions,
} from "./engine/poker.js?v=0.9.9";
import { clearSave, exportCurrentSave, getSaveInfo, importSaveText, loadSave, saveGame } from "./engine/save.js?v=0.9.9";
import { getDefaultStartLocation } from "./engine/selectors.js?v=0.9.9";
import { getClubContext } from "./engine/world.js?v=0.9.9";
import { APP_VERSION, BUILD_ID } from "./config/appMeta.js?v=0.9.9";
import { applyPendingUpdate, checkForRemoteVersion, forceAppUpdate, getRuntimeStatus, onUpdateReady, registerAppServiceWorker } from "./engine/update.js?v=0.9.9";
import { renderScreen, getVisibleScreens } from "./ui/screens.js?v=0.9.9";
import { escapeHtml } from "./ui/components.js?v=0.9.9";

export class PokerRoomStoryApp {
  constructor(root) {
    this.root = root;
    this.content = buildContentRegistry();
    this.timelineTimer = null;
    this.menuOpen = false;
    this.state = this.createInitialState();
    this.root.addEventListener("click", (event) => this.handleClick(event));
    this.root.addEventListener("change", (event) => this.handleChange(event));
    window.addEventListener("online", () => this.setSystem({ online: true }));
    window.addEventListener("offline", () => this.setSystem({ online: false }));
    onUpdateReady((event) => this.setSystem({ updateAvailable: true, updateMessage: event.detail?.message ?? "Доступно обновление." }));
    registerAppServiceWorker().then((status) => {
      const runtime = getRuntimeStatus();
      this.setSystem({ serviceWorker: status.ok, controlled: runtime.controlled });
      checkForRemoteVersion();
    });
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) checkForRemoteVersion();
    });
    this.render();
  }

  createInitialState() {
    const saved = loadSave(this.content);
    const saveMeta = saved?.saveMeta ?? null;
    const startLocation = getDefaultStartLocation(this.content, saved?.career);
    const base = {
      content: this.content,
      player: createNewPlayer(),
      career: ensureActiveChallenges(this.content, createNewCareer()),
      knownNpcIds: [],
      clubNpcState: normalizeClubNpcState(this.content, {}, startLocation.clubId),
      currentScreen: "club",
      activeClubId: startLocation.clubId,
      activeTableId: startLocation.tableId,
      tableSession: null,
      tableState: createInitialTableState(),
      log: [`Patch v${APP_VERSION} · living club.`],
      settings: createDefaultSettings(),
      system: this.createSystemState(saveMeta),
    };

    if (!saved) return base;

    const { saveMeta: _ignored, ...savedPayload } = saved;
    const loadedTable = this.sanitizeLoadedTableState(savedPayload.tableState, saveMeta);

    return {
      ...base,
      ...savedPayload,
      content: this.content,
      player: normalizePlayer(savedPayload.player),
      career: ensureActiveChallenges(this.content, normalizeCareer(savedPayload.career)),
      clubNpcState: normalizeClubNpcState(this.content, savedPayload.clubNpcState, savedPayload.activeClubId ?? base.activeClubId),
      settings: { ...createDefaultSettings(), ...(savedPayload.settings ?? {}) },
      tableSession: normalizeTableSession(savedPayload.tableSession, this.content, savedPayload.activeTableId ?? base.activeTableId),
      tableState: loadedTable.tableState,
      system: {
        ...base.system,
        saveMeta,
        saveInfo: getSaveInfo(),
        lastSavedAt: saveMeta?.updatedAt ?? null,
        notice: loadedTable.notice ?? (saveMeta?.restoredFromBackup ? "Сейв восстановлен из backup." : saveMeta?.migrated ? "Сейв обновлён." : null),
      },
    };
  }

  sanitizeLoadedTableState(tableState, saveMeta = null) {
    if (!tableState) return { tableState: createInitialTableState(), notice: null };

    const phase = tableState.phase ?? "idle";
    const activeHand = !["idle", "finished", "folded"].includes(phase);
    const saveVersion = saveMeta?.appVersion ?? "0.0.0";
    const cameFromUnsafeTimeline = activeHand && isVersionBefore(saveVersion, "0.9.9");
    const currentActor = getPlainSeatById(tableState, tableState.currentActorId);
    const brokenActor = Boolean(currentActor && (currentActor.folded || currentActor.allIn));

    if (cameFromUnsafeTimeline || brokenActor) {
      return {
        tableState: createInitialTableState(),
        notice: "Активная раздача сброшена после обновления. Прогресс сохранён.",
      };
    }

    return { tableState, notice: null };
  }

  createSystemState(saveMeta = null) {
    const runtime = getRuntimeStatus();
    return {
      appVersion: APP_VERSION,
      buildId: BUILD_ID,
      online: runtime.online,
      serviceWorker: runtime.serviceWorker,
      controlled: runtime.controlled,
      updateAvailable: false,
      updateMessage: null,
      lastUpdateCheckAt: null,
      notice: null,
      rewardToast: null,
      saveMeta,
      saveInfo: getSaveInfo(),
      lastSavedAt: saveMeta?.updatedAt ?? null,
    };
  }

  setState(patch, options = {}) {
    this.state = {
      ...this.state,
      ...patch,
      content: this.content,
    };

    if (!options.skipSave) {
      const saveMeta = saveGame(this.state);
      this.state = {
        ...this.state,
        system: {
          ...this.state.system,
          saveMeta,
          saveInfo: getSaveInfo(),
          lastSavedAt: saveMeta.updatedAt,
        },
      };
    }

    this.render();
  }

  setSystem(patch) {
    this.state = {
      ...this.state,
      system: {
        ...this.state.system,
        ...patch,
      },
    };
    this.render();
  }

  resolveScreen(screenId) {
    const seated = Boolean(this.state.tableSession?.tableId);
    if (seated && screenId === "club") return "table";
    if (!seated && screenId === "table") return "club";
    return screenId;
  }

  getDisplayState() {
    const currentScreen = this.resolveScreen(this.state.currentScreen);
    if (currentScreen === this.state.currentScreen) return this.state;
    return { ...this.state, currentScreen };
  }

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

    if (this.state.tableState?.animation?.isPlaying && !["apply-update", "force-update", "check-update", "export-save", "import-save", "dismiss-notice", "dismiss-reward", "reset-save", "set-buyin", "confirm-buyin", "close-buyin"].includes(action)) return;

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
  }

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
  }

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
  }

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
  }

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
  }

  clampBetAmount(value, min, max) {
    const amount = Math.round(Number(value));
    if (!Number.isFinite(amount)) return min;
    return Math.max(min, Math.min(max, amount));
  }

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
  }

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
  }

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

  exportSave() {
    const text = exportCurrentSave();
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `poker-room-story-save-v${APP_VERSION}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    this.setSystem({ notice: "Сейв экспортирован." });
  }

  toggleAnimationSpeed() {
    const current = this.state.settings?.animationSpeed ?? "normal";
    const next = current === "normal" ? "fast" : current === "fast" ? "instant" : "normal";
    this.setState({
      settings: {
        ...createDefaultSettings(),
        ...(this.state.settings ?? {}),
        animationSpeed: next,
      },
    });
  }

  startHand() {
    const context = getClubContext(this.content, this.state.activeClubId);
    const table = this.content.byId.tables[this.state.activeTableId];
    const session = this.state.tableSession?.tableId === table.id ? this.state.tableSession : null;

    if (!session) {
      this.openBuyInModal(table.id);
      return;
    }

    if ((session.stack ?? 0) < table.bigBlind * 2) {
      this.setSystem({ notice: "Стек за столом слишком низкий. Выйди и сделай новый buy-in." });
      return;
    }

    const seatedPlayer = {
      ...this.state.player,
      bankroll: session.stack,
      tableStack: session.stack,
    };

    const initialTableState = startNewHand({
      content: this.content,
      table,
      club: context.club,
      player: seatedPlayer,
      previousTableState: this.state.tableState,
      clubSnapshot: getClubSnapshotForTable(this.content, this.state.clubNpcState, this.state.activeClubId, this.state.activeTableId),
    });

    const auto = advanceUntilPlayerOrEnd({ tableState: initialTableState, table });
    const timeline = [...buildStartHandTimeline(initialTableState, table), ...auto.timeline];
    this.setState({
      currentScreen: "table",
      system: {
        ...this.state.system,
        resultModalOpen: false,
        selectedBetTarget: null,
      },
    }, { skipSave: true });

    if (auto.result) {
      this.playTimeline(auto.tableState, timeline, (animatedTableState) => {
        this.completeHand(auto.tableState, auto.result, animatedTableState);
      });
      return;
    }

    this.playTimeline(auto.tableState, timeline);
  }

  playAction(action, explicitRaiseTarget = null) {
    const table = this.content.byId.tables[this.state.activeTableId];
    const raiseTarget = action === "raise" ? Number(explicitRaiseTarget ?? this.state.system?.selectedBetTarget ?? 0) || null : null;
    const { tableState, result, timeline = [] } = applyPlayerAction({
      tableState: this.state.tableState,
      player: this.state.player,
      action,
      table,
      raiseTarget,
    });

    this.state = {
      ...this.state,
      system: {
        ...this.state.system,
        selectedBetTarget: null,
        betAmountModal: null,
      },
    };

    if (!result) {
      this.playTimeline(tableState, timeline);
      return;
    }

    this.playTimeline(tableState, timeline, (animatedTableState) => {
      this.completeHand(tableState, result, animatedTableState);
    });
  }


  completeHand(tableState, result, animatedTableState) {
    const unlockConditions = getUnlockConditionsFromHand(tableState, result);
    const unlockResult = applyUnlocks({
      content: this.content,
      career: normalizeCareer(this.state.career),
      unlockConditions,
    });

    const playerAfterBase = applyHandResult(this.state.player, {
      ...result,
      xp: result.xp + unlockResult.xpReward,
    }, tableState);

    const challengeResult = applyChallenges({
      content: this.content,
      career: unlockResult.career,
      player: playerAfterBase,
      tableState,
      result,
      unlockConditions,
    });

    const playerAfterHand = addPlayerRewards(playerAfterBase, {
      xp: challengeResult.xpReward,
      reputation: challengeResult.reputationReward,
    });

    const careerAfterUnlocks = updateCareerUnlocks(playerAfterHand, challengeResult.career, this.content);
    const clubPatch = buildClubHandPatch({
      content: this.content,
      clubNpcState: this.state.clubNpcState,
      clubId: this.state.activeClubId,
      tableState,
      result,
      challengeMessages: challengeResult.messages,
    });
    const totalXp = result.xp + unlockResult.xpReward + challengeResult.xpReward;
    const totalRep = (result.reputationGain ?? 0) + challengeResult.reputationReward;
    const progressLine = buildProgressLine({ xp: totalXp, reputation: totalRep, messages: [...unlockResult.messages, ...challengeResult.messages, ...clubPatch.clubMessages] });
    const rewardToast = buildRewardToast(this.content, challengeResult);
    const nextTableSession = this.state.tableSession?.tableId === this.state.activeTableId
      ? {
        ...this.state.tableSession,
        stack: Math.max(0, Math.round((this.state.tableSession.stack ?? 0) + (result.bankrollDelta ?? 0))),
        handsPlayed: (this.state.tableSession.handsPlayed ?? 0) + 1,
      }
      : this.state.tableSession;
    const log = [
      ...this.state.log,
      ...tableState.actionLog.slice(-5),
      ...result.logs,
      ...(result.review ? [`Разбор: ${result.review.text}`] : []),
      ...unlockResult.messages,
      ...challengeResult.messages,
      ...clubPatch.clubMessages,
      progressLine,
    ].slice(-100);

    this.setState({
      player: playerAfterHand,
      career: careerAfterUnlocks,
      tableSession: nextTableSession,
      clubNpcState: clubPatch.clubNpcState,
      tableState: {
        ...animatedTableState,
        clubEvent: clubPatch.roomState.activeEvent,
      },
      log,
      system: {
        ...this.state.system,
        rewardToast,
        resultModalOpen: true,
      },
    });
  }

  playTimeline(finalTableState, events, onComplete) {
    if (this.timelineTimer) window.clearTimeout(this.timelineTimer);

    if (!events?.length) {
      const terminalHand = finalTableState.phase === "finished" || finalTableState.phase === "folded";
      const completed = {
        ...finalTableState,
        animation: createAnimationState({
          currentEvent: null,
          revealedCommunityCount: finalTableState.communityCards?.length ?? 0,
          showWinner: terminalHand,
        }),
      };
      this.setState({ tableState: completed });
      if (onComplete) onComplete(completed);
      return;
    }

    let index = 0;
    let revealedCommunityCount = this.state.tableState?.animation?.revealedCommunityCount ?? 0;
    const recentEvents = [];

    const step = () => {
      const rawEvent = events[index];
      const currentEvent = stripTimelineSnapshot(rawEvent);
      const frameState = rawEvent?.snapshot ?? finalTableState;
      if (typeof currentEvent.revealCount === "number") revealedCommunityCount = currentEvent.revealCount;
      recentEvents.push(currentEvent);

      const animatedState = {
        ...frameState,
        awaitingPlayer: false,
        animation: createAnimationState({
          isPlaying: true,
          index,
          total: events.length,
          currentEvent,
          recentEvents: recentEvents.slice(-5),
          revealedCommunityCount,
          showWinner: currentEvent.action === "winner",
        }),
      };

      this.setState({ tableState: animatedState }, { skipSave: true });

      index += 1;
      if (index < events.length) {
        this.timelineTimer = window.setTimeout(step, this.getEventDuration(currentEvent));
        return;
      }

      this.timelineTimer = window.setTimeout(() => {
        const lastEvent = stripTimelineSnapshot(events.at(-1));
        const terminalHand = finalTableState.phase === "finished" || finalTableState.phase === "folded";
        const completedState = {
          ...finalTableState,
          animation: createAnimationState({
            isPlaying: false,
            index: events.length,
            total: events.length,
            currentEvent: terminalHand ? lastEvent : null,
            recentEvents: recentEvents.slice(-5),
            revealedCommunityCount: finalTableState.communityCards?.length ?? revealedCommunityCount,
            showWinner: terminalHand,
          }),
        };
        this.setState({ tableState: completedState });
        if (onComplete) onComplete(completedState);
      }, this.getEventDuration(currentEvent));
    };

    step();
  }

  getEventDuration(event) {
    const base = eventDuration(event);
    const speed = this.state.settings?.animationSpeed ?? "normal";
    if (speed === "fast") return Math.max(260, Math.round(base * 0.58));
    if (speed === "instant") return Math.max(90, Math.round(base * 0.16));
    return base;
  }

  pushLog(message) {
    this.setState({ log: [...this.state.log, message].slice(-100) });
  }

  render() {
    const displayState = this.getDisplayState();
    this.root.innerHTML = `
      <main class="app-shell ${displayState.currentScreen === "table" ? "table-mode" : ""} ${this.menuOpen ? "menu-open" : ""}">
        <input id="save-import-input" type="file" accept="application/json,.json" hidden />
        ${this.renderTopbar(displayState)}
        ${this.renderSideDrawer(displayState)}
        ${this.renderUpdateBanner()}
        ${this.renderRewardToast()}
        ${renderScreen(displayState)}
      </main>
    `;
  }

  renderTopbar(displayState = this.state) {
    const player = displayState.player;
    return `
      <header class="topbar club-topbar drawer-topbar">
        <button class="menu-button" data-action="open-menu" aria-label="Открыть меню"><span>☰</span></button>
        <div class="brand-card">
          <div class="crest">♠</div>
          <div class="brand">
            <p>Poker career</p>
            <h1>Poker Room Story</h1>
          </div>
        </div>

        <div class="quick-stats">
          ${topStat("Bankroll", `$${player.bankroll}`)}
          ${topStat("Rank", rankLabel(player.rank))}
          ${topStat("Hands", player.handsPlayed)}
          ${topStat("Win", `${winRate(player)}%`)}
          ${topStat("Version", `v${displayState.system?.appVersion ?? APP_VERSION}`)}
        </div>
      </header>
    `;
  }

  renderSideDrawer(displayState = this.state) {
    const player = displayState.player;
    const screens = getVisibleScreens(displayState);
    return `
      <button class="drawer-backdrop" data-action="close-menu" aria-label="Закрыть меню"></button>
      <aside class="side-drawer panel-soft" aria-label="Главное меню">
        <div class="drawer-head">
          <div>
            <span>Poker Room Story</span>
            <strong>Меню</strong>
          </div>
          <button class="drawer-close" data-action="close-menu" aria-label="Закрыть">×</button>
        </div>

        <div class="drawer-player">
          <div>${topStat("Bankroll", `$${player.bankroll}`)}</div>
          <div>${topStat("Rank", rankLabel(player.rank))}</div>
          <div>${topStat("Win", `${winRate(player)}%`)}</div>
        </div>

        <nav class="drawer-nav">
          ${screens.map(
            (screen) => `
              <button data-action="screen" data-id="${escapeHtml(screen.id)}" class="${displayState.currentScreen === screen.id ? "active" : ""}">
                <span>${navIcon(screen.id)}</span><b>${escapeHtml(screen.label)}</b>
              </button>
            `,
          ).join("")}
        </nav>

        <div class="drawer-version">
          <span>v${escapeHtml(displayState.system?.appVersion ?? APP_VERSION)}</span>
          <button class="small-button ghost" data-action="screen" data-id="settings">Настройки</button>
        </div>
      </aside>
    `;
  }

  renderRewardToast() {
    const toast = this.state.system?.rewardToast;
    if (!toast) return "";

    return `
      <section class="reward-toast panel-soft">
        <div>
          <span>${escapeHtml(toast.kicker ?? "Задание выполнено")}</span>
          <strong>${escapeHtml(toast.title ?? "Прогресс")}</strong>
          <small>${escapeHtml(toast.reward ?? "")}</small>
        </div>
        <button class="small-button ghost" data-action="dismiss-reward">×</button>
      </section>
    `;
  }

  renderUpdateBanner() {
    const system = this.state.system ?? {};
    if (!system.updateAvailable && !system.notice && system.online !== false) return "";

    const title = system.updateAvailable ? "Есть обновление" : system.online === false ? "Офлайн-режим" : "Система";
    const text = system.updateAvailable
      ? system.updateMessage || "Можно установить свежую версию."
      : system.online === false
        ? "Игра работает из кэша. Сейв хранится на устройстве."
        : system.notice;

    return `
      <section class="system-banner panel-soft">
        <div><strong>${escapeHtml(title)}</strong><span>${escapeHtml(text ?? "")}</span></div>
        <div class="system-banner-actions">
          ${system.updateAvailable ? `<button class="primary small-button" data-action="apply-update">Установить</button>` : ""}
          <button class="small-button" data-action="force-update">Обновить</button>
          <button class="small-button ghost" data-action="dismiss-notice">×</button>
        </div>
      </section>
    `;
  }
}

function stripTimelineSnapshot(event) {
  if (!event) return event;
  const { snapshot: _snapshot, ...safeEvent } = event;
  return safeEvent;
}

function getPlainSeatById(tableState, seatId) {
  if (!tableState || !seatId) return null;
  const seats = [tableState.heroSeat, ...(tableState.npcSeats ?? [])].filter(Boolean);
  return seats.find((seat) => seat.id === seatId) ?? null;
}

function isVersionBefore(version, target) {
  const parse = (value) => String(value ?? "0.0.0")
    .split(/[.-]/)
    .slice(0, 3)
    .map((part) => Number.parseInt(part, 10) || 0);
  const left = parse(version);
  const right = parse(target);
  for (let i = 0; i < 3; i += 1) {
    if (left[i] < right[i]) return true;
    if (left[i] > right[i]) return false;
  }
  return false;
}

function normalizeTableSession(session, content, activeTableId = null) {
  if (!session?.tableId) return null;
  const table = content?.byId?.tables?.[session.tableId];
  if (!table) return null;
  const stack = clampMoney(Number(session.stack ?? session.buyIn ?? table.minBuyIn));
  if (stack <= 0) return null;
  return {
    tableId: table.id,
    buyIn: clampMoney(Number(session.buyIn ?? stack)),
    stack,
    handsPlayed: Number(session.handsPlayed ?? 0),
    seatedAt: Number(session.seatedAt ?? Date.now()),
  };
}

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

function createDefaultSettings() {
  return {
    animationSpeed: "normal",
  };
}

function topStat(label, value) {
  return `<div class="top-stat"><small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong></div>`;
}

function rankLabel(rank) {
  const labels = {
    newcomer: "Новичок",
    local_regular: "Местный",
    dangerous_amateur: "Опасный",
    club_shark: "Акула",
  };
  return labels[rank] ?? rank;
}

function winRate(player) {
  if (!player.handsPlayed) return 0;
  return Math.round((player.handsWon / player.handsPlayed) * 100);
}

function speedLabel(value) {
  const labels = {
    normal: "Обычный",
    fast: "Быстрый",
    instant: "Мгновенный",
  };
  return labels[value] ?? labels.normal;
}

function navIcon(id) {
  const icons = {
    club: "⌂",
    table: "♣",
    career: "♕",
    tasks: "☑",
    npcs: "◉",
    glossary: "◇",
    collections: "✦",
    settings: "⚙",
  };
  return icons[id] ?? "•";
}

function buildProgressLine({ xp, reputation, messages }) {
  const bits = [`XP +${xp}`];
  if (reputation > 0) bits.push(`Rep +${reputation}`);
  if (messages?.length) bits.push(`${messages.length} unlock`);
  return `Прогресс: ${bits.join(" · ")}`;
}

function buildRewardToast(content, challengeResult) {
  const ids = challengeResult?.completedNow ?? [];
  if (!ids.length) return null;

  const first = content.byId?.challenges?.[ids[0]] ?? null;
  const extra = ids.length > 1 ? ` + ещё ${ids.length - 1}` : "";
  const parts = [];
  if (challengeResult.xpReward) parts.push(`XP +${challengeResult.xpReward}`);
  if (challengeResult.reputationReward) parts.push(`Rep +${challengeResult.reputationReward}`);

  return {
    kicker: "Задание выполнено",
    title: `${first?.name ?? "Прогресс"}${extra}`,
    reward: parts.join(" · ") || "Награда получена",
  };
}

function formatDelta(value) {
  return value >= 0 ? `+$${value}` : `-$${Math.abs(value)}`;
}

function eventDuration(event) {
  if (!event) return 650;
  if (["flop", "turn", "river", "showdown"].includes(event.action)) return 1050;
  if (event.action === "winner") return 1700;
  if (event.action === "shuffle" || event.action === "deal") return 900;
  return 700;
}
