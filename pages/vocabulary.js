export function renderVocabulary(root) {
  const el = document.createElement("div");
  el.innerHTML = `
    <div class="h1">Vokabeln</div>
    <div class="p">Platzhalter. Als Nächstes bauen wir hier: Add / List / Delete + Speicherung.</div>
    <div class="card">
      <h3>Nächster Schritt</h3>
      <p>UI: lemma (spanisch), translation (deutsch), pos (verb/noun/adj), tags.</p>
    </div>
  `;
  root.append(el);
}
