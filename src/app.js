import { buildContentRegistry } from "./data/contentRegistry.js";
import { createNewCareer, createNewPlayer, applyHandResult, updateCareerUnlocks } from "./engine/career.js";
import { applyUnlocks } from "./engine/collections.js";
import { createInitialTableState, getUnlockConditionsFromHand, startNewHand, applyPlayerAction } from "./engine/poker.js";
import { clearSave, loadSave, saveGame } from "./engine/save.js";
import { getClubContext } from "./engine/world.js";
import { renderScreen, SCREENS } from "./ui/screens.js";
import { statPill, escapeHtml } from "./ui/components.js";

export class PokerRoomStoryApp {
  constructor(root) {
    this.root = root;
    this.content = buildContentRegistry();
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
      log: ["Patch v0.1.3 загружен. Новый Poker World UI: стол, HUD, инспектор раздачи, мобильный dock."],
    };

    if (!saved) return base;

    return {
      ...base,
      ...saved,
      content: this.content,
      tableState: saved.tableState?.phase === "idle" ? saved.tableState : createInitialTableState(),
    };
  }

  setState(patch) {
    this.state = {
      ...this.state,
      ...patch,
      content: this.content,
    };

    saveGame(this.state);
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
      const confirmed = confirm("Сбросить прогресс Poker Room Story?");
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

    this.setState({ tableState, currentScreen: "table" });
  }

  playAction(action) {
    const table = this.content.byId.tables[this.state.activeTableId];
    const { tableState, result } = applyPlayerAction({
      tableState: this.state.tableState,
      player: this.state.player,
      action,
      table,
    });

    if (!result) {
      this.setState({ tableState });
      return;
    }

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
      ...tableState.actionLog.slice(-2),
      ...result.logs,
      ...unlockResult.messages,
      `Банкролл: ${formatDelta(result.bankrollDelta)} · XP +${result.xp + unlockResult.xpReward}`,
    ].slice(-100);

    this.setState({
      player: playerAfterHand,
      career: careerAfterUnlocks,
      tableState,
      log,
    });
  }

  pushLog(message) {
    this.setState({ log: [...this.state.log, message].slice(-100) });
  }

  render() {
    this.root.innerHTML = `
      <main class="app-shell">
        ${this.renderTopbar()}
        ${renderScreen(this.state)}
      </main>
    `;
  }

  renderTopbar() {
    const player = this.state.player;
    return `
      <header class="topbar">
        <div class="brand-row">
          <div class="brand">
            <h1>Poker Room Story</h1>
            <p>v0.1.3 · Poker World UI Patch</p>
          </div>
        </div>

        <div class="stats-strip">
          ${statPill("Bankroll", `$${player.bankroll}`)}
          ${statPill("Rank", rankLabel(player.rank))}
          ${statPill("Rep", player.reputation)}
          ${statPill("Poker", `Lv.${player.pokerLevel}`)}
        </div>

        <nav class="nav">
          ${SCREENS.map(
            (screen) => `
              <button data-action="screen" data-id="${escapeHtml(screen.id)}" class="${this.state.currentScreen === screen.id ? "active" : ""}">
                ${escapeHtml(screen.label)}
              </button>
            `,
          ).join("")}
        </nav>
      </header>
    `;
  }
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

function formatDelta(value) {
  return value >= 0 ? `+$${value}` : `-$${Math.abs(value)}`;
}
