export function applyUnlocks({ content, career, unlockConditions }) {
  const unlockedGlossary = new Set(career.unlockedGlossary);
  const unlockedCollections = new Set(career.unlockedCollections);
  const messages = [];
  let xpReward = 0;

  for (const term of content.glossaryTerms) {
    if (!unlockedGlossary.has(term.id) && unlockConditions.includes(term.unlockCondition)) {
      unlockedGlossary.add(term.id);
      messages.push(`Открыт термин: ${term.name} / ${term.localName}`);
      xpReward += 5;
    }
  }

  for (const item of content.collections) {
    const termUnlockedCondition = item.relatedTerm ? `unlock_${item.relatedTerm}` : null;
    const shouldUnlock =
      unlockConditions.includes(item.unlockCondition) ||
      (termUnlockedCondition && unlockConditions.includes(termUnlockedCondition));

    if (!unlockedCollections.has(item.id) && shouldUnlock) {
      unlockedCollections.add(item.id);
      messages.push(`Коллекция +1: ${item.name}`);
      xpReward += item.reward?.xp ?? 0;
    }
  }

  return {
    career: {
      ...career,
      unlockedGlossary: [...unlockedGlossary],
      unlockedCollections: [...unlockedCollections],
    },
    messages,
    xpReward,
  };
}
