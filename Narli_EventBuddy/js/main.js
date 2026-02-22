// App-Start: Import der Module
import { EventBuddyModel } from "./model/event-buddy-model.js";
import { AppController } from "./controller/app-controller.js";
import "./view/eventbuddy-app.js";

// Setup: Instanziiert und verknüpft die Schichten
async function bootstrap() {
  // Model laden via JSON-URL
  const model = await EventBuddyModel.create({ seedUrl: "data/eventbuddy-data.json" });
  
  // Root-Element in der HTML suchen
  const view = document.querySelector("eventbuddy-app");

  if (!view) {
    throw new Error("Root-Komponente <eventbuddy-app> fehlt.");
  }

  // Controller verbinden und starten
  const controller = new AppController(model, view);
  controller.init();
}

// Ausführung: Startet bootstrap nach DOM-Ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    bootstrap().catch((error) => console.error(error));
  });
} else {
  bootstrap().catch((error) => console.error(error));
}