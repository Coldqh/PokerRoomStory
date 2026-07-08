import { escapeHtml } from "../components.js?v=3.7.1";
import { formatDateTime, speedLabel } from "./common.js?v=3.7.1";

export function renderSettingsScreen(state) {
  const system = state.system ?? {};
  const info = system.saveInfo ?? {};
  const updated = system.lastSavedAt ? formatDateTime(system.lastSavedAt) : "—";
  const online = system.online === false ? "Офлайн" : "Онлайн";
  const cache = system.controlled ? "PWA active" : system.serviceWorker ? "PWA ready" : "Browser";
  const speed = state.settings?.animationSpeed ?? "normal";

  return `
    <section class="page-card panel-soft settings-hero">
      <div class="kicker">System</div>
      <h2>Настройки</h2>
    </section>

    <section class="settings-grid">
      <article class="panel-soft settings-card">
        <div class="section-title"><h3>Игра</h3><span>темп</span></div>
        <div class="settings-line">
          <div><span>Анимации</span><strong>${escapeHtml(speedLabel(speed))}</strong></div>
          <button class="small-button" data-action="toggle-speed">Сменить</button>
        </div>
      </article>

      <article class="panel-soft settings-card settings-wide">
        <div class="section-title"><h3>Система</h3><span>v${escapeHtml(system.appVersion ?? "1.1.0")}</span></div>
        <div class="system-grid">
          <div class="system-line"><span>Сейв</span><strong>${info.exists ? `schema ${escapeHtml(String(info.schemaVersion ?? "?"))}` : "новый"}</strong></div>
          <div class="system-line"><span>Сохранено</span><strong>${escapeHtml(updated)}</strong></div>
          <div class="system-line"><span>Режим</span><strong>${escapeHtml(online)}</strong></div>
          <div class="system-line"><span>Кэш</span><strong>${escapeHtml(cache)}</strong></div>
        </div>
        <div class="system-actions settings-actions">
          <button class="small-button" data-action="export-save">Экспорт сейва</button>
          <button class="small-button" data-action="import-save">Импорт</button>
          <button class="small-button" data-action="check-update">Проверить</button>
          <button class="small-button" data-action="force-update">Принудительно обновить</button>
          <button class="small-button danger" data-action="reset-save">Сброс</button>
        </div>
      </article>
    </section>
  `;
}

