import { CITY_PROGRESSION } from "../../../cityProgression.js?v=3.7.1";

const SUPPORTED_STEP_TYPES = new Set([
  "club_hands",
  "table_hands",
  "club_wins",
  "table_wins",
  "club_showdowns",
  "club_big_pot",
  "player_reputation",
  "player_bankroll",
  "room_mastery_level",
]);

const CITY_META = {
  CITY_RU_NORTH_DISTRICT: cityMeta("Москва", "Russia Starter", "дешёвые подвалы, первые долги и первое уважение", [
    person("OLEG_RIVER", "Олег “Речной” Соколов", "первый владелец клуба", "Проверяет не слова, а то, как человек садится за стол."),
    person("MARINA_CASH", "Марина “Касса” Волкова", "кассир и floor manager", "Запоминает суммы, ошибки и тех, кто не спорит с правилами."),
    person("VIKTOR_BACK", "Виктор “Задняя” Мороз", "gatekeeper", "Открывает двери только тем, кто выдержал комнату."),
  ]),
  CITY_RU_SAINT_PETERSBURG_001: cityMeta("Санкт-Петербург", "Russia Starter", "холодные регуляры, длинные сессии и короткие разговоры", [
    person("HOST", "Илья “Невский” Громов", "хост северных комнат", "Смотрит спокойно, говорит сухо, уважает длинную дисциплину."),
    person("RIVAL", "Даша “Лёд” Крылова", "регуляр", "Не повышает голос и не прощает широких коллов."),
    person("CONNECTOR", "Семён Портной", "проводник по маршруту", "Знает, кто едет дальше, а кто остаётся в городе."),
  ]),
  CITY_RU_SOCHI_001: cityMeta("Сочи", "Russia Starter", "казино, туристические деньги и первый шум вокруг стека", [
    person("HOST", "Руслан “Курорт” Исаев", "casino floor", "Любит быстрые деньги и не любит бедных разговоров."),
    person("RIVAL", "Мила “Солнце” Белова", "турнирная регулярша", "Улыбается чаще, чем платит без причины."),
    person("CONNECTOR", "Георгий “Билет” Арсанов", "travel contact", "Знает, как вывести игрока на восточный маршрут."),
  ]),
  CITY_RU_VLADIVOSTOK_001: cityMeta("Владивосток", "Russia Starter", "порт, азиатские слухи и первый внешний контакт", [
    person("HOST", "Павел “Порт” Лазарев", "room owner", "Слышит о столах раньше, чем они появляются в городе."),
    person("RIVAL", "Никита “Туман” Власов", "местный регуляр", "Играет неровно, но давит, когда чувствует слабость."),
    person("CONNECTOR", "Анна Ли", "международный контакт", "Передаёт имя в Европу только после последней проверки."),
  ]),
  CITY_ES_BARCELONA_001: cityMeta("Barcelona", "Europe Test", "фестиваль, свет, толпа и первая международная сцена", [
    person("HOST", "Sofia “Ledger” Marquez", "festival organizer", "Ведёт списки, долги и рекомендации без лишних эмоций."),
    person("RIVAL", "Mateo Cruz", "loose festival regular", "Давит улыбкой и стеком, пока стол не отвечает."),
    person("CONNECTOR", "Iris Vidal", "European scout", "Смотрит, кто выдерживает публичный стол."),
  ]),
  CITY_DE_BERLIN_001: cityMeta("Berlin", "Europe Test", "математика, объём и сухая дисциплина", [
    person("HOST", "Klaus Reuter", "grinder captain", "Считает дистанцию и презирает эмоциональные решения."),
    person("RIVAL", "Mara Klein", "red-line regular", "Не говорит лишнего и давит размером ставок."),
    person("CONNECTOR", "Jonas Feld", "room broker", "Переводит результат в репутацию."),
  ]),
  CITY_UK_MANCHESTER_001: cityMeta("Manchester", "Europe Test", "закрытые клубы, старые знакомые и первая британская рекомендация", [
    person("HOST", "Aiden Cross", "private club connector", "Пускает не богатых, а рекомендованных."),
    person("RIVAL", "Mason Price", "member-room regular", "Проверяет терпение через маленькие банки."),
    person("CONNECTOR", "Eleanor Shaw", "old-money observer", "Отмечает, кто умеет молчать после проигрыша."),
  ]),
  CITY_FR_PARIS_001: cityMeta("Paris", "Europe Test", "salon etiquette, expensive silence and social pressure", [
    person("HOST", "Claire Duval", "salon host", "Проверяет, как игрок держится до первой карты."),
    person("RIVAL", "Luc Moreau", "salon regular", "Ставит так, будто делает замечание."),
    person("CONNECTOR", "Camille Roche", "European gatekeeper", "Даёт статус тем, кто не портит комнату."),
  ]),
  CITY_KR_SEOUL_001: cityMeta("Seoul", "Asia Discipline", "быстрые молодые столы, data thinking and pressure", [
    person("HOST", "Min-Jae Park", "tech-game regular", "Видит линии быстрее, чем люди успевают объяснить."),
    person("RIVAL", "Seo-Yun Han", "aggressive analyst", "Давит частотой, не громкостью."),
    person("CONNECTOR", "Joon Kim", "night-room fixer", "Связывает быстрых игроков с дорогими комнатами."),
  ]),
  CITY_JP_OSAKA_001: cityMeta("Osaka", "Asia Discipline", "action games, loud value and fast punishment", [
    person("HOST", "Hiro Tanaka", "room host", "Любит игроков, которые платят за ошибку сразу."),
    person("RIVAL", "Yuki “Spark” Mori", "action regular", "Разгоняет банк раньше, чем стол готов."),
    person("CONNECTOR", "Emi Sato", "Tokyo contact", "Смотрит, можно ли вести тебя в тихие комнаты."),
  ]),
  CITY_JP_TOKYO_001: cityMeta("Tokyo", "Asia Discipline", "corporate rooms, quiet pressure and clean decisions", [
    person("HOST", "Kenji Sato", "corporate room player", "Не объясняет игру. Он требует точности."),
    person("RIVAL", "Nao Fujimoto", "silent regular", "Снимает фишки без лишнего движения."),
    person("CONNECTOR", "Akira Watanabe", "cross-border contact", "Даёт дорогу к tech money."),
  ]),
  CITY_US_MIAMI_001: cityMeta("Miami", "America Pressure", "luxury tourists, loud money and unstable stacks", [
    person("HOST", "Diego Santos", "beach room host", "Собирает туристов и следит, кто забирает их деньги."),
    person("RIVAL", "Vanessa Reed", "luxury cash regular", "Улыбается за столом и режет ставки без пауз."),
    person("CONNECTOR", "Noah Blake", "US route contact", "Знает дорогу к finance rooms."),
  ]),
  CITY_US_NEW_YORK_001: cityMeta("New York", "America Pressure", "finance rooms, private offices and expensive patience", [
    person("HOST", "Ethan Ward", "finance game host", "Считает время дороже фишек."),
    person("RIVAL", "Rachel Stone", "Wall Street regular", "Не верит в истории, только в сайзинг."),
    person("CONNECTOR", "Miles Grant", "private list keeper", "Вносит имя туда, где нет вывесок."),
  ]),
  CITY_UK_LONDON_001: cityMeta("London", "Europe Elite", "member rooms, old money and quiet judgement", [
    person("HOST", "Aiden Cross", "old-money connector", "Возвращается, чтобы проверить, вырос ли игрок."),
    person("RIVAL", "Arthur Bell", "member-room rival", "Давит статусом и короткими вопросами."),
    person("CONNECTOR", "Isla Morgan", "elite room manager", "Отличает деньги от допуска."),
  ]),
  CITY_CN_SHENZHEN_001: cityMeta("Shenzhen", "Asia Money", "tech founders, fast capital and sharp reads", [
    person("HOST", "Wei Zhang", "tech money host", "Собирает людей, которые считают риск продуктом."),
    person("RIVAL", "Lin Zhao", "startup regular", "Играет резко, будто закрывает сделку."),
    person("CONNECTOR", "Mei Chen", "Shanghai contact", "Передаёт только тех, кто выдержал скорость."),
  ]),
  CITY_CN_SHANGHAI_001: cityMeta("Shanghai", "Asia Money", "tower rooms, corporate pressure and clean money", [
    person("HOST", "Victor Shen", "tower room host", "Держит стол ровно и дорого."),
    person("RIVAL", "Qiao Lin", "corporate regular", "Проверяет стек через длинные раздачи."),
    person("CONNECTOR", "Liang “Pearl” Wen", "Hong Kong network operator", "Впервые появляется как настоящий маршрутный проводник."),
  ]),
  CITY_HK_HONG_KONG_001: cityMeta("Hong Kong", "Asia Money", "finance elite, harbour rooms and Macau warning", [
    person("HOST", "Liang “Pearl” Wen", "network operator", "Говорит мало, но каждое слово открывает следующий уровень."),
    person("RIVAL", "Nathan Chow", "finance elite regular", "Покупает давление размером банка."),
    person("CONNECTOR", "Grace Lau", "Macau contact", "Предупреждает, что Macau не про красивые истории."),
  ]),
  CITY_US_LA_001: cityMeta("Los Angeles", "America Pressure", "celebrity games, ego and private mansions", [
    person("HOST", "Marcus Vale", "mansion game host", "Пускает туда, где деньги громче правил."),
    person("RIVAL", "Adrian Kade", "route antagonist", "Пытается забрать место героя в каждом дорогом городе."),
    person("CONNECTOR", "Lena Frost", "Vegas scout", "Смотрит, выдерживает ли игрок публичное унижение."),
  ]),
  CITY_US_LAS_VEGAS_001: cityMeta("Las Vegas", "World Stage", "old strip, public pressure and world proof", [
    person("HOST", "Jack “Old Strip” Harlan", "Vegas veteran", "Видел слишком много игроков, которые называли себя будущими."),
    person("RIVAL", "Adrian Kade", "route antagonist", "Приходит уже не дразнить, а выбить из маршрута."),
    person("CONNECTOR", "Nora Bell", "Monaco contact", "Знает, кто после Vegas имеет право на тишину Monaco."),
  ]),
  CITY_MC_MONACO_001: cityMeta("Monaco", "Endgame Luxury", "luxury gate, social pressure and final etiquette", [
    person("HOST", "Isabelle Roche", "luxury gatekeeper", "Проверяет не руку, а право сидеть за дорогим столом."),
    person("RIVAL", "Adrian Kade", "last gate rival", "Пытается купить финальное место репутацией."),
    person("CONNECTOR", "Liang “Pearl” Wen", "Macau operator", "Даёт последний билет только после Monaco."),
  ]),
  CITY_MO_MACAU_001: cityMeta("Macau", "Endgame Cash", "VIP towers, silent cash and final pressure", [
    person("HOST", "Liang “Pearl” Wen", "Macau network operator", "Больше не предупреждает. Просто открывает дверь."),
    person("RIVAL", "Chen “White Dragon” Rui", "final opponent", "Тихий, дорогой, опасный. Не играет лишних банков."),
    person("CONNECTOR", "Марина “Касса” Волкова", "route witness", "Приезжает не помогать, а увидеть, чем закончился первый buy-in."),
  ]),
};

export function buildWorldStoryCampaign({ cities = [], clubs = [], tables = [], manualStorylines = [] } = {}) {
  const cleanManualStorylines = manualStorylines.filter(Boolean);
  const chain = buildClubChain(cities, clubs);
  const nextByClubId = buildNextClubMap(chain);
  const manualClubIds = new Set(cleanManualStorylines.map((story) => story.clubId));
  const generated = chain
    .filter((club) => !manualClubIds.has(club.id))
    .map((club) => createStoryline({ club, chain, nextByClubId, tables }));
  const patchedManual = cleanManualStorylines.map((story) => expandManualStoryToTwelve(applyChainUnlockToManualStory(story, nextByClubId.get(story.clubId)), nextByClubId.get(story.clubId)));
  return [...patchedManual, ...generated];
}

export function getWorldStoryRoute({ cities = [], clubs = [] } = {}) {
  return buildClubChain(cities, clubs).map((club, index) => ({ order: index + 1, clubId: club.id, cityId: club.cityId, clubName: club.name }));
}

function createStoryline({ club, chain, nextByClubId, tables }) {
  const city = CITY_PROGRESSION.find((entry) => entry.cityId === club.cityId) ?? null;
  const cityMetaValue = CITY_META[club.cityId] ?? cityMeta(city?.name ?? "City", city?.act ?? "World Route", "дорогой покерный маршрут", []);
  const cityClubs = chain.filter((entry) => entry.cityId === club.cityId);
  const clubIndex = Math.max(0, cityClubs.findIndex((entry) => entry.id === club.id));
  const routeIndex = Math.max(0, chain.findIndex((entry) => entry.id === club.id));
  const clubTables = tables.filter((table) => table.clubId === club.id);
  const table = clubTables[0] ?? null;
  const topBlind = Math.max(...clubTables.map((entry) => Number(entry.bigBlind ?? 0)), Number(city?.topBigBlind ?? 2));
  const unlock = makeUnlock(nextByClubId.get(club.id));
  const final = club.id === chain.at(-1)?.id;
  const role = ["Entry Room", "Main Room", "Final Room"][clubIndex] ?? "Room";
  const characters = buildCharacters(club.cityId, cityMetaValue, final);
  const common = {
    city,
    meta: cityMetaValue,
    club,
    role,
    clubIndex,
    routeIndex,
    table,
    topBlind,
    characters,
    unlock,
    final,
  };

  return {
    id: `STORY_WORLD_${pad(routeIndex + 1)}_${slug(club.cityId)}_${slug(club.id)}`,
    clubId: club.id,
    title: final ? "Macau VIP Tower Finale" : `${cityMetaValue.name}: ${role}`,
    label: final ? "Финал Красного маршрута" : `${cityMetaValue.name} route · ${role}`,
    intro: final
      ? "Последняя дверь маршрута открывается в Macau. За столом уже сидят те, кто не верит в случайные истории."
      : `${cityMetaValue.name}. ${cityMetaValue.theme}. Новый клуб проверяет, стоит ли твоё имя следующей рекомендации.`,
    statusLabel: final ? "World finale" : `${cityMetaValue.act} · Stage ${city?.order ?? routeIndex + 1}`,
    unlocks: final ? { finalCampaignComplete: true, clubLabel: "Красный маршрут завершён" } : unlock,
    characters,
    steps: final ? createFinalSteps(common) : createStandardSteps(common),
  };
}

function createStandardSteps(ctx) {
  const repBase = 1 + Math.floor((ctx.city?.order ?? 1) / 5) + ctx.clubIndex;
  const xpBase = 40 + (ctx.city?.order ?? 1) * 12 + ctx.clubIndex * 25;
  const clubHandsBase = 3 + ctx.clubIndex;
  const tableHandsBase = 2 + ctx.clubIndex;
  const bigPot = Math.max(60, ctx.topBlind * (16 + ctx.clubIndex * 8));
  const biggerPot = Math.max(bigPot + ctx.topBlind * 10, ctx.topBlind * (30 + ctx.clubIndex * 10));
  const repTarget = Math.max(8 + (ctx.city?.order ?? 1) * 2 + ctx.clubIndex * 3, 12);
  const bankrollTarget = Math.max((ctx.city?.bankrollGate ?? 0) + ctx.topBlind * 120, ctx.topBlind * 350);
  const host = getCharacterId(ctx.club.cityId, "HOST");
  const rival = getCharacterId(ctx.club.cityId, "RIVAL");
  const connector = getCharacterId(ctx.club.cityId, "CONNECTOR");

  return [
    step("first_seat", "First Seat", `Сыграй ${clubHandsBase} руки в ${ctx.club.name}.`, "club_hands", clubHandsBase, reward(xpBase, repBase, 25 + ctx.city.order * 4), [host, connector], [
      `${ctx.meta.name}: ${ctx.club.name}. У входа уже знают, из какого города ты приехал.`,
      `${characterName(ctx.characters, host)} смотрит на стек, не на лицо.`,
      "Первое место за столом здесь не доверие. Это проверка.",
    ], `${ctx.club.name}: первый круг сыгран.`),
    step("show_cards", "Cards Under Light", "Дойди до шоудауна и покажи, что не боишься вскрытия.", "club_showdowns", 1 + (ctx.clubIndex === 2 ? 1 : 0), reward(xpBase + 15, repBase, 30 + ctx.city.order * 4), [rival, host], [
      `${characterName(ctx.characters, rival)} не говорит о силе руки. Он ждёт карт на столе.`,
      "В этой комнате вскрытие помнят лучше разговоров.",
      "Тебе нужно дойти до конца раздачи и не развалиться раньше ривера.",
    ], `${ctx.meta.name}: твоё вскрытие заметили.`),
    step("take_pot", "Take the Room", `Выиграй ${1 + Math.min(1, ctx.clubIndex)} руку в ${ctx.club.name}.`, "club_wins", 1 + Math.min(1, ctx.clubIndex), reward(xpBase + 30, repBase + 1, 35 + ctx.city.order * 5), [rival, connector], [
      "За этим столом уважение не дают за аккуратную посадку.",
      `${characterName(ctx.characters, connector)} смотрит на банк и делает короткую пометку.`,
      "Нужна победа. Не красивая, а настоящая.",
    ], `${ctx.club.name}: первая победа в маршруте закрыта.`),
    step("table_pace", "Table Pace", `Сыграй ${tableHandsBase + 2} рук за рабочим столом клуба.`, "table_hands", tableHandsBase + 2, reward(xpBase + 42, repBase + 1, 40 + ctx.city.order * 5), [host, rival], [
      `${characterName(ctx.characters, host)} переводит тебя к столу, где темп выше.`,
      "Там меньше разговоров и быстрее видно, кто платит за слабое решение.",
      "Нужно выдержать темп, а не одну удачную раздачу.",
    ], `${ctx.club.name}: темп комнаты стал понятнее.`),
    step("pressure_pot", "Pressure Pot", `Выиграй банк $${bigPot}+ в ${ctx.club.name}.`, "club_big_pot", bigPot, reward(xpBase + 55, repBase + 1, 45 + ctx.city.order * 6), [host, rival], [
      "Маленькие банки забывают. Большие банки меняют тон комнаты.",
      `${characterName(ctx.characters, host)} подходит ближе, когда фишки становятся слышны.`,
      "Этот банк должен открыть следующую дверь.",
    ], `${ctx.club.name}: крупный банк принят комнатой.`),
    step("rival_read", "Rival Read", `Дойди до ${2 + ctx.clubIndex} шоудаунов и пойми местного соперника.`, "club_showdowns", 2 + ctx.clubIndex, reward(xpBase + 70, repBase + 1, 52 + ctx.city.order * 6), [rival, connector], [
      `${characterName(ctx.characters, rival)} меняет линию и ждёт, заметишь ли ты это.`,
      "Один шоудаун показывает карты. Несколько показывают привычки.",
      "В этом клубе уже смотрят, умеешь ли ты учиться за столом.",
    ], `${ctx.club.name}: соперник больше не выглядит случайным шумом.`),
    step("second_win", "Second Mark", `Выиграй ${2 + Math.min(1, ctx.clubIndex)} руки в ${ctx.club.name}.`, "club_wins", 2 + Math.min(1, ctx.clubIndex), reward(xpBase + 86, repBase + 2, 60 + ctx.city.order * 6), [rival, host], [
      "Первая победа могла быть удачей. Вторая уже раздражает регулярных.",
      `${characterName(ctx.characters, host)} перестаёт проверять список и начинает смотреть на ход раздачи.`,
      "Комнате нужен повторяемый результат.",
    ], `${ctx.club.name}: вторая отметка поставлена.`),
    step("long_session", "Long Session", `Сыграй ${clubHandsBase + 7} рук и не потеряй маршрут.`, "club_hands", clubHandsBase + 7, reward(xpBase + 102, repBase + 2, 68 + ctx.city.order * 7), [host, connector], [
      "Короткая вспышка здесь никого не интересует.",
      `${characterName(ctx.characters, connector)} ждёт не банк, а дистанцию.`,
      "Длинная сессия показывает, кто привёз игру, а кто привёз настроение.",
    ], `${ctx.club.name}: длинная сессия выдержана.`),
    step("main_table_test", "Main Table Test", `Сыграй ${tableHandsBase + 5} рук на главном столе клуба.`, "table_hands", tableHandsBase + 5, reward(xpBase + 118, repBase + 2, 76 + ctx.city.order * 7), [rival, connector], [
      "Главный стол не выглядит иначе. Просто там дороже молчат.",
      `${characterName(ctx.characters, rival)} уже знает, зачем ты сел.`,
      "Нужно пройти через темп главного стола без лишних объяснений.",
    ], `${ctx.club.name}: главный стол больше не чужой.`),
    step("bigger_pot", "Bigger Pot", `Выиграй банк $${biggerPot}+ и заставь комнату замолчать.`, "club_big_pot", biggerPot, reward(xpBase + 136, repBase + 2, 86 + ctx.city.order * 8), [host, rival, connector], [
      "Крупный банк здесь уже не событие. Нужен банк, после которого меняется посадка за столом.",
      `${characterName(ctx.characters, connector)} наконец откладывает телефон.`,
      "Деньги должны сказать то, что не скажет хост.",
    ], `${ctx.club.name}: большой банк стал аргументом.`),
    step("reputation_mark", "Reputation Mark", `Набери ${repTarget} репутации для следующей рекомендации.`, "player_reputation", repTarget, reward(xpBase + 154, repBase + 3, 96 + ctx.city.order * 8), [host, connector], [
      "Репутация не лежит в кассе. Её пересылают между комнатами короткими фразами.",
      `${characterName(ctx.characters, host)} спрашивает не про руку, а про то, кто уже видел твою игру.`,
      "Перед выходом нужно оставить имя, которое не придётся объяснять.",
    ], `${ctx.meta.name}: рекомендация стала ближе.`),
    step("exit_door", "Exit Door", `Закрой ${ctx.club.name}: сыграй ${clubHandsBase + 10} рук и удержи банкролл $${bankrollTarget}+.`, "club_hands", clubHandsBase + 10, reward(xpBase + 180, repBase + 4, 115 + ctx.city.order * 9), [host, rival, connector], [
      `${characterName(ctx.characters, connector)} получает последнее подтверждение.`,
      `В ${ctx.meta.name} теперь знают не только твой стек, но и твой маршрут.`,
      "Следующая дверь не обещана. Её открывают результатом.",
    ], ctx.final ? "Маршрут закрыт." : `Открыт следующий шаг: ${ctx.unlock?.clubLabel ?? "новый клуб"}.`, ctx.unlock),
  ];
}

function createFinalSteps(ctx) {
  const host = getCharacterId(ctx.club.cityId, "HOST");
  const rival = getCharacterId(ctx.club.cityId, "RIVAL");
  const connector = getCharacterId(ctx.club.cityId, "CONNECTOR");
  const bigPot = Math.max(120000, ctx.topBlind * 30);
  const biggerPot = Math.max(bigPot * 2, ctx.topBlind * 55);
  return [
    step("macau_arrival", "The Last Door", "Сыграй 5 рук в финальном клубе Macau.", "club_hands", 5, reward(520, 12, 260), [host, connector], [
      "Macau не встречает громко. Дверь открывается тихо, и от этого тяжелее.",
      `${characterName(ctx.characters, host)} больше не предупреждает. Он просто показывает место.`,
      `${characterName(ctx.characters, connector)} смотрит на стол так, будто помнит первый московский buy-in.`,
    ], "Финальная комната приняла твою посадку."),
    step("liang_terms", "Liang's Terms", "Дойди до первого шоудауна и прими правила комнаты.", "club_showdowns", 1, reward(548, 12, 275), [host, connector], [
      "Liang не объясняет условия дважды.",
      "Первое вскрытие здесь нужно не тебе. Его ждёт комната.",
      "Карты должны лечь на стол без лишних слов.",
    ], "Liang увидел достаточно, чтобы оставить тебя в игре."),
    step("adrian_pressure", "Adrian Pressure", "Выиграй первую руку под давлением Adrian Kade.", "club_wins", 1, reward(580, 13, 295), [rival, connector], [
      "Adrian Kade больше не улыбается широко. Деньги слишком большие.",
      "Он ставит так, будто пытается купить весь маршрут целиком.",
      "Первый ответ должен быть не словами.",
    ], "Adrian перестал говорить первым."),
    step("white_dragon_read", "White Dragon Read", "Дойди до 2 шоудаунов против финальной комнаты.", "club_showdowns", 2, reward(610, 14, 315), [rival, host], [
      `${characterName(ctx.characters, rival)} почти не двигается. В его игре нет лишнего шума.`,
      "Здесь не показывают эмоции. Здесь показывают карты.",
      "Два вскрытия должны доказать, что ты не случайный гость финального стола.",
    ], "Chen Rui увидел твои карты и больше не смотрит сквозь тебя."),
    step("six_figure_pot", "Six-Figure Pot", `Выиграй банк $${bigPot}+ в Macau.`, "club_big_pot", bigPot, reward(650, 15, 330), [rival, connector], [
      "Фишки двигаются медленно. Сумма уже больше многих городов, через которые ты прошёл.",
      "Adrian Kade молчит впервые за весь маршрут.",
      `${characterName(ctx.characters, rival)} ждёт твоего решения без единого жеста.`,
    ], "Финальный банк меняет воздух в комнате."),
    step("silent_orbit", "Silent Orbit", "Сыграй 10 рук в Macau без ухода из маршрута.", "club_hands", 10, reward(680, 15, 350), [host, rival], [
      "Вокруг стола нет лишнего шума. Только фишки и короткие взгляды.",
      "Macau проверяет не раздачу, а выдержку.",
      "Длинный круг стоит дороже одной вспышки.",
    ], "Тихий круг выдержан."),
    step("monaco_echo", "Monaco Echo", "Набери 280 репутации перед финальным нажимом.", "player_reputation", 280, reward(710, 16, 370), [connector, host], [
      "Monaco был дверью. Macau — комната за ней.",
      `${characterName(ctx.characters, connector)} вспоминает имя Isabelle Roche без улыбки.`,
      "Статус должен выдержать последнюю цену.",
    ], "Репутация маршрута дошла до финального стола."),
    step("vegas_memory", "Vegas Memory", "Выиграй 2 руки в Macau finale.", "club_wins", 2, reward(740, 17, 395), [rival, connector], [
      "Vegas был шумным экзаменом. Здесь никто не смотрит на вывески.",
      "Adrian Kade пытается вернуть тот же нажим, но стол уже другой.",
      "Две победы должны показать, что публичная сцена не была случайностью.",
    ], "Vegas больше не висит за спиной."),
    step("hong_kong_debt", "Hong Kong Debt", `Выиграй банк $${biggerPot}+ в финальной комнате.`, "club_big_pot", biggerPot, reward(790, 18, 430), [host, connector], [
      "Hong Kong дал предупреждение. Macau требует оплату результатом.",
      "Liang смотрит на банк без движения.",
      "Такой банк не покупает финал. Он доказывает, что ты не ошибся дверью.",
    ], "Долг маршрута закрыт большим банком."),
    step("white_dragon_showdown", "White Dragon Showdown", "Дойди до 3 шоудаунов в Macau finale.", "club_showdowns", 3, reward(830, 20, 455), [rival, host], [
      "Chen Rui наконец меняет темп.",
      "Комната замечает это быстрее, чем дилер двигает фишки.",
      "Последнее вскрытие должно оставить ответ без споров.",
    ], "White Dragon признал, что ты читаешь не только карты."),
    step("final_wins", "Final Wins", "Выиграй 3 руки в Macau finale.", "club_wins", 3, reward(880, 22, 480), [rival, host, connector], [
      "Первая победа закрывает прошлое. Вторая оставляет имя. Третья убирает сомнения.",
      `${characterName(ctx.characters, connector)} больше не держит список. Он уже знает итог.`,
      "Macau не аплодирует. Macau запоминает.",
    ], "Финальный соперник признал игру без лишних слов."),
    step("red_route_complete", "Red Route Complete", "Сыграй последние 12 рук и заверши Красный маршрут.", "club_hands", 12, reward(950, 28, 540), [host, rival, connector], [
      "Олег, Марина, Виктор, Liang, Monaco, Vegas, Hong Kong — весь маршрут сжимается в последнем круге фишек.",
      "Chen Rui встаёт первым. Это не жест дружбы. Это признание результата.",
      "Красный маршрут заканчивается не титром, а пустым местом за столом, которое теперь принадлежит тебе.",
    ], "Красный маршрут завершён. Macau VIP Tower закрыт.", { finalCampaignComplete: true, clubLabel: "Macau VIP Tower Finale" }),
  ];
}

function applyChainUnlockToManualStory(story, nextClub) {
  const unlock = makeUnlock(nextClub);
  if (!unlock) return story;
  const steps = [...(story.steps ?? [])];
  const lastIndex = steps.length - 1;
  if (lastIndex >= 0) {
    steps[lastIndex] = { ...steps[lastIndex], unlocks: unlock };
  }
  return { ...story, unlocks: unlock, steps };
}

function expandManualStoryToTwelve(story, nextClub) {
  const unlock = makeUnlock(nextClub);
  const baseSteps = (story.steps ?? []).map((step) => ({ ...step }));
  const cleanedSteps = baseSteps.map((step, index) => index === baseSteps.length - 1 ? { ...step } : stripStepUnlock(step));
  const characters = story.characters ?? [];
  const ids = new Set(cleanedSteps.map((step) => step.id));
  const fallbackCharacterIds = characters.slice(0, 3).map((character) => character.id).filter(Boolean);
  const addStep = (raw) => {
    if (ids.has(raw.id)) raw = { ...raw, id: `${raw.id}_${cleanedSteps.length + 1}` };
    ids.add(raw.id);
    cleanedSteps.push(raw);
  };

  const templates = [
    ["late_pressure", "Late Pressure", "Сыграй ещё 4 руки и выдержи позднее давление комнаты.", "club_hands", 4, "Комната проверяет не старт, а то, как игрок держится позже."],
    ["second_showdown", "Second Showdown", "Дойди до ещё одного шоудауна и не прячь карты от комнаты.", "club_showdowns", 1, "Позднее вскрытие говорит больше ранней удачи."],
    ["route_bank", "Route Bank", "Выиграй заметный банк и закрепи право идти дальше.", "club_big_pot", 120, "Большой банк закрывает разговоры у кассы."],
    ["final_mark", "Final Mark", "Сыграй финальный круг перед следующим клубом.", "club_hands", 5, "Последний круг оставляет имя в маршруте."],
  ];

  while (cleanedSteps.length < 12) {
    const index = cleanedSteps.length;
    const template = templates[(index - baseSteps.length) % templates.length];
    addStep({
      id: template[0],
      title: template[1],
      objective: template[2],
      type: template[3],
      target: template[4],
      reward: { xp: 120 + index * 10, reputation: 2 + Math.floor(index / 4), clubXp: 80 + index * 8 },
      characterIds: fallbackCharacterIds,
      cutscene: [
        template[5],
        "Никто не подгоняет. Просто ждут результата.",
        "Следующая дверь открывается только после последней отметки.",
      ],
      completeMessage: `${story.title}: дополнительная отметка закрыта.`,
    });
  }

  const finalSteps = cleanedSteps.slice(0, 12).map((step, index) => index === 11
    ? { ...step, ...(unlock ? { unlocks: unlock } : {}) }
    : stripStepUnlock(step));

  return { ...story, ...(unlock ? { unlocks: unlock } : {}), steps: finalSteps };
}

function stripStepUnlock(step) {
  const { unlocks, ...rest } = step;
  return rest;
}

function buildClubChain(cities, clubs) {
  const cityOrder = new Map(CITY_PROGRESSION.map((entry) => [entry.cityId, entry.order]));
  const clubPosition = new Map(clubs.filter(Boolean).map((club, index) => [club.id, index]));
  return [...clubs]
    .filter(Boolean)
    .sort((left, right) => {
      const cityDelta = (cityOrder.get(left.cityId) ?? 999) - (cityOrder.get(right.cityId) ?? 999);
      if (cityDelta) return cityDelta;
      return (clubPosition.get(left.id) ?? 9999) - (clubPosition.get(right.id) ?? 9999);
    });
}

function buildNextClubMap(chain) {
  const map = new Map();
  for (let index = 0; index < chain.length; index += 1) {
    map.set(chain[index].id, chain[index + 1] ?? null);
  }
  return map;
}

function makeUnlock(nextClub) {
  if (!nextClub) return null;
  return {
    cityId: nextClub.cityId,
    clubId: nextClub.id,
    clubLabel: nextClub.name,
  };
}

function buildCharacters(cityId, meta, final) {
  const base = meta.characters.length ? meta.characters : [
    person("HOST", `${meta.name} Host`, "room host", "Ведёт комнату и следит за маршрутом."),
    person("RIVAL", `${meta.name} Rival`, "local rival", "Проверяет игрока через ставки и терпение."),
    person("CONNECTOR", `${meta.name} Connector`, "route connector", "Передаёт имя дальше только после результата."),
  ];
  const characters = base.map((entry) => ({ ...entry, id: getCharacterId(cityId, entry.key) }));
  if (!final && !characters.some((entry) => entry.name === "Adrian Kade") && ["CITY_US_LA_001", "CITY_US_LAS_VEGAS_001", "CITY_MC_MONACO_001"].includes(cityId)) {
    characters.push({ id: getCharacterId(cityId, "KADE"), name: "Adrian Kade", role: "route antagonist", note: "Появляется там, где маршрут становится дорогим." });
  }
  return characters;
}

function step(id, title, objective, type, target, rewardValue, characterIds, cutscene, completeMessage, unlocks = null) {
  if (!SUPPORTED_STEP_TYPES.has(type)) throw new Error(`Unsupported story step type: ${type}`);
  return { id, title, objective, type, target, reward: rewardValue, characterIds, cutscene, completeMessage, ...(unlocks ? { unlocks } : {}) };
}

function reward(xp, reputation, clubXp) {
  return { xp, reputation, clubXp };
}

function cityMeta(name, act, theme, characters) {
  return { name, act, theme, characters };
}

function person(key, name, role, note) {
  return { key, name, role, note };
}

function getCharacterId(cityId, key) {
  return `CHAR_WORLD_${slug(cityId)}_${slug(key)}`;
}

function characterName(characters, id) {
  return characters.find((entry) => entry.id === id)?.name ?? "host";
}

function slug(value) {
  return String(value ?? "GEN")
    .replace(/^CITY_/, "")
    .replace(/^CLUB_/, "")
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
}

function pad(value) {
  return String(value).padStart(3, "0");
}
