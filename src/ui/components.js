import { cardLabel, cardRankLabel, isRedSuit } from "../engine/cards.js?v=0.4.1";

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function badge(label, variant = "") {
  return `<span class="badge ${variant}">${escapeHtml(label)}</span>`;
}

export function badges(labels, variant = "") {
  return `<div class="badges">${labels.map((label) => badge(label, variant)).join("")}</div>`;
}

export function playingCards(cards, options = {}) {
  const opts = typeof options === "boolean" ? { hidden: options } : options;
  const { hidden = false, highlightedIds = new Set(), size = "normal" } = opts;
  const highlightSet = highlightedIds instanceof Set ? highlightedIds : new Set(highlightedIds ?? []);

  if (!cards?.length) return `<div class="playing-cards ${size}"><span class="playing-card hidden" aria-label="Закрытая карта"><span class="card-back-emblem">PRS</span></span></div>`;

  return `<div class="playing-cards ${size}">${cards
    .map((card) => {
      const classes = ["playing-card"];
      if (hidden) classes.push("hidden");
      if (!hidden && isRedSuit(card)) classes.push("red");
      if (!hidden && highlightSet.has(card.id)) classes.push("made");
      const rank = escapeHtml(cardRankLabel(card));
      const suit = escapeHtml(card.suit);
      return `
        <span class="${classes.join(" ")}" title="${hidden ? "Закрытая карта" : escapeHtml(cardLabel(card))}">
          ${hidden ? `<span class="card-back-emblem">PRS</span>` : `
            <span class="card-corner card-corner-top"><b>${rank}</b><i>${suit}</i></span>
            <span class="card-center-suit">${suit}</span>
            <span class="card-corner card-corner-bottom"><b>${rank}</b><i>${suit}</i></span>
          `}
        </span>
      `;
    })
    .join("")}</div>`;
}

export function statPill(label, value, variant = "") {
  return `<div class="stat-pill ${variant}"><small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong></div>`;
}

export function progressBar(percent) {
  return `<div class="progressbar"><span style="width:${Math.max(0, Math.min(100, percent))}%"></span></div>`;
}

export function emptyState(text) {
  return `<div class="empty-state"><p>${escapeHtml(text)}</p></div>`;
}

export function metric(label, value, hint = "") {
  return `
    <div class="metric">
      <small>${escapeHtml(label)}</small>
      <strong>${escapeHtml(value)}</strong>
      ${hint ? `<span>${escapeHtml(hint)}</span>` : ""}
    </div>
  `;
}
