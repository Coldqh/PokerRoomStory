import { APP_VERSION } from "../config/appMeta.js?v=2.8.0";
import { renderScreen, getVisibleScreens } from "../ui/screens.js?v=2.8.0";
import { escapeHtml } from "../ui/components.js?v=2.8.0";

export const renderShell = {
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
  },

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
  },

  renderSideDrawer(displayState = this.state) {
    const player = displayState.player;
    const screens = getVisibleScreens(displayState).filter((screen) => !screen.hiddenFromNav);
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
  },

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
  },

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
};

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
    life: "●",
    location: "⌖",
    location: "⌖",
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
