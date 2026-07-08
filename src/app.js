import { buildContentRegistry } from "./data/contentRegistry.js?v=3.6.0";
import { getRuntimeStatus, onUpdateReady, registerAppServiceWorker, checkForRemoteVersion } from "./engine/update.js?v=3.6.0";
import { stateController } from "./app/state.js?v=3.6.0";
import { navigationController } from "./app/navigation.js?v=3.6.0";
import { inputController } from "./app/inputController.js?v=3.6.0";
import { tableSessionFlow } from "./app/tableSessionFlow.js?v=3.6.0";
import { bettingModalFlow } from "./app/bettingModalFlow.js?v=3.6.0";
import { handFlow } from "./app/handFlow.js?v=3.6.0";
import { systemFlow } from "./app/systemFlow.js?v=3.6.0";
import { renderShell } from "./app/renderShell.js?v=3.6.0";

export class PokerRoomStoryApp {
  constructor(root) {
    this.root = root;
    this.content = buildContentRegistry();
    this.timelineTimer = null;
    this.menuOpen = false;
    this.state = this.createInitialState();
    this.root.addEventListener("click", (event) => this.handleClick(event));
    this.root.addEventListener("change", (event) => this.handleChange(event));
    this.installRuntimeHooks();
    this.render();
  }

  installRuntimeHooks() {
    window.addEventListener("online", () => this.setSystem({ online: true }));
    window.addEventListener("offline", () => this.setSystem({ online: false }));
    onUpdateReady((event) => this.setSystem({ updateAvailable: true, updateMessage: event.detail?.message ?? "Доступно обновление." }));
    registerAppServiceWorker().then((status) => {
      const runtime = getRuntimeStatus();
      this.setSystem({ serviceWorker: status.ok, controlled: runtime.controlled });
      checkForRemoteVersion();
    });
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) checkForRemoteVersion();
    });
  }
}

Object.assign(
  PokerRoomStoryApp.prototype,
  stateController,
  navigationController,
  inputController,
  tableSessionFlow,
  bettingModalFlow,
  handFlow,
  systemFlow,
  renderShell,
);
