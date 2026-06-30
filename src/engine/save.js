import { APP_VERSION, CONTENT_VERSION, SAVE_SCHEMA_VERSION } from "../config/appMeta.js?v=0.5.3";
import { hydrateNpc } from "./npc.js?v=0.5.3";

const CURRENT_SAVE_KEY = "prs.save.current";
const BACKUP_SAVE_KEY = "prs.save.backup";
const LEGACY_SAVE_KEYS = ["poker-room-story-v0-1-save"];
const MAX_LOG_LINES = 100;

export function loadSave(content) {
  const loaded = readFirstAvailableSave();
  if (!loaded) return null;

  try {
    const migrated = migrateSave(loaded.data, loaded.key);
    const payload = hydratePayload(migrated.payload, content);

    return {
      ...payload,
      saveMeta: {
        ...migrated.meta,
        sourceKey: loaded.key,
        migrated: migrated.migrated,
        restoredFromBackup: loaded.key === BACKUP_SAVE_KEY,
      },
    };
  } catch (error) {
    console.warn("Save migration failed", error);

    if (loaded.key !== BACKUP_SAVE_KEY) {
      const backup = readRawSave(BACKUP_SAVE_KEY);
      if (backup) {
        try {
          const migratedBackup = migrateSave(backup, BACKUP_SAVE_KEY);
          return {
            ...hydratePayload(migratedBackup.payload, content),
            saveMeta: {
              ...migratedBackup.meta,
              sourceKey: BACKUP_SAVE_KEY,
              migrated: migratedBackup.migrated,
              restoredFromBackup: true,
            },
          };
        } catch (backupError) {
          console.warn("Backup save restore failed", backupError);
        }
      }
    }

    return null;
  }
}

export function saveGame(state) {
  const previousRaw = localStorage.getItem(CURRENT_SAVE_KEY);
  const previousMeta = safeParse(previousRaw)?.meta ?? null;
  const envelope = createEnvelope(state, previousMeta);
  const nextRaw = JSON.stringify(envelope);

  if (previousRaw && previousRaw !== nextRaw) {
    localStorage.setItem(BACKUP_SAVE_KEY, previousRaw);
  }

  localStorage.setItem(CURRENT_SAVE_KEY, nextRaw);
  return envelope.meta;
}

export function clearSave() {
  localStorage.removeItem(CURRENT_SAVE_KEY);
  localStorage.removeItem(BACKUP_SAVE_KEY);
  for (const key of LEGACY_SAVE_KEYS) localStorage.removeItem(key);
}

export function getSaveInfo() {
  const raw = localStorage.getItem(CURRENT_SAVE_KEY);
  if (!raw) return { exists: false };

  try {
    const parsed = JSON.parse(raw);
    const meta = parsed.meta ?? {};
    return {
      exists: true,
      schemaVersion: meta.schemaVersion ?? 1,
      appVersion: meta.appVersion ?? "legacy",
      updatedAt: meta.updatedAt ?? null,
      sizeKb: Math.ceil(new Blob([raw]).size / 1024),
    };
  } catch (error) {
    return { exists: true, corrupted: true };
  }
}

export function exportCurrentSave() {
  const raw = localStorage.getItem(CURRENT_SAVE_KEY);
  if (raw) return raw;
  return JSON.stringify({ meta: { exportedAt: new Date().toISOString(), empty: true }, payload: null }, null, 2);
}

export function importSaveText(text, content) {
  const parsed = JSON.parse(text);
  const migrated = migrateSave(parsed, "import");
  const payload = hydratePayload(migrated.payload, content);
  const envelope = normalizeEnvelope(migrated.payload, {
    importedAt: new Date().toISOString(),
    importedFromVersion: migrated.meta.appVersion ?? "unknown",
  });

  const previousRaw = localStorage.getItem(CURRENT_SAVE_KEY);
  if (previousRaw) localStorage.setItem(BACKUP_SAVE_KEY, previousRaw);
  localStorage.setItem(CURRENT_SAVE_KEY, JSON.stringify(envelope));

  return {
    ...payload,
    saveMeta: {
      ...envelope.meta,
      imported: true,
    },
  };
}

function safeParse(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

function readFirstAvailableSave() {
  const current = readRawSave(CURRENT_SAVE_KEY);
  if (current) return { key: CURRENT_SAVE_KEY, data: current };

  for (const key of LEGACY_SAVE_KEYS) {
    const legacy = readRawSave(key);
    if (legacy) return { key, data: legacy };
  }

  const backup = readRawSave(BACKUP_SAVE_KEY);
  if (backup) return { key: BACKUP_SAVE_KEY, data: backup };

  return null;
}

function readRawSave(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.warn(`Save read failed: ${key}`, error);
    return null;
  }
}

function createEnvelope(state, previousMeta = null) {
  const patch = {};
  if (previousMeta?.createdAt) patch.createdAt = previousMeta.createdAt;
  return normalizeEnvelope(makePayload(state), patch);
}

function normalizeEnvelope(payload, patch = {}) {
  const now = new Date().toISOString();
  return {
    meta: {
      schemaVersion: SAVE_SCHEMA_VERSION,
      appVersion: APP_VERSION,
      contentVersion: CONTENT_VERSION,
      ...patch,
      createdAt: patch.createdAt ?? now,
      updatedAt: now,
    },
    payload,
  };
}

function migrateSave(data, sourceKey) {
  if (data?.meta && data?.payload) {
    const schemaVersion = Number(data.meta.schemaVersion ?? 1);
    if (schemaVersion === SAVE_SCHEMA_VERSION) {
      return { payload: data.payload, meta: data.meta, migrated: false };
    }

    return {
      payload: migratePayload(data.payload ?? {}, schemaVersion),
      meta: {
        ...data.meta,
        schemaVersion: SAVE_SCHEMA_VERSION,
        appVersion: APP_VERSION,
        migratedFromSchema: schemaVersion,
        migratedAt: new Date().toISOString(),
      },
      migrated: true,
    };
  }

  const legacyPayload = migrateLegacyFlatSave(data ?? {});
  return {
    payload: legacyPayload,
    meta: {
      schemaVersion: SAVE_SCHEMA_VERSION,
      appVersion: APP_VERSION,
      contentVersion: CONTENT_VERSION,
      migratedFrom: sourceKey,
      migratedAt: new Date().toISOString(),
    },
    migrated: true,
  };
}

function migratePayload(payload, fromSchema) {
  if (fromSchema <= 1) return migrateLegacyFlatSave(payload);
  return payload;
}

function migrateLegacyFlatSave(flat) {
  return {
    player: flat.player,
    career: flat.career,
    knownNpcIds: flat.knownNpcIds ?? [],
    clubNpcState: flat.clubNpcState ?? {},
    tableState: flat.tableState ?? null,
    currentScreen: flat.currentScreen ?? "club",
    activeClubId: flat.activeClubId ?? "CLUB_RU_BASEMENT_RIVER_001",
    activeTableId: flat.activeTableId ?? "TABLE_RU_BRR_LOW_001",
    log: Array.isArray(flat.log) ? flat.log.slice(-MAX_LOG_LINES) : [],
    settings: flat.settings ?? {},
  };
}

function makePayload(state) {
  return {
    player: state.player,
    career: state.career,
    knownNpcIds: state.knownNpcIds ?? [],
    clubNpcState: state.clubNpcState ?? {},
    tableState: serializeTableState(state.tableState),
    currentScreen: state.currentScreen,
    activeClubId: state.activeClubId,
    activeTableId: state.activeTableId,
    log: (state.log ?? []).slice(-MAX_LOG_LINES),
    settings: state.settings ?? {},
  };
}

function serializeTableState(tableState) {
  if (!tableState) return null;

  const sanitizeSeat = (seat) => {
    if (!seat) return null;
    const { npc, ...rest } = seat;
    return {
      ...rest,
      npcId: npc?.id ?? seat.npcId ?? null,
    };
  };

  return {
    ...tableState,
    deck: Array.isArray(tableState.deck) ? tableState.deck : [],
    heroSeat: sanitizeSeat(tableState.heroSeat),
    npcSeats: (tableState.npcSeats ?? []).map(sanitizeSeat).filter(Boolean),
    animation: {
      isPlaying: false,
      index: 0,
      total: 0,
      currentEvent: null,
      recentEvents: tableState.animation?.recentEvents?.slice(-5) ?? [],
      revealedCommunityCount: getSafeRevealCount(tableState),
      showWinner: tableState.phase === "finished" || tableState.phase === "folded",
    },
  };
}

function hydratePayload(payload, content) {
  if (!payload) return null;
  return {
    ...payload,
    tableState: hydrateTableState(payload.tableState, content),
    log: Array.isArray(payload.log) ? payload.log.slice(-MAX_LOG_LINES) : [],
    settings: payload.settings ?? {},
  };
}

function hydrateTableState(tableState, content) {
  if (!tableState) return null;

  const hydrateSeat = (seat) => {
    if (!seat) return null;
    const npcId = seat.npcId ?? seat.npc?.id ?? null;
    const rawNpc = npcId ? content?.byId?.npcs?.[npcId] ?? seat.npc ?? null : null;
    return {
      ...seat,
      npc: rawNpc ? hydrateNpc(content, rawNpc) : null,
    };
  };

  const hydrated = {
    ...tableState,
    heroSeat: hydrateSeat(tableState.heroSeat),
    npcSeats: (tableState.npcSeats ?? []).map(hydrateSeat).filter(Boolean),
    animation: {
      isPlaying: false,
      index: 0,
      total: 0,
      currentEvent: null,
      recentEvents: tableState.animation?.recentEvents?.slice(-5) ?? [],
      revealedCommunityCount: getSafeRevealCount(tableState),
      showWinner: tableState.phase === "finished" || tableState.phase === "folded",
    },
  };

  return {
    ...hydrated,
    playerHoleCards: hydrated.heroSeat?.holeCards ?? hydrated.playerHoleCards ?? [],
    activeNpcSeats: hydrated.npcSeats.filter((seat) => !seat.folded).map((seat) => seat.id),
    playerInvested: hydrated.heroSeat?.invested ?? hydrated.playerInvested ?? 0,
  };
}

function getSafeRevealCount(tableState) {
  if (!tableState) return 0;
  if (tableState.phase === "flop") return Math.min(3, tableState.communityCards?.length ?? 0);
  if (tableState.phase === "turn") return Math.min(4, tableState.communityCards?.length ?? 0);
  if (["river", "showdown", "finished", "folded"].includes(tableState.phase)) return Math.min(5, tableState.communityCards?.length ?? 0);
  return tableState.animation?.revealedCommunityCount ?? 0;
}
