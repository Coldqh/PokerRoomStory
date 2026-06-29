import { buildContentRegistry } from "./data/contentRegistry.js";
import { createNewCareer, createNewPlayer, applyHandResult, updateCareerUnlocks } from "./engine/career.js";
import { applyUnlocks } from "./engine/collections.js";
import {
  buildStartHandTimeline,
  createAnimationState,
  createInitialTableState,
  getUnlockConditionsFromHand,
  startNewHand,
  advanceUntilPlayerOrEnd,
  applyPlayerAction,
} from "./engine/poker.js";
import { clearSave, exportCurrentSave, getSaveInfo, importSaveText, loadSave, saveGame } from "./engine/save.js";
import { getClubContext } from "./engine/world.js";
import { APP_VERSION } from "./config/appMeta.js";
import { applyPendingUpdate, forceAppUpdate, getRuntimeStatus, onUpdateReady, registerAppServiceWorker } from "./engine/update.js";
import { renderScreen, SCREENS } from "./ui/screens.js";
import { escapeHtml } from "./ui/components.js";

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
    onUpdateReady(() => this.setSystem({ updateAvailable: true, updateMessage: "Доступно обновление." }));
    registerAppServiceWorker().then((status) => {
      const runtime = getRuntimeStatus();
      this.setSystem({ serviceWorker: status.ok, controlled: runtime.controlled });
    });
    this.render();
  }

  createInitialState() {
    const saved = loadSave(this.content);
    const saveMeta = saved?.saveMeta ?? null;
    const base = {
      content: this.content,
      player: createNewPlayer(),
      career: createNewCareer(),
      knownNpcIds: [],
      clubNpcState: {},
      currentScreen: "club",
      activeClubId: "CLUB_RU_BASEMENT_RIVER_001",
      activeTableId: "TABLE_RU_BRR_LOW_001",
      tableState: createInitialTableState(),
      log: [`Patch v${APP_VERSION} · stability system.`],
      system: this.createSystemState(saveMeta),
    };

    if (!saved) return base;

    const { saveMeta: _ignored, ...savedPayload } = saved;
    return {
      ...base,
      ...savedPayload,
      content: this.content,
      tableState: savedPayload.tableState ?? createInitialTableState(),
      system: {
        ...base.system,
        saveMeta,
        saveInfo: getSaveInfo(),
        lastSavedAt: saveMeta?.updatedAt ?? null,
        notice: saveMeta?.restoredFromBackup ? "Сейв восстановлен из backup." : saveMeta?.migrated ? "Сейв обновлён." : null,
      },
    };
  }

  createSystemState(saveMeta = null) {
    const runtime = getRuntimeStatus();
    return {
      appVersion: APP_VERSION,
      online: runtime.online,
      serviceWorker: runtime.serviceWorker,
      controlled: runtime.controlled,
      updateAvailable: false,
      updateMessage: null,
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

    if (this.state.tableState?.animation?.isPlaying && !["apply-update", "force-update", "export-save", "import-save", "dismiss-notice", "reset-save"].includes(action)) return;

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
      career: this.state.career,
      unlockConditions,
    });

    const playerAfterHand = applyHandResult(this.state.player, {
      ...result,
      xp: result.xp + unlockResult.xpReward,
    });

    const careerAfterUnlocks = updateCareerUnlocks(playerAfterHand, unlockResult.career, this.content);
    const log = [
      ...this.state.log,
      ...tableState.actionLog.slice(-5),
      ...result.logs,
      ...unlockResult.messages,
      `Банкролл: ${formatDelta(result.bankrollDelta)} · XP +${result.xp + unlockResult.xpReward}`,
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
      const completed = {
        ...finalTableState,
        animation: createAnimationState({ revealedCommunityCount: finalTableState.communityCards?.length ?? 0 }),
      };
      this.setState({ tableState: completed });
      if (onComplete) onComplete(completed);
      return;
    }

    let index = 0;
    let revealedCommunityCount = this.state.tableState?.animation?.revealedCommunityCount ?? 0;
    const recentEvents = [];

    const step = () => {
      const currentEvent = events[index];
      if (typeof currentEvent.revealCount === "number") revealedCommunityCount = currentEvent.revealCount;
      recentEvents.push(currentEvent);

      const animatedState = {
        ...finalTableState,
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
        this.timelineTimer = window.setTimeout(step, eventDuration(currentEvent));
        return;
      }

      this.timelineTimer = window.setTimeout(() => {
        const completedState = {
          ...finalTableState,
          animation: createAnimationState({
            isPlaying: false,
            index: events.length,
            total: events.length,
            currentEvent: events.at(-1),
            recentEvents: recentEvents.slice(-5),
            revealedCommunityCount: finalTableState.communityCards?.length ?? revealedCommunityCount,
            showWinner: finalTableState.phase === "finished" || finalTableState.phase === "folded",
          }),
        };
        this.setState({ tableState: completedState });
        if (onComplete) onComplete(completedState);
      }, eventDuration(currentEvent));
    };

    step();
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
    npcs: "◉",
    glossary: "◇",
    collections: "✦",
  };
  return icons[id] ?? "•";
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
