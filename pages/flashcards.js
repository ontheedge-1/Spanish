export function renderFlashcards(root) {
  const el = document.createElement("div");
  el.innerHTML = `
    <div class="h1">Flashcards</div>
    <div class="p">
      Placeholder for now. Next: show a card → flip → mark correct/wrong → update strength/priority.
    </div>
    <div class="card">
      <h3>Coming next</h3>
      <p>Cards will be generated from your Vocabulary list (including phrases).</p>
    </div>
  `;
  root.append(el);
}
