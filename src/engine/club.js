import { FALLBACK_START_LOCATION } from "./selectors.js?v=1.0.0";

const CLUB_EVENT_POOL = [
  {
    id: "CLUB_EVENT_LOOSE_TABLES",
    title: "Лузовый вечер",
    text: "За столами чаще смотрят флоп. Банки растут быстрее.",
    tone: "loose",
    effectLabel: "+коллы",
    modifier: { callBias: 0.12, raiseBias: 0.02, foldBias: -0.04 },
  },
  {
    id: "CLUB_EVENT_QUIET_ROOM",
    title: "Тихий зал",
    text: "Регуляры играют аккуратнее. Мусор чаще улетает в пас.",
    tone: "tight",
    effectLabel: "+дисциплина",
    modifier: { callBias: -0.04, raiseBias: -0.02, foldBias: 0.08 },
  },
  {
    id: "CLUB_EVENT_RED_CHIPS",
    title: "Красные фишки",
    text: "Несколько игроков пришли за экшеном. Рейзы появляются чаще.",
    tone: "hot",
    effectLabel: "+агрессия",
    modifier: { callBias: 0.04, raiseBias: 0.09, foldBias: -0.02 },
  },
  {
    id: "CLUB_EVENT_DEEP_FOCUS",
    title: "Плотный состав",
    text: "За столами больше регуляров. Ошибки стоят дороже.",
    tone: "focused",
    effectLabel: "+регуляры",
    modifier: { callBias: -0.02, raiseBias: 0.03, foldBias: 0.04 },
  },
];

const MOODS = {
  calm: { id: "calm", label: "Calm", short: "спокоен", modifier: { callBias: 0, raiseBias: 0, foldBias: 0 } },
  hot: { id: "hot", label: "Hot", short: "горячий", modifier: { callBias: 0.06, raiseBias: 0.07, foldBias: -0.04 } },
  tilted: { id: "tilted", label: "Tilted", short: "тильт", modifier: { callBias: 0.11, raiseBias: 0.04, foldBias: -0.08 } },
  locked: { id: "locked", label: "Locked In", short: "собран", modifier: { callBias: -0.04, raiseBias: -0.02, foldBias: 0.08 } },
  pressure: { id: "pressure", label: "Pressure", short: "давление", modifier: { callBias: 0.05, raiseBias: -0.03, foldBias: -0.02 } },
};

const MAX_JOURNAL = 28;
const DAY_LENGTH_HANDS = 6;

export function createClubRoomState(content, clubId) {
  const club = content?.byId?.clubs?.[clubId];
  const event = CLUB_EVENT_POOL[0];
  return {
    clubId,
    day: 1,
    handsToday: 0,
    clubRep: 0,
    activeEvent: cloneEvent(event),
    npcMoods: buildDefaultNpcMoods(content, club),
    featuredNpcIds: (club?.npcPool ?? []).slice(0, 3),
    journal: [journalLine("Клуб открыт. Низкие лимиты, знакомые лица, первый банк впереди.", "club")],
  };
}

export function normalizeClubNpcState(content, clubNpcState = {}, activeClubId = FALLBACK_START_LOCATION.clubId) {
  const source = isPlainObject(clubNpcState) ? clubNpcState : {};
  const next = { ...source };
  next[activeClubId] = normalizeClubRoomState(content, activeClubId, source[activeClubId]);
  return next;
}

export function getClubRoomState(content, clubNpcState = {}, clubId = FALLBACK_START_LOCATION.clubId) {
  return normalizeClubRoomState(content, clubId, clubNpcState?.[clubId]);
}

export function getClubSnapshotForTable(content, clubNpcState = {}, clubId, tableId) {
  const state = getClubRoomState(content, clubNpcState, clubId);
  return {
    clubId,
    tableId,
    day: state.day,
    clubRep: state.clubRep,
    activeEvent: state.activeEvent,
    npcMoods: state.npcMoods,
  };
}

export function getNpcMoodProfile(moodId = "calm") {
  return MOODS[moodId] ?? MOODS.calm;
}

export function buildClubHandPatch({ content, clubNpcState, clubId, tableState, result, challengeMessages = [] }) {
  const current = getClubRoomState(content, clubNpcState, clubId);
  const club = content?.byId?.clubs?.[clubId];
  const nextHandsToday = current.handsToday + 1;
  const newDay = nextHandsToday >= DAY_LENGTH_HANDS;
  const nextDay = newDay ? current.day + 1 : current.day;
  const nextEvent = newDay ? pickClubEvent(nextDay, tableState, result) : current.activeEvent;
  const repGain = getClubRepGain(tableState, result);
  const nextMoods = updateNpcMoods(current.npcMoods, tableState, result);
  const featuredNpcIds = pickFeaturedNpcIds(club, tableState, nextMoods);
  const journal = [
    ...current.journal,
    ...buildHandJournal(tableState, result, challengeMessages),
    ...(newDay ? [journalLine(`${nextEvent.title}: ${nextEvent.text}`, "event")] : []),
  ].slice(-MAX_JOURNAL);

  const roomState = {
    ...current,
    day: nextDay,
    handsToday: newDay ? 0 : nextHandsToday,
    clubRep: clamp(current.clubRep + repGain, 0, 999),
    activeEvent: nextEvent,
    npcMoods: nextMoods,
    featuredNpcIds,
    journal,
  };

  return {
    clubNpcState: {
      ...(clubNpcState ?? {}),
      [clubId]: roomState,
    },
    roomState,
    clubMessages: buildClubMessages(repGain, newDay, nextEvent),
  };
}

export function getClubRepInfo(roomState = {}) {
  const rep = Number(roomState.clubRep ?? 0);
  const tier = rep >= 80 ? "Клубное имя" : rep >= 40 ? "Узнают" : rep >= 15 ? "Замечают" : "Новый игрок";
  const next = rep >= 80 ? null : rep >= 40 ? 80 : rep >= 15 ? 40 : 15;
  const base = rep >= 40 ? 40 : rep >= 15 ? 15 : 0;
  const progress = next ? Math.round(((rep - base) / Math.max(1, next - base)) * 100) : 100;
  return { rep, tier, next, progress: clamp(progress, 0, 100) };
}

export function getClubMoodLabel(event = {}) {
  const labels = {
    loose: "живой стол",
    tight: "аккуратный зал",
    hot: "экшен",
    focused: "плотный состав",
  };
  return labels[event.tone] ?? "обычный вечер";
}

function normalizeClubRoomState(content, clubId, roomState = null) {
  const base = createClubRoomState(content, clubId);
  const source = isPlainObject(roomState) ? roomState : {};
  const activeEvent = normalizeEvent(source.activeEvent ?? base.activeEvent, base.day);
  const npcMoods = normalizeNpcMoods(content, clubId, source.npcMoods ?? base.npcMoods);
  const featuredNpcIds = safeArray(source.featuredNpcIds, base.featuredNpcIds).filter((id) => content?.byId?.npcs?.[id]);
  return {
    ...base,
    ...source,
    clubId,
    day: safeInt(source.day, base.day),
    handsToday: clamp(safeInt(source.handsToday, base.handsToday), 0, DAY_LENGTH_HANDS - 1),
    clubRep: clamp(safeInt(source.clubRep, base.clubRep), 0, 999),
    activeEvent,
    npcMoods,
    featuredNpcIds: featuredNpcIds.length ? featuredNpcIds.slice(0, 4) : base.featuredNpcIds,
    journal: safeArray(source.journal, base.journal).slice(-MAX_JOURNAL),
  };
}

function buildDefaultNpcMoods(content, club) {
  const npcIds = club?.npcPool ?? [];
  const moods = {};
  npcIds.forEach((id, index) => {
    moods[id] = index % 7 === 0 ? "hot" : index % 5 === 0 ? "locked" : "calm";
  });
  return moods;
}

function normalizeNpcMoods(content, clubId, moods = {}) {
  const club = content?.byId?.clubs?.[clubId];
  const next = {};
  for (const id of club?.npcPool ?? []) {
    next[id] = MOODS[moods[id]] ? moods[id] : "calm";
  }
  return next;
}

function updateNpcMoods(currentMoods = {}, tableState, result) {
  const next = { ...currentMoods };
  const seats = tableState?.npcSeats ?? [];
  const winnerIds = new Set(String(result?.winnerId ?? result?.winner ?? "").split(",").filter(Boolean));
  const showdown = Boolean(result?.showdown);

  for (const seat of seats) {
    if (!seat?.id) continue;
    if (winnerIds.has(seat.id)) {
      next[seat.id] = showdown ? "locked" : "hot";
    } else if (seat.folded) {
      next[seat.id] = next[seat.id] === "tilted" ? "pressure" : "calm";
    } else if (showdown) {
      next[seat.id] = next[seat.id] === "hot" ? "tilted" : "pressure";
    }
  }

  return next;
}

function pickFeaturedNpcIds(club, tableState, moods) {
  const current = (tableState?.npcSeats ?? []).map((seat) => seat.id).filter(Boolean);
  const hot = Object.entries(moods ?? {})
    .filter(([, mood]) => ["hot", "tilted", "locked", "pressure"].includes(mood))
    .map(([id]) => id);
  return [...new Set([...current, ...hot, ...(club?.npcPool ?? [])])].slice(0, 4);
}

function pickClubEvent(day, tableState, result) {
  if (result?.pot >= 200) return cloneEvent(CLUB_EVENT_POOL[2]);
  if (result?.showdown) return cloneEvent(CLUB_EVENT_POOL[3]);
  return cloneEvent(CLUB_EVENT_POOL[day % CLUB_EVENT_POOL.length]);
}

function buildHandJournal(tableState, result, challengeMessages = []) {
  const lines = [];
  const pot = Number(result?.pot ?? tableState?.pot ?? 0);
  const heroFolded = Boolean(tableState?.heroSeat?.folded || tableState?.lastPlayerAction === "fold");
  if (result?.winner === "player") lines.push(journalLine(`Ты забрал банк $${pot}.`, "win"));
  else if (heroFolded) lines.push(journalLine(`Ты сбросил. ${result?.winnerName ?? "Кто-то"} забрал банк $${pot}.`, "fold"));
  else lines.push(journalLine(`${result?.winnerName ?? "Стол"} забрал банк $${pot}.`, "hand"));

  if (pot >= 150) lines.push(journalLine(`Крупный банк: $${pot}. У стола стало громче.`, "pot"));
  for (const message of challengeMessages.slice(0, 2)) lines.push(journalLine(message, "task"));
  return lines;
}

function buildClubMessages(repGain, newDay, event) {
  const messages = [];
  if (repGain > 0) messages.push(`Club Rep +${repGain}`);
  if (newDay) messages.push(`Новый клубный фон: ${event.title}`);
  return messages;
}

function getClubRepGain(tableState, result) {
  let gain = 0;
  if (result?.winner === "player") gain += result.pot >= 150 ? 3 : 1;
  if (result?.showdown) gain += 1;
  if (result?.pot >= 200) gain += 2;
  if (tableState?.heroSeat?.folded) gain = Math.max(0, gain - 1);
  return gain;
}

function normalizeEvent(event, day) {
  const fallback = CLUB_EVENT_POOL[day % CLUB_EVENT_POOL.length] ?? CLUB_EVENT_POOL[0];
  const source = CLUB_EVENT_POOL.find((entry) => entry.id === event?.id) ?? event ?? fallback;
  return cloneEvent(source);
}

function cloneEvent(event) {
  return {
    id: event.id,
    title: event.title,
    text: event.text,
    tone: event.tone,
    effectLabel: event.effectLabel,
    modifier: { ...(event.modifier ?? {}) },
  };
}

function journalLine(text, type = "club") {
  return { id: `${Date.now()}_${Math.random().toString(16).slice(2)}`, text, type, at: new Date().toISOString() };
}

function safeArray(value, fallback = []) {
  return Array.isArray(value) ? value : [...fallback];
}

function safeInt(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number) : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function isPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}
