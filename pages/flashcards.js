export function renderFlashcards(root) {
  const el = document.createElement("div");
  el.innerHTML = `
    <div class="h1">Flashcards</div>
    <div class="p">Platzhalter. Danach: Karte zeigen → umdrehen → richtig/falsch → Progress.</div>
    <div class="card">
      <h3>Quelle</h3>
      <p>Kommt aus deiner Vocabulary Bank. Später Filter nach "due" oder niedriger Strength.</p>
    </div>
  `;
  root.append(el);
}
