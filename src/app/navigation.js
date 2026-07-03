export const navigationController = {
  resolveScreen(screenId) {
    const seated = Boolean(this.state.tableSession?.tableId);
    if (seated && screenId === "club") return "table";
    if (!seated && screenId === "table") return "club";
    return screenId;
  },

  getDisplayState() {
    const currentScreen = this.resolveScreen(this.state.currentScreen);
    if (currentScreen === this.state.currentScreen) return this.state;
    return { ...this.state, currentScreen };
  },

  pushLog(message) {
    this.setState({ log: [...this.state.log, message].slice(-100) });
  }
};
