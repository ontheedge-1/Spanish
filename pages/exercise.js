import irregularPack from "../shared/verbPacks/irregular_es.js";
import { getSettings, importSettings } from "../data/settingsStore.js";

// UI constants
const TENSES = [
  { key: "preterite", label: "Pretérito" },
  { key: "present", label: "Presente" }
];

const SIZES = [10, 15, 20];

// Settings path (we store only what UI needs)
function ensureExerciseDefaults(s) {
  s.practice = s.practice || {};
  s.practice.irregularExercise = s.practice.irregularExercise || {
    tense: "preterite",
    size: 10,
    lemmas: []
  };

  // clamp
  if (!TENSES.some(t => t.key === s.practice.irregularExercise.tense)) {
    s.practice.irregularExercise.tense = "preterite";
  }
  if (!SIZES.includes(Number(s.practice.irregularExercise.size))) {
    s.practice.irregularExercise.size = 10;
  }
  if (!Array.isArray(s.practice.irregularExercise.lemmas)) {
    s.practice.irregularExercise.lemmas = [];
  }
  // max 10 verbs
  s.practice.irregularExercise.lemmas = s.practice.irregularExercise.lemmas.slice(0, 10);

  return s;
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

function setHint(el, msg) {
  el.textContent = msg || "";
}

function unique(arr) {
  return Array.from(new Set(arr));
}

function getAvailableLemmasForTense(tense) {
  // irregularPack schema: { lemma: { present:{...}, preterite:{...} } }
  return Object.keys(irregularPack)
    .filter(lemma => irregularPack?.[lemma]?.[tense])
    .sort((a, b) => a.localeCompare(b));
}

function toggleLemma(list, lemma) {
  const set = new Set(list);
  if (set.has(lemma)) set.delete(lemma);
  else set.add(lemma);
  return Array.from(set);
}

// Optional: prettier badge text (keeps lemma as-is otherwise)
function prettyLemma(lemma) {
  return lemma; // keep simple for now
}

export function renderExercise(pageRoot) {
  const s = ensureExerciseDefaults(getSettings());
  importSettings(s);

  pageRoot.innerHTML = `
    <div class="page">
      <div class="headerRow">
        <h2>Exercise</h2>
        <div class="p" style="margin:0;">Irregular Drill (LLM-generated dialogue + sentence pool)</div>
      </div>

      <div class="card" style="margin-top:12px;">
        <h3>1) Tense</h3>
        <div id="tenseRow" style="display:flex; gap:8px; flex-wrap:wrap; margin-top:10px;"></div>
      </div>

      <div class="card" style="margin-top:12px;">
        <h3>2) Size</h3>
        <div class="p" style="margin-top:6px;">Choose total blanks (only 10 / 15 / 20).</div>
        <div id="sizeRow" style="display:flex; gap:8px; flex-wrap:wrap; margin-top:10px;"></div>
      </div>

      <div class="card" style="margin-top:12px;">
        <h3>3) Verbs</h3>
        <div class="p" id="verbsHint" style="margin-top:6px;"></div>
        <div id="verbsRow" style="display:flex; gap:8px; flex-wrap:wrap; margin-top:10px;"></div>

        <div class="p" id="selectionMeta" style="margin-top:10px;"></div>
      </div>

      <div class="card" style="margin-top:12px;">
        <h3>4) Generate</h3>
        <div class="p" style="margin-top:6px;">
          This will call the Worker once and generate a full exercise (JSON-only, no solutions, slots only). Not wired yet in this UI step.
        </div>

        <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center; margin-top:10px;">
          <button class="btn" id="generateBtn" type="button">Generate exercise</button>
          <div class="p" id="genHint" style="margin:0;"></div>
        </div>

        <div id="debugBox" class="p" style="margin-top:10px; white-space:pre-wrap;"></div>
      </div>
    </div>
  `;

  const tenseRow = pageRoot.querySelector("#tenseRow");
  const sizeRow = pageRoot.querySelector("#sizeRow");
  const verbsRow = pageRoot.querySelector("#verbsRow");
  const verbsHint = pageRoot.querySelector("#verbsHint");
  const selectionMeta = pageRoot.querySelector("#selectionMeta");
  const generateBtn = pageRoot.querySelector("#generateBtn");
  const genHint = pageRoot.querySelector("#genHint");
  const debugBox = pageRoot.querySelector("#debugBox");

  function currentSettings() {
    return ensureExerciseDefaults(getSettings());
  }

  function updateSettings(mutator) {
    const st = currentSettings();
    mutator(st.practice.irregularExercise);
    // normalize / clamp after mutation
    ensureExerciseDefaults(st);
    importSettings(st);
  }

  function renderTenseBadges() {
    const st = currentSettings().practice.irregularExercise;
    tenseRow.innerHTML = TENSES.map(t => {
      const active = st.tense === t.key;
      return `
        <button class="badge ${active ? "active" : ""}" data-tense="${escapeHtml(t.key)}" type="button">
          ${escapeHtml(t.label)}
        </button>
      `;
    }).join("");

    tenseRow.querySelectorAll("[data-tense]").forEach(btn => {
      btn.addEventListener("click", () => {
        const tense = btn.getAttribute("data-tense");
        updateSettings(ex => {
          ex.tense = tense;
          // when tense changes, filter selected lemmas to those available
          const available = new Set(getAvailableLemmasForTense(tense));
          ex.lemmas = (ex.lemmas || []).filter(l => available.has(l));
        });
        renderAll();
      });
    });
  }

  function renderSizeBadges() {
    const st = currentSettings().practice.irregularExercise;
    sizeRow.innerHTML = SIZES.map(n => {
      const active = Number(st.size) === n;
      return `
        <button class="badge ${active ? "active" : ""}" data-size="${n}" type="button">
          ${n}
        </button>
      `;
    }).join("");

    sizeRow.querySelectorAll("[data-size]").forEach(btn => {
      btn.addEventListener("click", () => {
        const n = Number(btn.getAttribute("data-size"));
        updateSettings(ex => { ex.size = n; });
        renderAll();
      });
    });
  }

  function renderVerbBadges() {
    const st = currentSettings().practice.irregularExercise;
    const available = getAvailableLemmasForTense(st.tense);
    const selected = new Set(st.lemmas || []);

    verbsHint.textContent = `Available irregular verbs for "${st.tense}" (${available.length}). Select up to 10.`;

    verbsRow.innerHTML = available.map(lemma => {
      const active = selected.has(lemma);
      return `
        <button class="badge ${active ? "active" : ""}" data-lemma="${escapeHtml(lemma)}" type="button">
          ${escapeHtml(prettyLemma(lemma))}
        </button>
      `;
    }).join("");

    verbsRow.querySelectorAll("[data-lemma]").forEach(btn => {
      btn.addEventListener("click", () => {
        const lemma = btn.getAttribute("data-lemma");

        updateSettings(ex => {
          const next = toggleLemma(ex.lemmas || [], lemma);
          const uniq = unique(next);

          if (uniq.length > 10) {
            // hard cap
            setHint(genHint, "Max 10 verbs selected.");
            return;
          }
          ex.lemmas = uniq;
        });

        renderAll();
      });
    });
  }

  function renderMetaAndGenerateState() {
    const ex = currentSettings().practice.irregularExercise;

    const count = ex.lemmas.length;
    const size = Number(ex.size);

    // auto-min 10 already enforced by size badges, but keep hint consistent
    selectionMeta.textContent =
      `Selected: ${count} verb(s) · Tense: ${ex.tense} · Size: ${size} blanks`;

    // Enable generate only if >= 1 verb selected
    generateBtn.disabled = count === 0;

    if (count === 0) {
      setHint(genHint, "Pick at least 1 verb.");
    } else {
      setHint(genHint, "");
    }
  }

  function renderAll() {
    renderTenseBadges();
    renderSizeBadges();
    renderVerbBadges();
    renderMetaAndGenerateState();
  }

  generateBtn.addEventListener("click", () => {
    const ex = currentSettings().practice.irregularExercise;

    if (!ex.lemmas.length) {
      setHint(genHint, "Pick at least 1 verb.");
      return;
    }

    // UI-first step: we show the exact payload we’ll send to the worker later
    const payloadPreview = {
      mode: "verbCloze",
      style: { mix: { dialogue: 0.6, pool: 0.4 } },
      tense: ex.tense,          // one tense per exercise
      size: Number(ex.size),    // 10/15/20
      lemmas: ex.lemmas,        // selected verbs
      vocabContext: {
        includePos: ["noun", "adj", "phrase", "other"], // "everything except verbs" (final logic later)
        count: 25
      }
    };

    debugBox.textContent =
      "UI ready. Next step: wire Worker /api/generate.\n\nPayload preview:\n" +
      JSON.stringify(payloadPreview, null, 2);

    setHint(genHint, "UI ok ✅ (worker not wired yet)");
  });

  renderAll();
}
