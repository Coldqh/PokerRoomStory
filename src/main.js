import { PokerRoomStoryApp } from "./app.js?v=0.6.0";

const root = document.querySelector("#app");

if (!root) {
  throw new Error("App root #app not found");
}

new PokerRoomStoryApp(root);
