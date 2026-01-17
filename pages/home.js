export function renderHome(root) {
  const wrap = document.createElement("div");

  wrap.innerHTML = `
    <div class="h1">Home</div>
    <div class="p">
      Welcome. This is the base navigation shell. Next we’ll add a real Vocabulary UI + Flashcards flow.
    </div>

    <div class="grid">
      <div class="card">
        <h3>Vocabulary</h3>
        <p>Add words and phrases you want to learn. We’ll track priority/strength (SRS foundation).</p>
      </div>
      <div class="card">
        <h3>Flashcards</h3>
        <p>Practice your saved items. Correct/Wrong → progress updates automatically.</p>
      </div>
      <div class="card">
        <h3>Verb Cloze</h3>
        <p>Fill-in-the-blank stories focusing on verbs. Later: LLM will include your priority vocab.</p>
      </div>
      <div class="card">
        <h3>LLM later</h3>
        <p>Serverless endpoint (/generate). Frontend stays the same — only the data source changes.</p>
      </div>
    </div>

    <div class="btnrow">
      <a class="btn primary" href="#/vocabulary">Go to Vocabulary</a>
      <a class="btn" href="#/flashcards">Go to Flashcards</a>
      <a class="btn" href="#/verb-cloze">Go to Verb Cloze</a>
    </div>
  `;

  root.append(wrap);
}
