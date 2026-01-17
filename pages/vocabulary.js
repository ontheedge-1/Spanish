import { getVocab, addVocab, deleteVocab } from "../data/vocabStore.js";
import { getProgressMap, ensureProgress } from "../data/progressStore.js";

const SYNC_URL = "https://spanish-sync-proxy.ricokunzed.workers.dev";  // cloudflare worker

function uid() {
  return "v_" + Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);
}

function strengthToPriority(strength) {
  const prio = Math.round((1 - strength) * 100);
  return Math.max(0, Math.min(100, prio));
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

// --- Local storage keys (must match stores) ---
const VOCAB_KEY = "spanishtrainer:vocab:v1";
const PROGRESS_KEY = "spanishtrainer:progress:v1";

function setStatus(el, msg, kind = "info") {
  el.textContent = msg || "";
  el.style.color = kind === "error" ? "#b91c1c" : (kind === "ok" ? "#1d4ed8" : "#6b7280");
}

function normalizeIncomingVocab(vocabArr) {
  // Apps Script returns tags as "a,b,c" (string). Normalize to array.
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
  // Apps Script returns progress rows as array of objects
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
  if (!SYNC_URL || SYNC_URL.includes("PASTE_YOUR")) {
    setStatus(statusEl, "SYNC_URL is not set yet. Paste your Apps Script /exec URL at the top of this file.", "error");
    return;
  }

  setStatus(statusEl, "Sync Pull: loading from Google Sheet…");

  const url = SYNC_URL.replace(/\/$/, "") + "/api/pull";
  const res = await fetch(url, { method: "GET" });

  if (!res.ok) {
    setStatus(statusEl, `Pull failed (HTTP ${res.status}).`, "error");
    return;
  }

  const data = await res.json();
  if (!data.ok) {
    setStatus(statusEl, `Pull failed: ${data.error || "unknown error"}`, "error");
    return;
  }

  const vocab = normalizeIncomingVocab(data.vocab);
  const progressMap = normalizeIncomingProgress(data.progress);

  // Replace local storage (source of truth = sheet)
  localStorage.setItem(VOCAB_KEY, JSON.stringify(vocab));
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(progressMap));

  setStatus(statusEl, `Pulled ${vocab.length} vocab items and ${Object.keys(progressMap).length} progress rows.`, "ok");
}

async function syncPush(statusEl) {
  if (!SYNC_URL || SYNC_URL.includes("PASTE_YOUR")) {
    setStatus(statusEl, "SYNC_URL is not set yet. Paste your Apps Script /exec URL at the top of this file.", "error");
    return;
  }

  setStatus(statusEl, "Sync Push: uploading to Google Sheet…");

  // Read local
  const vocab = getVocab();
  const progressMap = getProgressMap();

  const payload = {
    vocab,
    progress: progressMap
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

  const data = await res.json();
  if (!data.ok) {
    setStatus(statusEl, `Push failed: ${data.error || "unknown error"}`, "error");
    return;
  }

  setStatus(statusEl, `Pushed ✅ vocab=${data.counts?.vocab ?? "?"}, progress=${data.counts?.progress ?? "?"}`, "ok");
}

function renderTable(root, { items, progress }) {
  const tableWrap = document.createElement("div");

  if (items.length === 0) {
    tableWrap.innerHTML = `
      <div class="card">
        <h3>No items yet</h3>
        <p>Add your first word or phrase above, e.g. <strong>pagar</strong> → <strong>to pay</strong>.</p>
      </div>
    `;
    root.append(tableWrap);
    return;
  }

  const rows = items.map(item => {
    const p = progress[item.id] || { strength: 0.25, seen: 0, correct: 0 };
    const prio = strengthToPriority(p.strength);

    const badgeClass =
      item.pos === "verb" ? "blue"
      : item.pos === "phrase" ? "purple"
      : item.pos === "noun" ? "purple"
      : "";

    return `
      <tr>
        <td><strong>${escapeHtml(item.lemma)}</strong></td>
        <td>${escapeHtml(item.translation)}</td>
        <td><span class="badge ${badgeClass}">${escapeHtml(item.pos)}</span></td>
        <td>
          <span class="badge">${Math.round(p.strength * 100)}%</span>
          <span class="badge">Prio ${prio}</span>
        </td>
        <td>${p.correct}/${p.seen}</td>
        <td style="text-align:right;">
          <button class="btn danger" data-del="${item.id}">Delete</button>
        </td>
      </tr>
    `;
  }).join("");

  tableWrap.innerHTML = `
    <table class="table" aria-label="Vocabulary list">
      <thead>
        <tr>
          <th>Spanish</th>
          <th>English</th>
          <th>POS</th>
          <th>Strength / Priority</th>
          <th>Hits</th>
          <th></th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;

  root.append(tableWrap);

  tableWrap.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-del]");
    if (!btn) return;

    const id = btn.getAttribute("data-del");
    if (!id) return;

    const ok = confirm("Delete this item?");
    if (!ok) return;

    deleteVocab(id);
    renderVocabulary(root.parentElement);
  });
}

export function renderVocabulary(root) {
  root.innerHTML = "";

  const header = document.createElement("div");
  header.innerHTML = `
    <div class="h1">Vocabulary</div>
    <div class="p">
      Add words, phrases, and chunks you want to learn. This list powers Flashcards
      <span class="badge blue">and</span> later the LLM (so it can include your priority items in generated exercises).
    </div>
  `;

  const syncCard = document.createElement("div");
  syncCard.className = "card";
  syncCard.innerHTML = `
    <h3>Sync (Google Sheet)</h3>
    <div class="p">Use <strong>Pull</strong> to load from the Sheet onto this device. Use <strong>Push</strong> to upload this device’s data to the Sheet.</div>
    <div class="btnrow">
      <button class="btn" id="pullBtn" type="button">Sync Pull</button>
      <button class="btn primary" id="pushBtn" type="button">Sync Push</button>
    </div>
    <div class="p" id="syncStatus" style="margin-top:10px;"></div>
  `;

  const formCard = document.createElement("div");
  formCard.className = "card";
  formCard.innerHTML = `
    <h3>Add a new item</h3>
    <div class="p">
      Tip: nouns without article in Spanish (e.g. <strong>mesa</strong>). Phrases are welcome (e.g. <strong>es lo que hay</strong>).
    </div>

    <form id="vForm" class="form">
      <div>
        <div class="label">Spanish (word / phrase)</div>
        <input class="input" name="lemma" placeholder="pagar / mesa / es lo que hay" required />
      </div>

      <div>
        <div class="label">English meaning</div>
        <input class="input" name="translation" placeholder="to pay / table / that's just how it is" required />
      </div>

      <div>
        <div class="label">Part of speech</div>
        <select class="select" name="pos">
          <option value="verb">verb</option>
          <option value="noun">noun</option>
          <option value="adj">adj</option>
          <option value="phrase">phrase</option>
          <option value="other">other</option>
        </select>
      </div>

      <div>
        <div class="label">Tags (optional, comma-separated)</div>
        <input class="input" name="tags" placeholder="daily_life, travel, clitics" />
      </div>

      <div style="grid-column: 1 / -1; display:flex; gap:10px; flex-wrap:wrap;">
        <button class="btn primary" type="submit">Add</button>
        <button class="btn" type="button" id="seedBtn">Insert demo items</button>
      </div>
    </form>
  `;

  const listWrap = document.createElement("div");
  listWrap.className = "card";
  listWrap.innerHTML = `
    <h3>Your list</h3>
    <div class="p">
      Strength starts at 25%. Priority is (1 - strength) → higher priority means it should appear more often in practice.
    </div>
    <div class="hr"></div>
    <div id="tableArea"></div>
  `;

  root.append(header, syncCard, formCard, listWrap);

  const statusEl = syncCard.querySelector("#syncStatus");
  setStatus(statusEl, "Ready.");

  syncCard.querySelector("#pullBtn").addEventListener("click", async () => {
    try {
      await syncPull(statusEl);
      refreshTable();
    } catch (err) {
      setStatus(statusEl, `Pull error: ${err.message}`, "error");
    }
  });

  syncCard.querySelector("#pushBtn").addEventListener("click", async () => {
    try {
      await syncPush(statusEl);
    } catch (err) {
      setStatus(statusEl, `Push error: ${err.message}`, "error");
    }
  });

  function refreshTable() {
    const items = getVocab()
      .slice()
      .sort((a, b) => a.lemma.localeCompare(b.lemma, "es"));

    items.forEach(it => ensureProgress(it.id));

    const progress = getProgressMap();
    const area = listWrap.querySelector("#tableArea");
    area.innerHTML = "";
    renderTable(area, { items, progress });
  }

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
    form.querySelector('select[name="pos"]').value = "verb";
    refreshTable();
  });

  formCard.querySelector("#seedBtn").addEventListener("click", () => {
    const demos = [
      { lemma: "pagar", translation: "to pay", pos: "verb", tags: ["daily_life"] },
      { lemma: "mesa", translation: "table", pos: "noun", tags: ["home"] },
      { lemma: "es lo que hay", translation: "that's just how it is", pos: "phrase", tags: ["idiom", "spoken"] },
      { lemma: "decir", translation: "to say / to tell", pos: "verb", tags: ["verbs"] }
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
