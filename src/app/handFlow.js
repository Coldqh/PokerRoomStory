import { buildClubHandPatch, getClubSnapshotForTable } from "../engine/club.js?v=1.2.0";
import { applyHandResult, addPlayerRewards, applyChallenges, normalizeCareer, updateCareerUnlocks } from "../engine/career.js?v=1.2.0";
import { applyUnlocks } from "../engine/collections.js?v=1.2.0";
import {
  advanceUntilPlayerOrEnd,
  applyPlayerAction,
  buildStartHandTimeline,
  createAnimationState,
  getUnlockConditionsFromHand,
  startNewHand,
} from "../engine/poker.js?v=1.2.0";
import { getClubContext } from "../engine/world.js?v=1.2.0";
import { applyClubProgression } from "../engine/progression.js?v=1.2.0";

export const handFlow = {
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
        notice: null,
      },
    }, { skipSave: true });

    if (auto.result) {
      this.playTimeline(auto.tableState, timeline, (animatedTableState) => {
        this.completeHand(auto.tableState, auto.result, animatedTableState);
      });
      return;
    }

    this.playTimeline(auto.tableState, timeline);
  },

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
  },

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
    const clubProgressResult = applyClubProgression({
      content: this.content,
      career: careerAfterUnlocks,
      clubId: this.state.activeClubId,
      tableState,
      result,
      challengeResult,
    });
    const careerAfterProgressUnlocks = updateCareerUnlocks(playerAfterHand, clubProgressResult.career, this.content);
    const careerAfterProgress = {
      ...careerAfterProgressUnlocks,
      clubProgress: clubProgressResult.career.clubProgress,
      unlockedCollections: clubProgressResult.career.unlockedCollections,
    };
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
    const progressLine = buildProgressLine({ xp: totalXp, reputation: totalRep, messages: [...unlockResult.messages, ...challengeResult.messages, ...clubPatch.clubMessages, ...clubProgressResult.messages] });
    const rewardToast = buildRewardToast(this.content, challengeResult, clubProgressResult);
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
      ...clubProgressResult.messages,
      progressLine,
    ].slice(-100);

    this.setState({
      player: playerAfterHand,
      career: careerAfterProgress,
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
  },

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
  },

  getEventDuration(event) {
    const base = eventDuration(event);
    const speed = this.state.settings?.animationSpeed ?? "normal";
    if (speed === "fast") return Math.max(260, Math.round(base * 0.58));
    if (speed === "instant") return Math.max(90, Math.round(base * 0.16));
    return base;
  }
};

function stripTimelineSnapshot(event) {
  if (!event) return event;
  const { snapshot: _snapshot, ...safeEvent } = event;
  return safeEvent;
}

function buildProgressLine({ xp, reputation, messages }) {
  const bits = [`XP +${xp}`];
  if (reputation > 0) bits.push(`Rep +${reputation}`);
  if (messages?.length) bits.push(`${messages.length} unlock`);
  return `Прогресс: ${bits.join(" · ")}`;
}

function buildRewardToast(content, challengeResult, clubProgressResult) {
  if (clubProgressResult?.levelUps?.length || clubProgressResult?.unlockedRewards?.length || clubProgressResult?.gain?.xp) {
    const reward = clubProgressResult.unlockedRewards?.[0];
    const level = clubProgressResult.levelUps?.at(-1);
    return {
      kicker: level || reward ? "Клубный прогресс" : "Room Mastery",
      title: level ? `River Room Lv.${level}` : reward?.name ? "Награда клуба" : "Club XP",
      reward: reward?.name ? `Открыто: ${reward.name}` : `Club XP +${clubProgressResult.gain?.xp ?? 0}`,
    };
  }

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

function eventDuration(event) {
  if (!event) return 650;
  if (["flop", "turn", "river", "showdown"].includes(event.action)) return 1050;
  if (event.action === "winner") return 1700;
  if (event.action === "shuffle" || event.action === "deal") return 900;
  return 700;
}
