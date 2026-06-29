import { buildContentRegistry } from "./data/contentRegistry.js";
import { createNewCareer, createNewPlayer, applyHandResult, updateCareerUnlocks } from "./engine/career.js";
import { applyUnlocks } from "./engine/collections.js";
import {
  buildStartHandTimeline,
  createAnimationState,
  createInitialTableState,
  getUnlockConditionsFromHand,
  startNewHand,
  applyPlayerAction,
} from "./engine/poker.js";
import { clearSave, loadSave, saveGame } from "./engine/save.js";
import { getClubContext } from "./engine/world.js";
import { renderScreen, SCREENS } from "./ui/screens.js";
import { escapeHtml } from "./ui/components.js";

export class PokerRoomStoryApp {
  constructor(root) {
    this.root = root;
    this.content = buildContentRegistry();
    this.timelineTimer = null;
    this.state = this.createInitialState();
    this.root.addEventListener("click", (event) => this.handleClick(event));
    this.render();
  }

  createInitialState() {
    const saved = loadSave();
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
      log: ["Patch v0.1.5 · clean room UI."],
    };

    if (!saved) return base;

    return {
      ...base,
      ...saved,
      content: this.content,
      tableState: saved.tableState?.phase === "idle" ? saved.tableState : createInitialTableState(),
    };
  }

  setState(patch, options = {}) {
    this.state = {
      ...this.state,
      ...patch,
      content: this.content,
    };

    if (!options.skipSave) saveGame(this.state);
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

    if (this.state.tableState?.animation?.isPlaying) return;

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

    if (action === "reset-save") {
      const confirmed = confirm("Сбросить прогресс?");
      if (!confirmed) return;
      clearSave();
      this.state = this.createInitialState();
      this.render();
    }
  }

  startHand() {
    const context = getClubContext(this.content, this.state.activeClubId);
    const table = this.content.byId.tables[this.state.activeTableId];

    if (this.state.player.bankroll < table.bigBlind * 2) {
      this.pushLog("Банкролл слишком низкий даже для блайнда. Нужен будущий режим восстановления.");
      return;
    }

    const tableState = startNewHand({
      content: this.content,
      table,
      club: context.club,
      player: this.state.player,
    });

    const timeline = buildStartHandTimeline(tableState, table);
    this.setState({ currentScreen: "table" }, { skipSave: true });
    this.playTimeline(tableState, timeline);
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
        ...tableState.actionLog.slice(-4),
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
        ${this.renderTopbar()}
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
  if (event.action === "winner") return 1500;
  if (event.action === "shuffle" || event.action === "deal") return 900;
  return 760;
}
