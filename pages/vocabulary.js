import { getVocab, addVocab, deleteVocab } from "../data/vocabStore.js";
import { getProgressMap, ensureProgress } from "../data/progressStore.js";

function uid() {
  // kurz & gut genug für lokale IDs
  return "v_" + Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);
}

function strengthToPriority(strength) {
  // Prio: je niedriger strength, desto höher prio
  const prio = Math.round((1 - strength) * 100);
  return Math.max(0, Math.min(100, prio));
}

function renderTable(root, { items, progress }) {
  const tableWrap = document.createElement("div");

  if (items.length === 0) {
    tableWrap.innerHTML = `
      <div class="card">
        <h3>Keine Vokabeln gespeichert</h3>
        <p>Füge oben dein erstes Wort hinzu, z. B. <strong>pagar</strong> → bezahlen.</p>
      </div>
    `;
    root.append(tableWrap);
    return;
  }

  const rows = items.map(item => {
    const p = progress[item.id] || { strength: 0.25, seen: 0, correct: 0 };
    const prio = strengthToPriority(p.strength);

    return `
      <tr>
        <td><strong>${escapeHtml(item.lemma)}</strong></td>
        <td>${escapeHtml(item.translation)}</td>
        <td><span class="badge ${item.pos === "verb" ? "blue" : "purple"}">${escapeHtml(item.pos)}</span></td>
        <td>
          <span class="badge">${Math.round(p.strength * 100)}%</span>
          <span class="badge">Prio ${prio}</span>
        </td>
        <td>${p.correct}/${p.seen}</td>
        <td style="text-align:right;">
          <button class="btn danger" data-del="${item.id}">Löschen</button>
        </td>
      </tr>
    `;
  }).join("");

  tableWrap.innerHTML = `
    <table class="table" aria-label="Vokabel-Liste">
      <thead>
        <tr>
          <th>Spanisch</th>
          <th>Deutsch</th>
          <th>Wortart</th>
          <th>Strength / Prio</th>
          <th>Treffer</th>
          <th></th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;

  root.append(tableWrap);

  // Delete handler (event delegation)
  tableWrap.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-del]");
    if (!btn) return;
    const id = btn.getAttribute("data-del");
    if (!id) return;

    const ok = confirm("Dieses Wort wirklich löschen?");
    if (!ok) return;

    deleteVocab(id);
    // Re-render
    renderVocabulary(root.parentElement);
  });
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[m]));
}

export function renderVocabulary(root) {
  root.innerHTML = "";

  const header = document.createElement("div");
  header.innerHTML = `
    <div class="h1">Vokabeln</div>
    <div class="p">
      Füge Wörter hinzu, die du lernen willst. Diese Liste ist später die Quelle für Flashcards
      <span class="badge blue">und</span> fürs LLM (damit es deine Wörter in Übungen einbaut).
    </div>
  `;

  const formCard = document.createElement("div");
  formCard.className = "card";
  formCard.innerHTML = `
    <h3>Neues Wort hinzufügen</h3>
    <div class="p">Tipp: lemma ohne Artikel (z.B. <strong>mesa</strong>), Übersetzung mit Artikel ok (z.B. <strong>der Tisch</strong>).</div>

    <form id="vForm" class="form">
      <div>
        <div class="label">Spanisch (lemma)</div>
        <input class="input" name="lemma" placeholder="pagar" required />
      </div>

      <div>
        <div class="label">Deutsch (Übersetzung)</div>
        <input class="input" name="translation" placeholder="bezahlen" required />
      </div>

      <div>
        <div class="label">Wortart</div>
        <select class="select" name="pos">
          <option value="verb">verb</option>
          <option value="noun">noun</option>
          <option value="adj">adj</option>
          <option value="other">other</option>
        </select>
      </div>

      <div>
        <div class="label">Tags (optional, Komma getrennt)</div>
        <input class="input" name="tags" placeholder="daily_life, travel" />
      </div>

      <div style="grid-column: 1 / -1; display:flex; gap:10px; flex-wrap:wrap;">
        <button class="btn primary" type="submit">Hinzufügen</button>
        <button class="btn" type="button" id="seedBtn">Demo-Wörter einfügen</button>
      </div>
    </form>
  `;

  const listWrap = document.createElement("div");
  listWrap.className = "card";
  listWrap.innerHTML = `
    <h3>Deine Liste</h3>
    <div class="p">Strength startet bei 25%. Prio ist (1-strength) → je höher, desto mehr Fokus in Übungen.</div>
    <div class="hr"></div>
    <div id="tableArea"></div>
  `;

  root.append(header, formCard, listWrap);

  function refreshTable() {
    const items = getVocab()
      .slice()
      .sort((a, b) => a.lemma.localeCompare(b.lemma, "es"));

    // ensure progress exists for each item
    items.forEach(it => ensureProgress(it.id));

    const progress = getProgressMap();
    const area = listWrap.querySelector("#tableArea");
    area.innerHTML = "";
    renderTable(area, { items, progress });
  }

  // Submit handler
  const form = formCard.querySelector("#vForm");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(form);

    const lemma = String(fd.get("lemma") || "").trim();
    const translation = String(fd.get("translation") || "").trim();
    const pos = String(fd.get("pos") || "other").trim();
    const tagsRaw = String(fd.get("tags") || "").trim();

    if (!lemma || !translation) return;

    const item = {
      id: uid(),
      lang: "es",
      type: "vocab",
      lemma,
      translation,
      pos,
      tags: tagsRaw ? tagsRaw.split(",").map(t => t.trim()).filter(Boolean) : [],
      createdAt: new Date().toISOString()
    };

    addVocab(item);
    ensureProgress(item.id);

    form.reset();
    // keep pos default
    form.querySelector('select[name="pos"]').value = "verb";

    refreshTable();
  });

  // Seed demo words
  formCard.querySelector("#seedBtn").addEventListener("click", () => {
    const demos = [
      { lemma: "pagar", translation: "bezahlen", pos: "verb", tags: ["daily_life"] },
      { lemma: "mesa", translation: "der Tisch", pos: "noun", tags: ["home"] },
      { lemma: "decir", translation: "sagen", pos: "verb", tags: ["verbs"] },
      { lemma: "rápido", translation: "schnell", pos: "adj", tags: ["adjectives"] }
    ];

    demos.forEach(d => {
      const item = {
        id: uid(),
        lang: "es",
        type: "vocab",
        lemma: d.lemma,
        translation: d.translation,
        pos: d.pos,
        tags: d.tags,
        createdAt: new Date().toISOString()
      };
      addVocab(item);
      ensureProgress(item.id);
    });

    refreshTable();
  });

  refreshTable();
}
