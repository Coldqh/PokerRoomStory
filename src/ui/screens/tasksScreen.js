import { getActiveChallenges, getChallengeDifficultyLabel, getChallengeProgress, getCompletedChallenges } from "../../engine/career.js?v=3.4.1";
import { getCityGoalRoadmap } from "../../engine/cityGoals.js?v=3.4.1";
import { emptyState, escapeHtml, progressBar } from "../components.js?v=3.4.1";

export function renderTasksScreen(state) {
  const player = state.player;
  const activeChallenges = getActiveChallenges(state.content, state.career);
  const completedChallenges = getCompletedChallenges(state.content, state.career);
  const completedLog = new Map((state.career?.completedChallengeLog ?? []).map((entry) => [entry.id, entry]));
  const challengeContext = { player, tableState: state.tableState, result: state.tableState?.lastResult, unlockConditions: [] };
  const roadmap = getCityGoalRoadmap({ content: state.content, career: state.career, player });

  return `
    <section class="page-card panel-soft tasks-hero">
      <div class="kicker">City progression</div>
      <h2>Задания</h2>
      <p>Москва: ${escapeHtml(String(roadmap.completedCount))}/${escapeHtml(String(roadmap.totalCount))} целей закрыто</p>
    </section>

    ${renderRoadmap(roadmap)}

    <section class="tasks-board">
      <input class="task-tab-input" type="radio" name="task-tab" id="task-tab-active" checked />
      <input class="task-tab-input" type="radio" name="task-tab" id="task-tab-completed" />

      <div class="task-tab-switch panel-soft">
        <label for="task-tab-active">Активные <span>${activeChallenges.length}/6</span></label>
        <label for="task-tab-completed">Выполненные <span>${completedChallenges.length}</span></label>
      </div>

      <article class="panel-soft career-panel task-tab-panel task-panel-active">
        <div class="section-title"><h3>Клубные задания</h3><span>${activeChallenges.length}/6</span></div>
        <div class="challenge-list active-task-list">
          ${activeChallenges.length ? activeChallenges.map((challenge) => renderChallengeItem(challenge, false, challengeContext)).join("") : emptyState("Активных заданий нет.")}
        </div>
      </article>

      <article class="panel-soft career-panel task-tab-panel task-panel-completed">
        <div class="section-title"><h3>Выполненные</h3><span>${completedChallenges.length}</span></div>
        <div class="challenge-list completed-task-list">
          ${completedChallenges.length ? completedChallenges.slice().reverse().map((challenge) => renderChallengeItem(challenge, true, challengeContext, completedLog.get(challenge.id))).join("") : emptyState("Пока пусто.")}
        </div>
      </article>
    </section>
  `;
}

function renderRoadmap(roadmap) {
  const main = roadmap.mainGoal;
  return `
    <section class="city-goal-board">
      <article class="panel-soft career-panel city-main-goal">
        <div class="section-title"><h3>Главная цель</h3><span>${escapeHtml(main?.chapterTitle ?? "Москва")}</span></div>
        ${main ? renderCityGoalItem(main, true) : emptyState("Маршрут закрыт.")}
      </article>

      <article class="panel-soft career-panel city-next-goals">
        <div class="section-title"><h3>Ближайшие цели</h3><span>${roadmap.activeGoals.length}</span></div>
        <div class="challenge-list city-goal-list">
          ${roadmap.activeGoals.length ? roadmap.activeGoals.map((goal) => renderCityGoalItem(goal)).join("") : emptyState("Ближайших целей нет.")}
        </div>
      </article>

      <article class="panel-soft career-panel city-chapter-list">
        <div class="section-title"><h3>Главы Москвы</h3><span>${roadmap.completedCount}/${roadmap.totalCount}</span></div>
        <div class="city-chapter-grid">
          ${roadmap.chapters.map(renderChapterItem).join("")}
        </div>
      </article>
    </section>
  `;
}

function renderCityGoalItem(goal, featured = false) {
  const progressText = goal.completed ? "Выполнено" : `${goal.current}/${goal.target}`;
  return `
    <div class="challenge-item city-goal-item ${goal.completed ? "completed" : ""} ${featured ? "featured" : ""}">
      <div class="challenge-copy">
        <div class="challenge-headline">
          <strong>${escapeHtml(goal.title)}</strong>
          <em>${escapeHtml(categoryLabel(goal.category))}</em>
        </div>
        <span>${escapeHtml(goal.description)}</span>
        <div class="challenge-meta">
          <small>${escapeHtml(goal.chapterTitle)}</small>
        </div>
      </div>
      <div class="challenge-progress">
        <em>${escapeHtml(progressText)}</em>
        ${progressBar(goal.percent)}
        <small class="reward-pill">${escapeHtml(goal.rewardLabel)}</small>
      </div>
    </div>
  `;
}

function renderChapterItem(chapter) {
  const percent = Math.round((chapter.completed / Math.max(chapter.total, 1)) * 100);
  return `
    <div class="city-chapter ${chapter.active ? "active" : ""} ${chapter.completed >= chapter.total ? "completed" : ""}">
      <strong>${escapeHtml(chapter.title)}</strong>
      <span>${chapter.completed}/${chapter.total}</span>
      ${progressBar(percent)}
    </div>
  `;
}

function renderChallengeItem(challenge, completed, context, completedLog = null) {
  const progress = completed ? { current: 1, target: 1, completed: true } : getChallengeProgress(challenge, context);
  const percent = completed ? 100 : Math.round((progress.current / Math.max(progress.target, 1)) * 100);
  const reward = formatChallengeReward(challenge.reward ?? completedLog ?? {});
  const difficultyId = challenge.difficulty ?? completedLog?.difficulty ?? "easy";
  const difficulty = getChallengeDifficultyLabel(difficultyId);
  const category = challenge.category ?? "task";
  const progressText = completed ? "Выполнено" : `${progress.current}/${progress.target}`;
  const completedAt = completedLog?.completedAt ? formatDateShort(completedLog.completedAt) : "";

  return `
    <div class="challenge-item ${completed ? "completed" : ""} difficulty-${escapeHtml(difficultyId)}">
      <div class="challenge-copy">
        <div class="challenge-headline">
          <strong>${escapeHtml(challenge.name)}</strong>
          <em>${escapeHtml(difficulty)}</em>
        </div>
        <span>${escapeHtml(challenge.description)}</span>
        <div class="challenge-meta">
          <small>${escapeHtml(categoryLabel(category))}</small>
          ${completedAt ? `<small>${escapeHtml(completedAt)}</small>` : ""}
        </div>
      </div>
      <div class="challenge-progress">
        <em>${escapeHtml(progressText)}</em>
        ${progressBar(percent)}
        <small class="reward-pill">${escapeHtml(reward)}</small>
      </div>
    </div>
  `;
}

function categoryLabel(category) {
  const labels = {
    starter: "старт",
    winning: "победа",
    decision: "решение",
    learning: "обучение",
    pot: "банк",
    collection: "коллекция",
    volume: "объём",
    hand_made: "комбинация",
    city: "город",
    poker: "покер",
    work: "работа",
    life: "жизнь",
    housing: "жильё",
    property: "имущество",
    business: "бизнес",
    club: "клуб",
    money: "деньги",
    reputation: "репутация",
  };
  return labels[category] ?? category ?? "задание";
}

function formatDateShort(value) {
  try {
    return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit" }).format(new Date(value));
  } catch (error) {
    return "";
  }
}

function formatChallengeReward(reward = {}) {
  const parts = [];
  if (reward.xp) parts.push(`XP +${reward.xp}`);
  if (reward.reputation) parts.push(`Rep +${reward.reputation}`);
  return parts.join(" · ") || "—";
}
