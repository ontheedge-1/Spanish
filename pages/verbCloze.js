import { getVocab } from "../data/vocabStore.js";
import { getProgressMap } from "../data/progressStore.js";
import {
  exportSettings,
  getSettings,
  importSettings
} from "../data/settingsStore.js";

// Worker base URL (same as vocabulary.js)
const SYNC_URL = "https://spanish-sync-proxy.ricokunzedd.workers.dev";

const VOCAB_KEY = "spanishtrainer:vocab:v1";
const PROGRESS_KEY = "spanishtrainer:progress:v1";

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

  return s;
}

function getVerbsInList(listId, settings, vocab) {
  const list = (settings.practice.verbLists || []).find(l => l.id === listId);
  const ids = new Set(list?.verbIds || []);
  return vocab.filter(v => v.pos === "verb" && ids.has(v.id));
}

export function renderVerbCloze(pageRoot) {
  const s = ensureVerbClozeDefaults(getSettings());
  importSettings(s);

  pageRoot.innerHTML = `
    <div class="page">
      <div class="headerRow">
        <h2>Verb Cloze</h2>
        <div style="display:flex; gap:10px; align-items:center;">
          <button class="btn" id="pullBtn">Pull</button>
          <button class="btn" id="pushBtn">Push</button>
          <div id="syncStatus" class="p"></div>
        </div>
      </div>

      <div class="card" style="margin-top:12px;">
        <h3>Settings</h3>
        <div class="form">
          <div>
            <div class="label">Verb list</div>
            <select class="select" id="verbListSelect"></select>
            <div class="p" id="listMeta"></div>
          </div>
          <div>
            <div class="label">Tense</div>
            <div class="p">Pretérito (fixed)</div>
            <div class="p">Answers are always accent-tolerant.</div>
          </div>
        </div>
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

  function render() {
    const settings = ensureVerbClozeDefaults(getSettings());
    const vocab = getVocab();

    const lists = settings.practice.verbLists;
    const active = settings.practice.verbCloze.verbListId;

    listSelect.innerHTML = lists.map(l =>
      `<option value="${escapeHtml(l.id)}" ${l.id === active ? "selected" : ""}>${escapeHtml(l.name)}</option>`
    ).join("");

    const verbs = getVerbsInList(active, settings, vocab);

    listMeta.textContent = `Selected list contains ${verbs.length} verb(s).`;

    const show = verbs.slice(0, 30);
    previewMeta.textContent = verbs.length
      ? `Showing ${show.length}${verbs.length > show.length ? " (first 30)" : ""}.`
      : "No verbs in this list yet.";

    previewList.innerHTML = show.length
      ? `<ul>${show.map(v => `<li><b>${escapeHtml(v.lemma)}</b> — ${escapeHtml(v.translation)}</li>`).join("")}</ul>`
      : `<div class="p">Nothing to preview.</div>`;
  }

  listSelect.addEventListener("change", e => {
    const settings = ensureVerbClozeDefaults(getSettings());
    settings.practice.verbCloze.verbListId = e.target.value;
    importSettings(settings);
    render();
  });

  pageRoot.querySelector("#pullBtn").onclick = async () => {
    await syncPull(statusEl);
    render();
  };

  pageRoot.querySelector("#pushBtn").onclick = async () => {
    await syncPush(statusEl);
  };

  render();
}
