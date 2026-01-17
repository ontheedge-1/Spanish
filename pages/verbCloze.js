export function renderVerbCloze(root) {
  const el = document.createElement("div");
  el.innerHTML = `
    <div class="h1">Verb Cloze</div>
    <div class="p">
      Platzhalter. Später: Story + Lücken + Scoring. Und LLM kann deine Prioritäts-Vokabeln einbauen.
    </div>
    <div class="card">
      <h3>LLM-Plan</h3>
      <p>Generator bekommt constraints.mustIncludeVocab = Top-N Wörter mit niedriger Strength / due.</p>
    </div>
  `;
  root.append(el);
}
