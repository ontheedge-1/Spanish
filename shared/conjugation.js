/**
 * shared/conjugation.js
 *
 * Deterministic conjugation (Option B)
 * Always accent-tolerant comparison helpers
 *
 * Currently supports:
 * - Pretérito (indicative) regular -ar/-er/-ir
 * - Pretérito spelling changes in "yo" for -car/-gar/-zar:
 *   buscar -> busqué, pagar -> pagué, empezar -> empecé
 *
 * Later we’ll expand:
 * - irregular packs
 * - more tenses
 * - other preterite rules (i->y, stem changes, etc.)
 */

const PERSONS = ["yo", "tu", "el", "nosotros", "vosotros", "ellos"];

/** Always accent-tolerant normalization. Keeps ñ distinct (does NOT convert ñ -> n). */
export function normalizeEsAnswer(input) {
  let s = String(input ?? "").trim().toLowerCase();

  // Preserve ñ before stripping combining marks
  s = s.replace(/ñ/g, "__enie__");

  // Strip accents/diacritics
  s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // Restore ñ
  s = s.replace(/__enie__/g, "ñ");

  // Normalize whitespace
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

export function answersEqualTolerant(a, b) {
  return normalizeEsAnswer(a) === normalizeEsAnswer(b);
}

// --- Pretérito (regular) ---

const PRETERITE_ENDINGS = {
  ar: { yo: "é", tu: "aste", el: "ó", nosotros: "amos", vosotros: "asteis", ellos: "aron" },
  er: { yo: "í", tu: "iste", el: "ió", nosotros: "imos", vosotros: "isteis", ellos: "ieron" },
  ir: { yo: "í", tu: "iste", el: "ió", nosotros: "imos", vosotros: "isteis", ellos: "ieron" }
};

function verbClass(inf) {
  const s = String(inf || "").toLowerCase().trim();
  if (s.endsWith("ar")) return "ar";
  if (s.endsWith("er")) return "er";
  if (s.endsWith("ir")) return "ir";
  return null;
}

function baseStem(inf) {
  const s = String(inf || "").toLowerCase().trim();
  return s.slice(0, -2);
}

function applyPreteriteYoSpellingChange(infinitive, stem) {
  // Only relevant for -ar verbs in Pretérito, 1st person singular (yo)
  // -car -> qu (buscar->busqué), -gar -> gu (pagar->pagué), -zar -> c (empezar->empecé)
  const v = String(infinitive || "").toLowerCase().trim();

  if (v.endsWith("car")) return stem.slice(0, -1) + "qu";
  if (v.endsWith("gar")) return stem.slice(0, -1) + "gu";
  if (v.endsWith("zar")) return stem.slice(0, -1) + "c";
  return stem;
}

/**
 * Deterministic conjugation entry point.
 * @param {string} infinitive e.g. "hablar"
 * @param {"preterite"} tense
 * @param {"yo"|"tu"|"el"|"nosotros"|"vosotros"|"ellos"} person
 * @param {object} packs optional future irregular pack objects
 */
export function conjugate(infinitive, tense, person, packs = {}) {
  if (tense !== "preterite") {
    throw new Error(`Unsupported tense: ${tense}`);
  }
  if (!PERSONS.includes(person)) {
    throw new Error(`Unsupported person: ${person}`);
  }

  const cls = verbClass(infinitive);
  if (!cls) throw new Error(`Not a Spanish infinitive: ${infinitive}`);

  // FUTURE: irregular pack lookup (schema TBD)
  // const irregular = packs?.preterite?.[infinitive];
  // if (irregular) return irregular[person];

  const ending = PRETERITE_ENDINGS[cls][person];

  let stem = baseStem(infinitive);

  // Spelling change only applies to -ar "yo"
  if (cls === "ar" && person === "yo") {
    stem = applyPreteriteYoSpellingChange(infinitive, stem);
  }

  return stem + ending;
}
