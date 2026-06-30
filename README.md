# Poker Room Story v0.5.0

Patch v0.5.0 — Career MVP.

## Что внутри

- улучшенный экран карьеры;
- ранги и прогресс до следующего ранга;
- 8 первых челленджей;
- награды за челленджи: XP и репутация;
- новые коллекционные открытия;
- новые термины: Showdown и Good Fold;
- третий стол Deep River с требованиями по банкроллу и репутации;
- безопасная нормализация старых сейвов без смены schema;
- сохранён стабильный flow раздач из v0.4.8.

## Запуск локально

```powershell
cd C:\PokerRoomStory
python -m http.server 8080
```

Открыть:

```text
http://localhost:8080
```

## Пуш

```powershell
cd C:\PokerRoomStory
git add .
git commit -m "Patch v0.5.0 career MVP"
git push
```

После GitHub Pages:

```text
Проверить → Принудительно обновить → Ctrl + F5
```

На телефоне полностью закрыть вкладку/PWA и открыть заново.
