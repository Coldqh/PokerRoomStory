// Shared UI screen helpers. Keep pure and dependency-free.

export function formatDateTime(value) {
  try {
    return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
  } catch (error) {
    return "—";
  }
}

export function stableIndex(value, modulo) {
  let hash = 0;
  for (const char of String(value ?? "")) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return modulo ? hash % modulo : 0;
}

export function winRate(player) {
  if (!player?.handsPlayed) return 0;
  return Math.round(((player.handsWon ?? 0) / Math.max(player.handsPlayed, 1)) * 100);
}

export function speedLabel(value) {
  const labels = {
    normal: "Обычный",
    fast: "Быстрый",
    instant: "Мгновенный",
  };
  return labels[value] ?? labels.normal;
}

export function isPlayerWinner(hand) {
  return isSeatWinner(hand, "player");
}

export function isSeatWinner(hand, seatId) {
  const winnerId = String(hand?.lastResult?.winnerId ?? hand?.lastResult?.winner ?? "");
  return winnerId.split(",").includes(seatId);
}

export function initials(name) {
  return String(name ?? "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function shortName(name) {
  const parts = String(name ?? "").split(/\s+/).filter(Boolean);
  if (parts.length <= 2) return name;
  return `${parts[0]} ${parts[1]}`;
}

export function actionLabel(action) {
  const labels = {
    blind: "Blind",
    sb: "SB",
    bb: "BB",
    ready: "Ready",
    fold: "Fold",
    folded: "Fold",
    call: "Call",
    check: "Check",
    bet: "Bet",
    raise: "Raise",
    "all-in": "All-in",
  };
  return labels[action] ?? "Ready";
}

export function actionTitle(action) {
  const labels = {
    shuffle: "Deal",
    blind: "Blinds",
    deal: "Cards",
    fold: "Fold",
    call: "Call",
    check: "Check",
    bet: "Bet",
    raise: "Raise",
    flop: "Flop",
    turn: "Turn",
    river: "River",
    showdown: "Showdown",
    show: "Reveal",
    winner: "Winner",
    log: "Log",
  };
  return labels[action] ?? action;
}

export function cleanEventText(event) {
  if (!event) return "";
  if (event.action === "winner") return event.message;
  if (["flop", "turn", "river"].includes(event.action)) return event.message;
  if (event.amount) return `$${event.amount}`;
  return event.message.replace(event.actorName, "").replace(/^[\s·:—-]+/, "").trim();
}
