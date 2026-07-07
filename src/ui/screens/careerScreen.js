import { getRankInfo, getRankLabel, getRankProgress } from "../../engine/career.js?v=3.5.0";
import { escapeHtml, metric, progressBar } from "../components.js?v=3.5.0";
import { winRate } from "./common.js?v=3.5.0";

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
  `;
}
