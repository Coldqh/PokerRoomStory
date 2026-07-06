export const navigationController = {
  resolveScreen(screenId) {
    if (["locations", "venue", "club", "table"].includes(screenId)) return "location";
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
