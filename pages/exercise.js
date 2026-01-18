import irregularPack from "../shared/verbPacks/irregular_es.js";
import { getSettings, importSettings } from "../data/settingsStore.js";
import { answersEqualTolerant } from "../shared/conjugation.js";

// IMPORTANT: same worker base as your sync proxy
const WORKER_BASE = "https://spanish-sync-proxy.ricokunzedd.workers.dev";

const TENSES = [
  { key: "preterite", label: "Pretérito" },
  { key: "present", label: "Presente" }
];
const SIZES = [10, 15, 20];

function ensureExerciseDefaults(s) {
  s.practice = s.practice || {};
  s.practice.irregularExercise = s.practice.irregularExercise || {
    tense: "preterite",
    size: 10,
    lemmas: []
  };
  if (!TENSES.some((t) => t.key === s.practice.irregularExercise.tense)) {
    s.practice.irregularExercise.tense = "preterite";
  }
  if (!SIZES.includes(Number(s.practice.irregularExercise.size))) {
    s.practice.irregularExercise.size = 10;
  }
  if (!Array.isArray(s.practice.irregularExercise.lemmas)) {
    s.practice.irregularExercise.lemmas = [];
  }
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

function unique(arr) {
  return Array.from(new Set(arr));
}

function getAvailableLemmasForTense(tense) {
  return Object.keys(irregularPack)
    .filter((lemma) => irregularPack?.[lemma]?.[tense])
    .sort((a, b) => a.localeCompare(b));
}

function toggleLemma(list, lemma) {
  const set = new Set(list);
  if (set.has(lemma)) set.delete(lemma);
  else set.add(lemma);
  return Array.from(set);
}

function getVocabContextWords() {
  // "everything except verbs, incl phrases"
  // We rely on your vocabStore localStorage structure (same as vocabulary page):
  // { id, lemma, translation, pos, ... }
  const raw = localStorage.getItem("spanishtrainer:vocab:v1");
  if (!raw) return [];

  let vocab = [];
  try {
    vocab = JSON.parse(raw);
  } catch {
    return [];
  }

  const words = (Array.isArray(vocab) ? vocab : [])
    .filter((v) => String(v.pos || "").toLowerCase() !== "verb")
    .map((v) => String(v.lemma || "").trim())
    .filter(Boolean);

  // random sample up to 40
  const uniq = unique(words);
  for (let i = uniq.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [uniq[i], uniq[j]] = [uniq[j], uniq[i]];
  }
  return uniq.slice(0, 40);
}

async function postGenerate(payload) {
  const url = WORKER_BASE.replace(/\/$/, "") + "/api/generate";
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const txt = await res.text();
  let data;
  try {
    data = JSON.parse(txt);
  } catch {
    throw new Error(`Worker returned non-JSON: ${txt.slice(0, 200)}`);
  }

  if (!res.ok || !data.ok) {
    const msg = data?.error?.message || data?.message || "Unknown error";
    throw new Error(msg);
  }
  return data.data;
}

function getCorrectForm(lemma, tense, person) {
  const entry = irregularPack?.[lemma]?.[tense];
  const form = entry?.[person];
  if (!form) throw new Error(`Missing form for ${lemma} ${tense} ${person}`);
  return form;
}

// ---- Rendering generated exercise ----

function buildLineHtml(item, slotIndex, isRevealed, userAnswer, isCorrect, correctForm) {
  // item: dialogue_line | sentence | filler
  if (item.type === "filler") {
    return `<div class="p" style="margin:6px 0;">${escapeHtml(item.pre)}</div>`;
  }

  const pre = item.pre || "";
  const post = item.post || "";

  const slot = item.slot;
  const blankId = slot?.id || `s${slotIndex + 1}`;

  // Optional hint: show the infinitive being tested (e.g. "(hacer)").
  // This is derived from slot.lemma (no need for the LLM to print it).
  const lemmaHint = slot?.lemma
    ? `<span style="margin-left:6px; font-size:12px; opacity:0.55;">(${escapeHtml(slot.lemma)})</span>`
    : "";

  const inputDisabled = isRevealed ? "disabled" : "";
  const answerVal = isRevealed ? (userAnswer ?? "") : "";

  const statusBadge = isRevealed
    ? (isCorrect
        ? `<span class="badge active" style="margin-left:8px;">✅</span>`
        : `<span class="badge active" style="margin-left:8px;">❌ ${escapeHtml(correctForm)}</span>`)
    : "";

  const speakerPrefix = item.type === "dialogue_line" ? `<b>${escapeHtml(item.speaker)}:</b> ` : "";

  return `
    <div class="p" style="margin:6px 0;">
      ${speakerPrefix}${escapeHtml(pre)}
      <input class="input"
        data-blank-id="${escapeHtml(blankId)}"
        style="display:inline-block; width:160px; margin:0 6px; padding:6px 10px;"
        placeholder="..."
        ${inputDisabled}
        value="${escapeHtml(answerVal)}"
        autocomplete="off"
      />
      ${lemmaHint}
      ${escapeHtml(post)}
      ${statusBadge}
    </div>
  `;
}

export function renderExercise(pageRoot) {
  const s = ensureExerciseDefaults(getSettings());
  importSettings(s);

  pageRoot.innerHTML = `
    <div class="page">
      <div class="headerRow">
        <h2>Exercise</h2>
        <div class="p" style="margin:0;">Irregular Drill (LLM-generated)</div>
      </div>

      <div class="card" style="margin-top:12px;">
        <h3>1) Tense</h3>
        <div id="tenseRow" style="display:flex; gap:8px; flex-wrap:wrap; margin-top:10px;"></div>
      </div>

      <div class="card" style="margin-top:12px;">
        <h3>2) Size</h3>
        <div class="p" style="margin-top:6px;">Choose total blanks (10 / 15 / 20).</div>
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
        <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center; margin-top:10px;">
          <button class="btn" id="generateBtn" type="button">Generate exercise</button>
          <div class="p" id="genHint" style="margin:0;"></div>
        </div>
      </div>

      <div class="card" id="exerciseCard" style="margin-top:12px; display:none;">
        <h3>Exercise</h3>
        <div class="p" id="progressMeta" style="margin-top:6px;"></div>
        <div id="exerciseBody" style="margin-top:10px;"></div>
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
  const exerciseCard = pageRoot.querySelector("#exerciseCard");
  const exerciseBody = pageRoot.querySelector("#exerciseBody");
  const progressMeta = pageRoot.querySelector("#progressMeta");

  let generated = null; // worker exercise JSON
  let slotOrder = []; // array of slot ids in order s1..sN
  let revealedSlots = new Set(); // slot ids revealed
  let answers = {}; // slotId -> userAnswer
  let score = { done: 0, correct: 0 };

  function currentSettings() {
    return ensureExerciseDefaults(getSettings());
  }

  function updateSettings(mutator) {
    const st = currentSettings();
    mutator(st.practice.irregularExercise);
    ensureExerciseDefaults(st);
    importSettings(st);
  }

  function renderTenseBadges() {
    const st = currentSettings().practice.irregularExercise;
    tenseRow.innerHTML = TENSES.map((t) => {
      const active = st.tense === t.key;
      return `<button class="badge ${active ? "active" : ""}" data-tense="${escapeHtml(t.key)}" type="button">${escapeHtml(t.label)}</button>`;
    }).join("");

    tenseRow.querySelectorAll("[data-tense]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tense = btn.getAttribute("data-tense");
        updateSettings((ex) => {
          ex.tense = tense;
          const available = new Set(getAvailableLemmasForTense(tense));
          ex.lemmas = (ex.lemmas || []).filter((l) => available.has(l));
        });
        renderAll();
      });
    });
  }

  function renderSizeBadges() {
    const st = currentSettings().practice.irregularExercise;
    sizeRow.innerHTML = SIZES.map((n) => {
      const active = Number(st.size) === n;
      return `<button class="badge ${active ? "active" : ""}" data-size="${n}" type="button">${n}</button>`;
    }).join("");

    sizeRow.querySelectorAll("[data-size]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const n = Number(btn.getAttribute("data-size"));
        updateSettings((ex) => {
          ex.size = n;
        });
        renderAll();
      });
    });
  }

  function renderVerbBadges() {
    const st = currentSettings().practice.irregularExercise;
    const available = getAvailableLemmasForTense(st.tense);
    const selected = new Set(st.lemmas || []);

    verbsHint.textContent = `Available irregular verbs: ${available.length}. Select up to 10.`;

    verbsRow.innerHTML = available
      .map((lemma) => {
        const active = selected.has(lemma);
        return `<button class="badge ${active ? "active" : ""}" data-lemma="${escapeHtml(lemma)}" type="button">${escapeHtml(lemma)}</button>`;
      })
      .join("");

    verbsRow.querySelectorAll("[data-lemma]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const lemma = btn.getAttribute("data-lemma");
        updateSettings((ex) => {
          const next = unique(toggleLemma(ex.lemmas || [], lemma));
          if (next.length > 10) {
            genHint.textContent = "Max 10 verbs selected.";
            return;
          }
          ex.lemmas = next;
        });
        renderAll();
      });
    });
  }

  function renderMetaAndGenerateState() {
    const ex = currentSettings().practice.irregularExercise;
    const count = ex.lemmas.length;
    const size = Number(ex.size);

    selectionMeta.textContent = `Selected: ${count} · Tense: ${ex.tense} · Blanks: ${size}`;
    generateBtn.disabled = count === 0;
    genHint.textContent = count === 0 ? "Pick at least 1 verb." : "";
  }

  function renderAll() {
    renderTenseBadges();
    renderSizeBadges();
    renderVerbBadges();
    renderMetaAndGenerateState();
  }

  function computeVisibility(items) {
    // Growth rule B:
    // show items up to (and including) the current slot item;
    // hide from the next slot item onward.
    const size = slotOrder.length;
    let currentSlotIdx = 0;
    while (currentSlotIdx < size && revealedSlots.has(slotOrder[currentSlotIdx])) currentSlotIdx++;

    const visible = [];
    let slotSeen = 0;

    for (const it of items) {
      if (it.slot) {
        slotSeen += 1;
        visible.push(slotSeen <= currentSlotIdx + 1);
      } else {
        // filler visible only before the next unanswered slot line
        visible.push(slotSeen <= currentSlotIdx);
      }
    }

    return { currentSlotIdx, visible };
  }

  function renderGeneratedExercise() {
    if (!generated) return;

    const items = generated.items;
    const { visible } = computeVisibility(items);

    progressMeta.textContent = `Progress: ${score.correct}/${score.done} correct · Remaining: ${slotOrder.length - score.done}`;

    let slotCounter = 0;
    const html = items
      .map((it, idx) => {
        if (!visible[idx]) return "";

        if (it.slot) {
          const slotId = it.slot.id;
          const isRevealed = revealedSlots.has(slotId);
          const userAnswer = answers[slotId] || "";
          const correctForm = getCorrectForm(it.slot.lemma, it.slot.tense, it.slot.person);
          const isCorrect = isRevealed ? answersEqualTolerant(userAnswer, correctForm) : false;
          const out = buildLineHtml(it, slotCounter, isRevealed, userAnswer, isCorrect, correctForm);
          slotCounter += 1;
          return out;
        }

        return buildLineHtml(it, slotCounter, false, "", false, "");
      })
      .join("");

    exerciseBody.innerHTML = html;

    // DOM-based "current blank" selection (robust): enable exactly one input
    const inputs = Array.from(exerciseBody.querySelectorAll('input[data-blank-id]'));
    let domCurrent = null;

    for (const inp of inputs) {
      const slotId = inp.getAttribute("data-blank-id");
      if (!slotId) continue;

      if (revealedSlots.has(slotId)) {
        inp.disabled = true;
        continue;
      }

      if (!domCurrent) {
        domCurrent = inp;
        inp.disabled = false;
      } else {
        inp.disabled = true;
      }

      // Optional: clicking/tapping should always focus current input
      inp.onclick = () => {
        if (!inp.disabled) {
          try {
            inp.focus();
          } catch {}
        }
      };
    }

    // Attach key handler (overwrite to avoid stacking listeners)
    for (const inp of inputs) {
      inp.onkeydown = (ev) => {
        if (ev.key === "Enter") {
          ev.preventDefault();
          submitCurrent();
        }
      };
    }

    if (domCurrent) {
      setTimeout(() => {
        try {
          domCurrent.focus();
        } catch {}
      }, 0);
    }
  }

  function submitCurrent() {
    if (!generated) return;

    const inputs = Array.from(exerciseBody.querySelectorAll('input[data-blank-id]'));
    const currentInput = inputs.find((i) => !i.disabled);
    if (!currentInput) return;

    const currentSlotId = currentInput.getAttribute("data-blank-id");
    if (!currentSlotId) return;

    const user = currentInput.value || "";
    answers[currentSlotId] = user;

    const item = generated.items.find((it) => it?.slot?.id === currentSlotId);
    if (!item) return;

    const correctForm = getCorrectForm(item.slot.lemma, item.slot.tense, item.slot.person);
    const ok = answersEqualTolerant(user, correctForm);

    score.done += 1;
    if (ok) score.correct += 1;

    revealedSlots.add(currentSlotId);

    renderGeneratedExercise();
  }

  generateBtn.addEventListener("click", async () => {
    const ex = currentSettings().practice.irregularExercise;
    if (!ex.lemmas.length) return;

    generateBtn.disabled = true;
    genHint.textContent = "Generating…";

    try {
      const payload = {
        mode: "verbCloze",
        tense: ex.tense,
        size: Number(ex.size),
        lemmas: ex.lemmas,
        vocabWords: getVocabContextWords()
      };

      generated = await postGenerate(payload);

      // IMPORTANT: Progression must follow the actual order of blanks in the generated text,
      // not the numeric slot ids. The LLM may place slot ids in any order.
      slotOrder = (generated.items || []).filter((it) => it && it.slot).map((it) => it.slot.id);
      if (slotOrder.length !== Number(ex.size)) {
        throw new Error(`Generated exercise invalid: expected ${Number(ex.size)} slots but got ${slotOrder.length}`);
      }
      revealedSlots = new Set();
      answers = {};
      score = { done: 0, correct: 0 };

      exerciseCard.style.display = "";
      genHint.textContent = "Generated ✅ (press Enter to submit each blank)";

      renderGeneratedExercise();
    } catch (e) {
      genHint.textContent = `Error: ${String(e?.message || e)}`;
      generated = null;
      exerciseCard.style.display = "none";
    } finally {
      generateBtn.disabled = false;
    }
  });

  renderAll();
}
