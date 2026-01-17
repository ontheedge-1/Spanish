const SETTINGS_KEY = "spanishtrainer:settings:v1";

function defaultSettings() {
  return {
    practice: {
      verbLists: [
        { id: "list1", name: "Verb List 1", verbIds: [] }
      ],
      activeVerbListId: "list1"
    }
  };
}

function mergeDefaults(s) {
  const d = defaultSettings();
  const out = { ...d, ...(s || {}) };

  out.practice = out.practice || d.practice;

  if (!Array.isArray(out.practice.verbLists) || out.practice.verbLists.length === 0) {
    out.practice.verbLists = d.practice.verbLists;
  }

  // enforce max 3 lists
  out.practice.verbLists = out.practice.verbLists.slice(0, 3);

  // ensure list shape
  out.practice.verbLists = out.practice.verbLists.map((l, idx) => ({
    id: String(l.id || `list${idx + 1}`),
    name: String(l.name || `Verb List ${idx + 1}`),
    verbIds: Array.isArray(l.verbIds) ? l.verbIds.map(String) : []
  }));

  // active list id must exist
  const ids = new Set(out.practice.verbLists.map(l => l.id));
  if (!ids.has(out.practice.activeVerbListId)) {
    out.practice.activeVerbListId = out.practice.verbLists[0].id;
  }

  return out;
}

export function getSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaultSettings();
    return mergeDefaults(JSON.parse(raw));
  } catch {
    return defaultSettings();
  }
}

export function setSettings(next) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(mergeDefaults(next)));
}

export function exportSettings() {
  return getSettings();
}

export function importSettings(incoming) {
  const merged = mergeDefaults(incoming || {});
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
  return merged;
}

export function getActiveVerbList(settings = getSettings()) {
  const id = settings.practice.activeVerbListId;
  return settings.practice.verbLists.find(l => l.id === id) || settings.practice.verbLists[0];
}

export function setActiveVerbListId(id) {
  const s = getSettings();
  if (s.practice.verbLists.some(l => l.id === id)) {
    s.practice.activeVerbListId = id;
    setSettings(s);
  }
  return getSettings();
}

export function createVerbList(name) {
  const s = getSettings();
  if (s.practice.verbLists.length >= 3) {
    return { ok: false, error: "Max 3 lists reached." };
  }
  const nextIndex = s.practice.verbLists.length + 1;
  const id = `list${nextIndex}`;
  s.practice.verbLists.push({
    id,
    name: (name || `Verb List ${nextIndex}`),
    verbIds: []
  });
  s.practice.activeVerbListId = id;
  setSettings(s);
  return { ok: true, id };
}

export function isVerbInActiveList(verbId, settings = getSettings()) {
  const list = getActiveVerbList(settings);
  return (list.verbIds || []).includes(String(verbId));
}

export function toggleVerbInActiveList(verbId) {
  const s = getSettings();
  const list = getActiveVerbList(s);
  const set = new Set(list.verbIds || []);
  const id = String(verbId);

  if (set.has(id)) set.delete(id);
  else set.add(id);

  list.verbIds = Array.from(set);
  setSettings(s);
  return getSettings();
}
