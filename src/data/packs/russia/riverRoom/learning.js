export const learningObjects = [
    {
      id: "LEARN_FIRST_HAND_POSITION",
      type: "post_hand_review",
      topic: "position",
      difficulty: 1,
      trigger: "first_hand_completed",
      shortExplanation: "Позиция решает. Чем позже ходишь, тем больше знаешь.",
      fullExplanation:
        "В будущем игра будет учитывать позицию глубже. Сейчас запомни базу: поздняя позиция обычно комфортнее для розыгрыша.",
      relatedGlossaryTerms: ["TERM_POKER_POSITION"],
      relatedChallenges: [],
      reward: { xp: 8 },
    },
    {
      id: "LEARN_CALLING_STATION_VALUE",
      type: "npc_tip",
      topic: "value_betting",
      difficulty: 1,
      trigger: "meet_ARCH_CALLING_STATION",
      shortExplanation: "Против телефона меньше блефуй и чаще ставь с готовой рукой.",
      fullExplanation:
        "Игроки, которые часто коллируют, плохо выбрасывают слабые руки. Против них прибыльнее добирать, а не изображать силу без руки.",
      relatedGlossaryTerms: ["TERM_POKER_VALUE_BET"],
      relatedChallenges: [],
      reward: { xp: 8 },
    },
  ];
