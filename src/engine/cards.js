export const SUITS = ["♠", "♥", "♦", "♣"];
export const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"];

const RANK_VALUE = {
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  T: 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
};

const RANK_LABEL = {
  2: "2",
  3: "3",
  4: "4",
  5: "5",
  6: "6",
  7: "7",
  8: "8",
  9: "9",
  10: "10",
  11: "J",
  12: "Q",
  13: "K",
  14: "A",
};

const CATEGORY_NAMES = [
  "Старшая карта",
  "Пара",
  "Две пары",
  "Сет",
  "Стрит",
  "Флеш",
  "Фулл-хаус",
  "Каре",
  "Стрит-флеш",
];

const CATEGORY_KEYS = [
  "high_card",
  "pair",
  "two_pair",
  "three_of_a_kind",
  "straight",
  "flush",
  "full_house",
  "four_of_a_kind",
  "straight_flush",
];

export function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit, value: RANK_VALUE[rank], id: `${rank}${suit}` });
    }
  }
  return shuffle(deck);
}

export function draw(deck, count = 1) {
  return deck.splice(0, count);
}

export function cardRankLabel(card) {
  return rankLabel(card?.value) ?? String(card?.rank ?? "?");
}

export function cardLabel(card) {
  return `${cardRankLabel(card)}${card.suit}`;
}

export function isRedSuit(card) {
  return card.suit === "♥" || card.suit === "♦";
}

export function describeCards(cards) {
  return cards.map(cardLabel).join(" ");
}

export function rankLabel(value) {
  return RANK_LABEL[value] ?? String(value);
}

export function evaluateBestHand(cards) {
  if (!cards || cards.length < 5) {
    return {
      category: 0,
      categoryKey: "not_enough_cards",
      categoryName: "Недостаточно карт",
      tiebreakers: [],
      cards: [],
      score: 0,
      summary: "Нужно минимум 5 карт.",
    };
  }

  const combos = combinations(cards, 5);
  const evaluated = combos.map(evaluateFiveCards).sort(compareHands).reverse();
  return evaluated[0];
}

export function compareHands(a, b) {
  if (a.category !== b.category) return a.category - b.category;
  const max = Math.max(a.tiebreakers.length, b.tiebreakers.length);
  for (let i = 0; i < max; i += 1) {
    const av = a.tiebreakers[i] ?? 0;
    const bv = b.tiebreakers[i] ?? 0;
    if (av !== bv) return av - bv;
  }
  return 0;
}

export function estimatePreflopStrength(holeCards) {
  if (!holeCards || holeCards.length !== 2) return 0.2;

  const [a, b] = [...holeCards].sort((x, y) => y.value - x.value);
  const pair = a.value === b.value;
  const suited = a.suit === b.suit;
  const gap = Math.abs(a.value - b.value);
  const high = (a.value + b.value) / 28;

  let strength = high * 0.42;

  if (pair) strength += 0.35 + (a.value / 14) * 0.18;
  if (suited) strength += 0.07;
  if (gap === 1) strength += 0.07;
  if (gap === 2) strength += 0.04;
  if (a.value >= 12 && b.value >= 10) strength += 0.12;
  if (a.value < 10 && b.value < 7 && !pair) strength -= 0.12;

  return clamp(strength, 0.04, 0.98);
}

export function detectStartingHandUnlocks(holeCards) {
  if (!holeCards || holeCards.length !== 2) return [];
  const ranks = holeCards.map((card) => card.rank).sort().join("");
  const unlocks = [];

  if (ranks === "QQ") unlocks.push("deal_QQ");

  return unlocks;
}

export function getHandCardIds(hand) {
  return new Set((hand?.cards ?? []).map((card) => card.id));
}

function evaluateFiveCards(cards) {
  const sortedValues = cards.map((card) => card.value).sort((a, b) => b - a);
  const counts = countBy(sortedValues);
  const groups = Object.entries(counts)
    .map(([value, count]) => ({ value: Number(value), count }))
    .sort((a, b) => b.count - a.count || b.value - a.value);

  const flush = cards.every((card) => card.suit === cards[0].suit);
  const straightHigh = getStraightHigh(sortedValues);

  if (flush && straightHigh) return hand(8, [straightHigh], cards, buildStraightSummary(straightHigh));

  if (groups[0].count === 4) {
    const kicker = groups.find((group) => group.count === 1).value;
    return hand(7, [groups[0].value, kicker], cards, `Каре ${rankLabel(groups[0].value)}.`);
  }

  if (groups[0].count === 3 && groups[1]?.count === 2) {
    return hand(6, [groups[0].value, groups[1].value], cards, `Фулл-хаус: ${rankLabel(groups[0].value)} над ${rankLabel(groups[1].value)}.`);
  }

  if (flush) return hand(5, sortedValues, cards, `Флеш по ${cards[0].suit}.`);
  if (straightHigh) return hand(4, [straightHigh], cards, buildStraightSummary(straightHigh));

  if (groups[0].count === 3) {
    const kickers = groups.filter((group) => group.count === 1).map((group) => group.value).sort((a, b) => b - a);
    return hand(3, [groups[0].value, ...kickers], cards, `Сет ${rankLabel(groups[0].value)}.`);
  }

  if (groups[0].count === 2 && groups[1]?.count === 2) {
    const pairs = groups.filter((group) => group.count === 2).map((group) => group.value).sort((a, b) => b - a);
    const kicker = groups.find((group) => group.count === 1).value;
    return hand(2, [...pairs, kicker], cards, `Две пары: ${rankLabel(pairs[0])} и ${rankLabel(pairs[1])}.`);
  }

  if (groups[0].count === 2) {
    const kickers = groups.filter((group) => group.count === 1).map((group) => group.value).sort((a, b) => b - a);
    return hand(1, [groups[0].value, ...kickers], cards, `Пара ${rankLabel(groups[0].value)}.`);
  }

  return hand(0, sortedValues, cards, `Старшая карта ${rankLabel(sortedValues[0])}.`);
}

function hand(category, tiebreakers, cards, summary) {
  const sortedCards = sortBestCards(cards, category, tiebreakers);
  return {
    category,
    categoryKey: CATEGORY_KEYS[category],
    categoryName: CATEGORY_NAMES[category],
    tiebreakers,
    cards: sortedCards,
    cardIds: sortedCards.map((card) => card.id),
    score: category * 1_000_000 + tiebreakers.reduce((sum, value, index) => sum + value * Math.pow(15, 4 - index), 0),
    summary,
  };
}

function sortBestCards(cards, category, tiebreakers) {
  const copy = [...cards];
  if (category === 4 || category === 8) {
    const high = tiebreakers[0];
    const order = high === 5 ? [5, 4, 3, 2, 14] : [high, high - 1, high - 2, high - 3, high - 4];
    return order.map((value) => copy.find((card) => card.value === value)).filter(Boolean);
  }
  return copy.sort((a, b) => b.value - a.value);
}

function buildStraightSummary(high) {
  const values = high === 5 ? [14, 2, 3, 4, 5] : [high - 4, high - 3, high - 2, high - 1, high];
  return `Стрит: ${values.map(rankLabel).join("–")}. Старшая карта ${rankLabel(high)}.`;
}

function getStraightHigh(values) {
  const unique = [...new Set(values)].sort((a, b) => b - a);
  if (unique.includes(14)) unique.push(1);

  for (let i = 0; i <= unique.length - 5; i += 1) {
    const window = unique.slice(i, i + 5);
    const isStraight = window.every((value, index) => index === 0 || value === window[index - 1] - 1);
    if (isStraight) return window[0] === 1 ? 5 : window[0];
  }

  return null;
}

function combinations(items, size) {
  const result = [];

  function walk(start, combo) {
    if (combo.length === size) {
      result.push(combo);
      return;
    }

    for (let i = start; i < items.length; i += 1) {
      walk(i + 1, [...combo, items[i]]);
    }
  }

  walk(0, []);
  return result;
}

function countBy(values) {
  return values.reduce((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
