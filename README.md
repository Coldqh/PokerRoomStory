# Poker Room Story v0.4.5

## Patch v0.4.5 — Hero Fold UI Fix

Точечный багфикс после проверки реального репозитория `Coldqh/PokerRoomStory`.

### Исправлено

- fold игрока теперь отображается так же явно, как fold NPC;
- после fold у героя больше не остаются видимые карты;
- герой получает визуальное состояние `Fold` и приглушается;
- action dock на terminal-состояниях не показывает доступные игровые действия;
- `getAvailableActions()` теперь жёстко блокирует действия в `folded / finished / idle`;
- версия обновлена до `0.4.5`;
- service worker cache обновлён.

### Не менялось

- save schema;
- банкролл;
- коллекции;
- NPC brain;
- логика раздачи за пределами terminal guard.

### Установка

Распаковать с заменой в:

```powershell
C:\PokerRoomStory
```

Запуск локально:

```powershell
cd C:\PokerRoomStory
python -m http.server 8080
```

Пуш:

```powershell
git add .
git commit -m "Patch v0.4.5 hero fold UI fix"
git push
```

После GitHub Pages:

```text
Проверить → Принудительно обновить → Ctrl + F5
```
