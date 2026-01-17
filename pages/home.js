export function renderHome(root) {
  const wrap = document.createElement("div");

  wrap.innerHTML = `
    <div class="h1">Start</div>
    <div class="p">
      Willkommen. Das ist die Basis-Navigation. Als Nächstes hängen wir Vocabulary-UI + Flashcards an.
    </div>

    <div class="grid">
      <div class="card">
        <h3>Vokabeln</h3>
        <p>Wörter hinzufügen, Priorität/Strength tracken (Basis für Spaced Repetition).</p>
      </div>
      <div class="card">
        <h3>Flashcards</h3>
        <p>Lerne deine Wörter direkt. Richtig/Falsch → Progress aktualisieren.</p>
      </div>
      <div class="card">
        <h3>Verb Cloze</h3>
        <p>Lückentexte mit Verben. Später LLM: baut deine Vokabeln nach Prio ein.</p>
      </div>
      <div class="card">
        <h3>LLM später</h3>
        <p>Serverless Endpoint (/generate). Frontend bleibt gleich – nur Quelle wechselt.</p>
      </div>
    </div>

    <div class="btnrow">
      <a class="btn primary" href="#/vocabulary">Zu den Vokabeln</a>
      <a class="btn" href="#/flashcards">Zu Flashcards</a>
      <a class="btn" href="#/verb-cloze">Zu Verb Cloze</a>
    </div>
  `;

  root.append(wrap);
}
