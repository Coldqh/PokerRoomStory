import { createNewCareer, createNewPlayer, ensureActiveChallenges, normalizeCareer, normalizePlayer } from "../engine/career.js?v=2.1.0";
import { normalizeClubNpcState } from "../engine/club.js?v=2.1.0";
import { createInitialTableState } from "../engine/poker.js?v=2.1.0";
import { getSaveInfo, loadSave, saveGame } from "../engine/save.js?v=2.1.0";
import { getDefaultStartLocation } from "../engine/selectors.js?v=2.1.0";
import { APP_VERSION, BUILD_ID } from "../config/appMeta.js?v=2.1.0";
import { getRuntimeStatus } from "../engine/update.js?v=2.1.0";

export const stateController = {
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
      currentScreen: "life",
      activeClubId: startLocation.clubId,
      activeTableId: startLocation.tableId,
      tableSession: null,
      tableState: createInitialTableState(),
      log: [`Patch v${APP_VERSION} · life hub.`],
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
  },

  sanitizeLoadedTableState(tableState, saveMeta = null) {
    if (!tableState) return { tableState: createInitialTableState(), notice: null };

    const phase = tableState.phase ?? "idle";
    const activeHand = !["idle", "finished", "folded"].includes(phase);
    const saveVersion = saveMeta?.appVersion ?? "0.0.0";
    const cameFromUnsafeTimeline = activeHand && isVersionBefore(saveVersion, "1.1.0");
    const currentActor = getPlainSeatById(tableState, tableState.currentActorId);
    const brokenActor = Boolean(currentActor && (currentActor.folded || currentActor.allIn));

    if (cameFromUnsafeTimeline || brokenActor) {
      return {
        tableState: createInitialTableState(),
        notice: "Активная раздача сброшена после обновления. Прогресс сохранён.",
      };
    }

    return { tableState, notice: null };
  },

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
  },

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
  },

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
};

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

function clampMoney(value) {
  return Math.max(0, Math.round(Number(value) || 0));
}

function createDefaultSettings() {
  return {
    animationSpeed: "normal",
  };
}
