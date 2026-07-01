export const eventTemplates = [
    {
      id: "EVENT_COLLECTION_UNLOCKED",
      type: "collection_event",
      requiredTags: ["starter"],
      triggerCondition: "collection_unlocked",
      cooldown: 0,
      rewardType: "xp",
      consequences: {},
      textKey: "collection_unlocked_default",
    },
    {
      id: "EVENT_FIRST_HAND_REVIEW",
      type: "learning_event",
      requiredTags: ["learning"],
      triggerCondition: "first_hand_completed",
      cooldown: 1,
      rewardType: "knowledge",
      consequences: {},
      textKey: "first_hand_review_default",
    },
  ];
