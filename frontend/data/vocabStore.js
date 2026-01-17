export async function getVocab() {
  return JSON.parse(localStorage.getItem("vocab") || "[]");
}

export async function addVocab(item) {
  const all = await getVocab();
  all.push(item);
  localStorage.setItem("vocab", JSON.stringify(all));
}
