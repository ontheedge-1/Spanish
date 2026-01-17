/**
 * shared/conjugation.js
 *
 * Step 2 skeleton:
 * - Deterministic conjugation (Option B)
 * - Always accent-tolerant comparison helpers
 *
 * NOTE: This module intentionally starts small:
 * - implements REGULAR Pretérito (indicative) for -ar/-er/-ir
 * - provides hooks for irregular packs (shared/verbPacks/...)
 *
 * Later we’ll expand:
 * - more tenses
 * - irregular rules (j-stem, i->y, stem changes, etc.)
 * - full conjugation packs schema
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

function stem(inf) {
  const s = String(inf || "").toLowerCase().trim();
  return s.slice(0, -2);
}

/**
 * Deterministic conjugation entry point (Step 2: only preterite regular).
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
  // Example hook:
  // const irregular = packs?.preterite?.[infinitive];
  // if (irregular) return irregular[person];

  const end = PRETERITE_ENDINGS[cls][person];
  return stem(infinitive) + end;
}
