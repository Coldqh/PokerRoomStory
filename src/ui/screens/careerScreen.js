import { canEnterTable } from "../../engine/world.js?v=0.9.8";
import { getRankInfo, getRankLabel, getRankProgress, getXpProgress } from "../../engine/career.js?v=0.9.8";
import { escapeHtml, metric, progressBar } from "../components.js?v=0.9.8";
import { winRate } from "./common.js?v=0.9.8";

export function renderCareerScreen(state) {
  const player = state.player;
  const rankProgress = getRankProgress(player);
  const rankInfo = getRankInfo(player);
  return `
    <section class="career-hero panel-soft">
      <div>
        <div class="kicker">Профиль</div>
        <h2>${escapeHtml(getRankLabel(player.rank))}</h2>
        <p>${rankInfo.next ? `Следующий ранг: ${escapeHtml(rankInfo.next.label)}` : "В этом клубе ты уже наверху."}</p>
      </div>
      <div class="career-rank-card">
        <span>Rank progress</span>
        <strong>${rankProgress.percent}%</strong>
        ${progressBar(rankProgress.percent)}
        <small>${rankProgress.next ? escapeHtml(rankProgress.missing.length ? rankProgress.missing.join(" · ") : "готово") : "max"}</small>
      </div>
    </section>

    <section class="stats-grid career-stats-grid">
      ${metric("Bankroll", `$${player.bankroll}`)}
      ${metric("Rep", player.reputation)}
      ${metric("Poker", `Lv.${player.pokerLevel}`)}
      ${metric("Knowledge", `Lv.${player.knowledgeLevel}`)}
      ${metric("Hands", player.handsPlayed)}
      ${metric("Winrate", `${winRate(player)}%`)}
      ${metric("Showdown", player.showdownsSeen ?? 0)}
      ${metric("Folds", player.foldsMade ?? 0)}
      ${metric("Best pot", `$${player.biggestPotWon}`)}
      ${metric("Biggest seen", `$${player.biggestPotSeen ?? 0}`)}
      ${metric("Worst loss", `$${player.biggestPotLost}`)}
      ${metric("XP", player.xp)}
    </section>

    <section class="career-grid">
      <article class="panel-soft career-panel career-wide-panel">
        <div class="section-title"><h3>Столы</h3><span>доступ</span></div>
        <div class="table-unlock-list">
          ${state.content.tables.filter((table) => table.clubId === state.activeClubId).map((table) => renderTableUnlockItem(state, table)).join("")}
        </div>
      </article>
    </section>
  `;
}

function renderTableUnlockItem(state, table) {
  const access = canEnterTable(state.player, table);
  const active = state.tableSession?.tableId === table.id;
  const req = table.unlockRequirement;
  const reqText = req ? [`$${req.bankroll ?? 0}`, `Rep ${req.reputation ?? 0}`].join(" · ") : "доступен сразу";
  return `
    <div class="table-unlock-item ${access.ok ? "open" : "locked"} ${active ? "active" : ""}">
      <div>
        <strong>${escapeHtml(table.name)}</strong>
        <span>$${table.smallBlind}/$${table.bigBlind} · ${escapeHtml(reqText)}</span>
      </div>
      <em>${active ? "active" : access.ok ? "open" : "locked"}</em>
    </div>
  `;
}

