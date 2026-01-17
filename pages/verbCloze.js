import { getVocab } from "../data/vocabStore.js";
import { getProgressMap } from "../data/progressStore.js";
import { exportSettings, getSettings, importSettings } from "../data/settingsStore.js";
import { conjugate, answersEqualTolerant } from "../shared/conjugation.js";

// Worker base URL (same as vocabulary.js)
const SYNC_URL = "https://spanish-sync-proxy.ricokunzedd.workers.dev";

const VOCAB_KEY = "spanishtrainer:vocab:v1";
const PROGRESS_KEY = "spanishtrainer:progress:v1";

const PERSONS = [
  { key: "yo", label: "yo" },
  { key: "tu", label: "tú" },
  { key: "el", label: "él / ella / usted" },
  { key: "nosotros", label: "nosotros/as" },
  { key: "vosotros", label: "vosotros/as" },
  { key: "ellos", label: "ellos / ellas / ustedes" }
];

// Keep Step 3 honest: only include verbs we can currently conjugate deterministically (regular preterite).
function isSupportedRegularPreterite(inf) {
  const v = String(inf || "").toLowerCase().trim();
  if (!(v.endsWith("ar") || v.endsWith("er") || v.endsWith("ir"))) return false;

  // Common irregulars (not exhaustive). We exclude them for now to avoid wrong "correct answers".
  const irregularSet = new Set([
    "ser","ir","dar","estar","tener","venir","hacer","decir","poder","poner","querer","saber","salir",
    "traer","conducir","producir","traducir","andar","caber","haber"
  ]);
  if (irregularSet.has(v)) return false;

  // i->y in 3rd person for many -uir (construyó) and -eer/-oer (leyó) -> exclude for now
  if (v.endsWith("uir") || v.endsWith("eer") || v.endsWith("oer")) return false;

  // Many -ir stem-changing in preterite (dormir->durmió). Hard to detect w/out pack -> exclude common ones.
  const maybeStemChangeIr = new Set(["dormir","pedir","servir","sentir","mentir","preferir","repetir","seguir","conseguir","vestir","morir"]);
  if (maybeStemChangeIr.has(v)) return false;

  return true;
}

function setStatus(el, msg, kind = "info") {
  el.textContent = msg || "";
  el.style.color =
    kind === "error" ? "#b91c1c" :
    kind === "ok" ? "#1d4ed8" :
    "#6b7280";
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

function normalizeIncomingVocab(vocabArr) {
  return (Array.isArray(vocabArr) ? vocabArr : [])
    .map(v => ({
      id: String(v.id || "").trim(),
      lang: String(v.lang || "es").trim(),
      type: String(v.type || "vocab").trim(),
      lemma: String(v.lemma || "").trim(),
      translation: String(v.translation || "").trim(),
      pos: String(v.pos || "other").trim(),
      tags: Array.isArray(v.tags)
        ? v.tags
        : String(v.tags || "").split(",").map(t => t.trim()).filter(Boolean),
      createdAt: v.createdAt ? String(v.createdAt) : new Date().toISOString()
    }))
    .filter(v => v.id && v.lemma && v.translation);
}

function normalizeIncomingProgress(progressArr) {
  const map = {};
  (Array.isArray(progressArr) ? progressArr : []).forEach(p => {
    const itemId = String(p.itemId || "").trim();
    if (!itemId) return;
    map[itemId] = {
      itemId,
      strength: Number(p.strength ?? 0.25),
      seen: Number(p.seen ?? 0),
      correct: Number(p.correct ?? 0)
    };
  });
  return map;
}

async function syncPull(statusEl) {
  setStatus(statusEl, "Sync Pull: loading from Google Sheet…");

  const url = SYNC_URL.replace(/\/$/, "") + "/api/pull";
  const res = await fetch(url);

  if (!res.ok) {
    setStatus(statusEl, `Pull failed (HTTP ${res.status}).`, "error");
    return;
  }

  const envelope = await res.json();
  if (!envelope.ok) {
    const msg = envelope?.error?.message || envelope?.error || "unknown error";
    setStatus(statusEl, `Pull failed: ${msg}`, "error");
    return;
  }

  const payload = envelope.data;

  const vocab = normalizeIncomingVocab(payload?.vocab);
  const progressMap = normalizeIncomingProgress(payload?.progress);

  localStorage.setItem(VOCAB_KEY, JSON.stringify(vocab));
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(progressMap));

  importSettings(payload?.settings || {});

  setStatus(
    statusEl,
    `Pulled vocab=${vocab.length}, progress=${Object.keys(progressMap).length}, settings=ok.`,
    "ok"
  );
}

async function syncPush(statusEl) {
  setStatus(statusEl, "Sync Push: uploading to Google Sheet…");

  const payload = {
    vocab: getVocab(),
    progress: getProgressMap(),
    settings: exportSettings()
  };

  const url = SYNC_URL.replace(/\/$/, "") + "/api/push";
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    setStatus(statusEl, `Push failed (HTTP ${res.status}).`, "error");
    return;
  }

  const envelope = await res.json();
  if (!envelope.ok) {
    const msg = envelope?.error?.message || envelope?.error || "unknown error";
    setStatus(statusEl, `Push failed: ${msg}`, "error");
    return;
  }

  const payloadResp = envelope.data;
  setStatus(
    statusEl,
    `Pushed ✅ vocab=${payloadResp?.counts?.vocab ?? "?"}, progress=${payloadResp?.counts?.progress ?? "?"}, settings=ok.`,
    "ok"
  );
}

function ensureVerbClozeDefaults(s) {
  s.practice = s.practice || {};
  s.practice.verbLists = Array.isArray(s.practice.verbLists)
    ? s.practice.verbLists
    : [{ id: "list1", name: "Verb List 1", verbIds: [] }];

  s.practice.activeVerbListId =
    s.practice.activeVerbListId || s.practice.verbLists[0].id;

  s.practice.verbCloze = s.practice.verbCloze || {
    verbListId: s.practice.activeVerbListId,
    tenses: ["preterite"]
  };

  if (!s.practice.verbCloze.verbListId) {
    s.practice.verbCloze.verbListId = s.practice.activeVerbListId;
  }

  // We keep tenses fixed to preterite for Step 3
  s.practice.verbCloze.tenses = ["preterite"];

  return s;
}

function getVerbsInList(listId, settings, vocab) {
  const list = (settings.practice.verbLists || []).find(l => l.id === listId);
  const ids = new Set(list?.verbIds || []);
  return vocab.filter(v => v.pos === "verb" && ids.has(v.id));
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function renderVerbCloze(pageRoot) {
  const s = ensureVerbClozeDefaults(getSettings());
  importSettings(s);

  pageRoot.innerHTML = `
    <div class="page">
      <div class="headerRow">
        <h2>Verb Cloze</h2>
        <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
          <button class="btn" id="pullBtn" type="button">Pull</button>
          <button class="btn" id="pushBtn" type="button">Push</button>
          <div id="syncStatus" class="p" style="margin:0;"></div>
        </div>
      </div>

      <div class="card" style="margin-top:12px;">
        <h3>Settings</h3>
        <div class="form">
          <div>
            <div class="label">Verb list</div>
            <select class="select" id="verbListSelect"></select>
            <div class="p" id="listMeta" style="margin-top:8px;"></div>
          </div>
          <div>
            <div class="label">Tense</div>
            <div class="p" style="margin-top:6px;">Pretérito (fixed for Step 3)</div>
            <div class="p" style="margin-top:6px;">Answers are always accent-tolerant.</div>
          </div>
        </div>
      </div>

      <div class="card" style="margin-top:12px;">
        <h3>Exercise</h3>

        <div class="p" id="exerciseHint" style="margin-top:6px;"></div>

        <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:flex-end; margin-top:10px;">
          <div style="min-width:240px;">
            <div class="label">Prompt</div>
            <div id="promptBox" class="p" style="margin-top:6px;"></div>
          </div>

          <div style="min-width:200px;">
            <div class="label">Your answer</div>
            <input class="input" id="answerInput" placeholder="type the conjugated form…" autocomplete="off" />
          </div>

          <div style="display:flex; gap:10px; align-items:center;">
            <button class="btn" id="checkBtn" type="button">Check</button>
            <button class="btn" id="nextBtn" type="button">Next</button>
          </div>
        </div>

        <div class="p" id="feedback" style="margin-top:10px;"></div>
        <div class="p" id="scoreMeta" style="margin-top:6px;"></div>
      </div>

      <div class="card" style="margin-top:12px;">
        <h3>Preview</h3>
        <div class="p" id="previewMeta"></div>
        <div id="previewList"></div>
      </div>
    </div>
  `;

  const statusEl = pageRoot.querySelector("#syncStatus");
  const listSelect = pageRoot.querySelector("#verbListSelect");
  const listMeta = pageRoot.querySelector("#listMeta");
  const previewMeta = pageRoot.querySelector("#previewMeta");
  const previewList = pageRoot.querySelector("#previewList");

  const exerciseHint = pageRoot.querySelector("#exerciseHint");
  const promptBox = pageRoot.querySelector("#promptBox");
  const answerInput = pageRoot.querySelector("#answerInput");
  const feedback = pageRoot.querySelector("#feedback");
  const scoreMeta = pageRoot.querySelector("#scoreMeta");
  const checkBtn = pageRoot.querySelector("#checkBtn");
  const nextBtn = pageRoot.querySelector("#nextBtn");

  const session = { attempts: 0, correct: 0 };
  let current = null; // { infinitive, personKey, personLabel, correctForm }

  function buildSupportedPool() {
    const settings = ensureVerbClozeDefaults(getSettings());
    const vocab = getVocab();

    const lists = settings.practice.verbLists;
    const activeListId = settings.practice.verbCloze.verbListId;

    const verbs = getVerbsInList(activeListId, settings, vocab);
    const supported = verbs.filter(v => isSupportedRegularPreterite(v.lemma));

    return { settings, vocab, lists, activeListId, verbs, supported };
  }

  function renderListsAndPreview() {
    const { settings, vocab, lists, activeListId, verbs, supported } = buildSupportedPool();

    listSelect.innerHTML = lists.map(l =>
      `<option value="${escapeHtml(l.id)}" ${l.id === activeListId ? "selected" : ""}>${escapeHtml(l.name)}</option>`
    ).join("");

    listMeta.textContent =
      `List verbs: ${verbs.length} total. Supported for Step 3 exercise: ${supported.length}.`;

    const show = verbs.slice(0, 30);
    previewMeta.textContent = verbs.length
      ? `Showing ${show.length}${verbs.length > show.length ? " (first 30)" : ""}.`
      : "No verbs in this list yet.";

    previewList.innerHTML = show.length
      ? `<ul>${show.map(v => `<li><b>${escapeHtml(v.lemma)}</b> — ${escapeHtml(v.translation)}</li>`).join("")}</ul>`
      : `<div class="p">Nothing to preview.</div>`;

    // Persist settings
    importSettings(settings);
  }

  function setPrompt() {
    if (!current) {
      promptBox.innerHTML = "";
      return;
    }
    promptBox.innerHTML =
      `<div><b>Conjugate</b> <span style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;">${escapeHtml(current.infinitive)}</span>` +
      ` <b>in Pretérito</b> for <b>${escapeHtml(current.personLabel)}</b>.</div>`;
  }

  function setScore() {
    scoreMeta.textContent = `Session: ${session.correct}/${session.attempts} correct.`;
  }

  function newExercise() {
    const { supported, verbs } = buildSupportedPool();

    feedback.textContent = "";
    answerInput.value = "";

    if (!verbs.length) {
      exerciseHint.textContent = "No verbs in this list yet. Add verbs in Vocabulary and tick them into the active list.";
      current = null;
      setPrompt();
      setScore();
      return;
    }

    if (!supported.length) {
      exerciseHint.textContent =
        "This list has verbs, but none are supported yet for Step 3 (currently only regular Pretérito without spelling/stem changes). " +
        "Add a regular verb like 'hablar', 'comer', 'vivir' to test.";
      current = null;
      setPrompt();
      setScore();
      return;
    }

    const verb = pickRandom(supported);
    const person = pickRandom(PERSONS);

    let correctForm = "";
    try {
      correctForm = conjugate(verb.lemma, "preterite", person.key);
    } catch (e) {
      // Extremely defensive; if something slips through, try again
      exerciseHint.textContent = "Could not generate an exercise for the current list. Add a regular verb like 'hablar'.";
      current = null;
      setPrompt();
      setScore();
      return;
    }

    current = {
      infinitive: verb.lemma,
      personKey: person.key,
      personLabel: person.label,
      correctForm
    };

    exerciseHint.textContent = "Type the conjugated form. Accents are ignored (áéíóú), but ñ must be ñ.";
    setPrompt();
    setScore();
    answerInput.focus();
  }

  function checkAnswer() {
    if (!current) return;

    const user = answerInput.value;
    const ok = answersEqualTolerant(user, current.correctForm);

    session.attempts += 1;
    if (ok) session.correct += 1;

    if (ok) {
      feedback.innerHTML = `✅ Correct: <b>${escapeHtml(current.correctForm)}</b>`;
      setStatus(feedback, feedback.textContent, "ok");
    } else {
      feedback.innerHTML =
        `❌ Not quite. Correct is: <b>${escapeHtml(current.correctForm)}</b>` +
        `<div class="p" style="margin-top:6px;">You typed: <span style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;">${escapeHtml(user)}</span></div>`;
      setStatus(feedback, feedback.textContent, "error");
    }

    setScore();
  }

  // Events
  listSelect.addEventListener("change", e => {
    const settings = ensureVerbClozeDefaults(getSettings());
    settings.practice.verbCloze.verbListId = e.target.value;
    importSettings(settings);

    renderListsAndPreview();
    newExercise();
  });

  pageRoot.querySelector("#pullBtn").onclick = async () => {
    await syncPull(statusEl);
    renderListsAndPreview();
    newExercise();
  };

  pageRoot.querySelector("#pushBtn").onclick = async () => {
    await syncPush(statusEl);
  };

  checkBtn.onclick = () => checkAnswer();
  nextBtn.onclick = () => newExercise();

  answerInput.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") {
      // If feedback already shown for current attempt, Enter goes next; otherwise check.
      if (feedback.textContent && feedback.textContent.trim().length > 0) newExercise();
      else checkAnswer();
    }
  });

  // Initial render
  renderListsAndPreview();
  newExercise();
}
