export function renderVerbCloze(root) {
  const el = document.createElement("div");
  el.innerHTML = `
    <div class="h1">Verb Cloze</div>
    <div class="p">
      Placeholder. Next: short stories with blanks to fill in (verbs + optionally pronouns).
      Later: the LLM will include your priority vocabulary items inside the generated sentences.
    </div>
    <div class="card">
      <h3>LLM plan</h3>
      <p>Generator will receive constraints.mustIncludeVocab = your top priority items.</p>
    </div>
  `;
  root.append(el);
}
