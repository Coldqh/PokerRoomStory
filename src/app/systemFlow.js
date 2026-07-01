import { exportCurrentSave } from "../engine/save.js?v=1.0.1";

export const systemFlow = {
  exportSave() {
    const text = exportCurrentSave();
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `poker-room-story-save-v${APP_VERSION}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    this.setSystem({ notice: "Сейв экспортирован." });
  },

  toggleAnimationSpeed() {
    const current = this.state.settings?.animationSpeed ?? "normal";
    const next = current === "normal" ? "fast" : current === "fast" ? "instant" : "normal";
    this.setState({
      settings: {
        ...createDefaultSettings(),
        ...(this.state.settings ?? {}),
        animationSpeed: next,
      },
    });
  }
};
