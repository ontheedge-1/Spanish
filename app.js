import { startRouter } from "./router.js";
import { renderHome } from "./pages/home.js";
import { renderVocabulary } from "./pages/vocabulary.js";
import { renderFlashcards } from "./pages/flashcards.js";
import { renderVerbCloze } from "./pages/verbCloze.js";

const root = document.getElementById("app");

const routes = {
  "/": renderHome,
  "/vocabulary": renderVocabulary,
  "/flashcards": renderFlashcards,
  "/verb-cloze": renderVerbCloze,
  "/404": (r) => {
    r.innerHTML = `
      <div class="h1">404</div>
      <div class="p">Diese Seite gibt es nicht. Zurück zur <a class="navlink" href="#/">Startseite</a>.</div>
    `;
  }
};

startRouter({ routes, root });
