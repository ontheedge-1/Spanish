const KEY = "spanishtrainer:vocab:v1";

export function getVocab() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveVocab(list) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function addVocab(item) {
  const list = getVocab();
  list.push(item);
  saveVocab(list);
  return list;
}

export function deleteVocab(id) {
  const list = getVocab().filter(x => x.id !== id);
  saveVocab(list);
  return list;
}
