import { buildContentRegistry } from "./data/contentRegistry.js?v=0.5.2";
import { createNewCareer, createNewPlayer, applyHandResult, addPlayerRewards, applyChallenges, ensureActiveChallenges, normalizeCareer, normalizePlayer, updateCareerUnlocks } from "./engine/career.js?v=0.5.2";
import { applyUnlocks } from "./engine/collections.js?v=0.5.2";
import {
  buildStartHandTimeline,
  createAnimationState,
  createInitialTableState,
  getUnlockConditionsFromHand,
  startNewHand,
  advanceUntilPlayerOrEnd,
  applyPlayerAction,
} from "./engine/poker.js?v=0.5.2";
import { clearSave, exportCurrentSave, getSaveInfo, importSaveText, loadSave, saveGame } from "./engine/save.js?v=0.5.2";
import { getClubContext } from "./engine/world.js?v=0.5.2";
import { APP_VERSION, BUILD_ID } from "./config/appMeta.js?v=0.5.2";
import { applyPendingUpdate, checkForRemoteVersion, forceAppUpdate, getRuntimeStatus, onUpdateReady, registerAppServiceWorker } from "./engine/update.js?v=0.5.2";
import { renderScreen, SCREENS } from "./ui/screens.js?v=0.5.2";
import { escapeHtml } from "./ui/components.js?v=0.5.2";

export class PokerRoomStoryApp {
  constructor(root) {
    this.root = root;
    this.content = buildContentRegistry();
    this.timelineTimer = null;
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
    const base = {
      content: this.content,
      player: createNewPlayer(),
      career: ensureActiveChallenges(this.content, createNewCareer()),
      knownNpcIds: [],
      clubNpcState: {},
      currentScreen: "club",
      activeClubId: "CLUB_RU_BASEMENT_RIVER_001",
      activeTableId: "TABLE_RU_BRR_LOW_001",
      tableState: createInitialTableState(),
      log: [`Patch v${APP_VERSION} · task subtabs.`],
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
      settings: { ...createDefaultSettings(), ...(savedPayload.settings ?? {}) },
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
    const cameFromUnsafeTimeline = activeHand && isVersionBefore(saveVersion, "0.5.2");
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

  handleClick(event) {
    const target = event.target.closest("[data-action]");
    if (!target) return;

    const action = target.dataset.action;
    const id = target.dataset.id;

    if (action === "screen") {
      this.setState({ currentScreen: id });
      return;
    }

    if (this.state.tableState?.animation?.isPlaying && !["apply-update", "force-update", "check-update", "export-save", "import-save", "dismiss-notice", "reset-save"].includes(action)) return;

    if (action === "select-table") {
      this.setState({ activeTableId: id, currentScreen: "table", tableState: createInitialTableState() });
      return;
    }

    if (action === "start-hand") {
      this.startHand();
      return;
    }

    if (action === "player-action") {
      this.playAction(id);
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

    if (this.state.player.bankroll < table.bigBlind * 2) {
      this.pushLog("Банкролл слишком низкий даже для блайнда. Нужен будущий режим восстановления.");
      return;
    }

    const initialTableState = startNewHand({
      content: this.content,
      table,
      club: context.club,
      player: this.state.player,
      previousTableState: this.state.tableState,
    });

    const auto = advanceUntilPlayerOrEnd({ tableState: initialTableState, table });
    const timeline = [...buildStartHandTimeline(initialTableState, table), ...auto.timeline];
    this.setState({ currentScreen: "table" }, { skipSave: true });

    if (auto.result) {
      this.playTimeline(auto.tableState, timeline, (animatedTableState) => {
        this.completeHand(auto.tableState, auto.result, animatedTableState);
      });
      return;
    }

    this.playTimeline(auto.tableState, timeline);
  }

  playAction(action) {
    const table = this.content.byId.tables[this.state.activeTableId];
    const { tableState, result, timeline = [] } = applyPlayerAction({
      tableState: this.state.tableState,
      player: this.state.player,
      action,
      table,
    });

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
    const totalXp = result.xp + unlockResult.xpReward + challengeResult.xpReward;
    const totalRep = (result.reputationGain ?? 0) + challengeResult.reputationReward;
    const progressLine = buildProgressLine({ xp: totalXp, reputation: totalRep, messages: [...unlockResult.messages, ...challengeResult.messages] });
    const log = [
      ...this.state.log,
      ...tableState.actionLog.slice(-5),
      ...result.logs,
      ...(result.review ? [`Разбор: ${result.review.text}`] : []),
      ...unlockResult.messages,
      ...challengeResult.messages,
      progressLine,
    ].slice(-100);

    this.setState({
      player: playerAfterHand,
      career: careerAfterUnlocks,
      tableState: animatedTableState,
      log,
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
    this.root.innerHTML = `
      <main class="app-shell ${this.state.currentScreen === "table" ? "table-mode" : ""}">
        <input id="save-import-input" type="file" accept="application/json,.json" hidden />
        ${this.renderTopbar()}
        ${this.renderUpdateBanner()}
        ${renderScreen(this.state)}
      </main>
    `;
  }

  renderTopbar() {
    const player = this.state.player;
    return `
      <header class="topbar club-topbar">
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
          ${topStat("Version", `v${this.state.system?.appVersion ?? APP_VERSION}`)}
        </div>

        <nav class="nav app-nav">
          ${SCREENS.map(
            (screen) => `
              <button data-action="screen" data-id="${escapeHtml(screen.id)}" class="${this.state.currentScreen === screen.id ? "active" : ""}">
                <span>${navIcon(screen.id)}</span>${escapeHtml(screen.label)}
              </button>
            `,
          ).join("")}
        </nav>
      </header>
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

function navIcon(id) {
  const icons = {
    club: "⌂",
    table: "♣",
    career: "♕",
    tasks: "☑",
    npcs: "◉",
    glossary: "◇",
    collections: "✦",
  };
  return icons[id] ?? "•";
}

function buildProgressLine({ xp, reputation, messages }) {
  const bits = [`XP +${xp}`];
  if (reputation > 0) bits.push(`Rep +${reputation}`);
  if (messages?.length) bits.push(`${messages.length} unlock`);
  return `Прогресс: ${bits.join(" · ")}`;
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
