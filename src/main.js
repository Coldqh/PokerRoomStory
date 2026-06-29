import { PokerRoomStoryApp } from "./app.js";

const root = document.querySelector("#app");

if (!root) {
  throw new Error("App root #app not found");
}

new PokerRoomStoryApp(root);
