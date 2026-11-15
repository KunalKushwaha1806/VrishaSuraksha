/**
 * Prescription change detection. Gemini only reads the image; this code,
 * not the model, decides what was added, changed or stopped.
 */

export interface ExtractedMedicine {
  name: string;
  dose: string | null;
  frequency: string | null;
  durationDays: number | null;
  instructions: string | null;
}

export interface CurrentMedicine {
  id: string;
  name: string;
  doseText: string;
  times: string[];
}

export type DiffKind = "added" | "changed" | "stopped" | "unchanged";

export interface DiffItem {
  kind: DiffKind;
  name: string;
  medicationId: string | null;
  before: { doseText: string; times: string[] } | null;
  after: { doseText: string; times: string[]; durationDays: number | null; instructions: string | null } | null;
  changes: string[];
}

const FORM_WORDS = /\b(tab|tabs|tablet|tablets|cap|caps|capsule|capsules|syp|syrup|inj|injection|drop|drops)\b\.?/g;

/** "Tab. Metformin 500" and "metformin" refer to the same medicine. */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(FORM_WORDS, " ")
    .replace(/\d+(\.\d+)?\s*(mg|mcg|g|ml|iu|units?)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeDose(dose: string): string {
  return dose.toLowerCase().replace(/\s+/g, "").replace(/milligrams?/g, "mg");
}

/**
 * Maps common prescription frequency notations to clock times in India.
 * Understands Indian "1-0-1" (morning-afternoon-night) notation and
 * OD / BD / TDS / QID / HS abbreviations. Unknown text defaults to morning.
 */
export function frequencyToTimes(frequency: string | null): string[] {
  const f = (frequency ?? "").toLowerCase().trim();
  const slots = f.match(/^(\d)\s*-\s*(\d)\s*-\s*(\d)$/);
  if (slots) {
    const out: string[] = [];
    if (slots[1] !== "0") out.push("08:00");
    if (slots[2] !== "0") out.push("14:00");
    if (slots[3] !== "0") out.push("21:00");
    return out.length ? out : ["09:00"];
  }
  if (/\b(qid|four times|4 times)\b/.test(f)) return ["08:00", "12:00", "16:00", "20:00"];
  if (/\b(tds|tid|thrice|three times|3 times)\b/.test(f)) return ["08:00", "14:00", "20:00"];
  if (/\b(bd|bid|twice|two times|2 times)\b/.test(f)) return ["09:00", "21:00"];
  if (/\b(hs|bedtime|night)\b/.test(f)) return ["21:00"];
  return ["09:00"];
}

/** "Tab. Telmisartan" is shown as "Telmisartan". */
export function displayName(name: string): string {
  const cleaned = name.replace(new RegExp(FORM_WORDS.source, "gi"), " ").replace(/\s+/g, " ").trim();
  return cleaned || name.trim();
}

/** Morning (before 12), afternoon (12-17) or night: the precision a prescription actually gives. */
function slotOf(time: string): number {
  const hour = Number(time.slice(0, 2));
  return hour < 12 ? 0 : hour < 17 ? 1 : 2;
}

/**
 * "1-0-1" says morning and night, not 08:00 and 21:00. A schedule already
 * set to 08:30 and 20:30 matches it, so the family's chosen times are kept.
 */
function sameSlots(a: string[], b: string[]): boolean {
  const key = (times: string[]) => times.map(slotOf).sort().join(",");
  return a.length === b.length && key(a) === key(b);
}

export function diffPrescription(current: CurrentMedicine[], extracted: ExtractedMedicine[]): DiffItem[] {
  const byName = new Map(current.map((m) => [normalizeName(m.name), m]));
  const seen = new Set<string>();
  const items: DiffItem[] = [];

  for (const e of extracted) {
    const key = normalizeName(e.name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const times = frequencyToTimes(e.frequency);
    const after = {
      doseText: e.dose ?? "",
      times,
      durationDays: e.durationDays,
      instructions: e.instructions,
    };
    const existing = byName.get(key);
    if (!existing) {
      items.push({ kind: "added", name: displayName(e.name), medicationId: null, before: null, after, changes: [] });
      continue;
    }
    const changes: string[] = [];
    if (e.dose && normalizeDose(e.dose) !== normalizeDose(existing.doseText)) changes.push("dose");
    const timingChanged = Boolean(e.frequency) && !sameSlots(times, existing.times);
    if (timingChanged) changes.push("timing");
    items.push({
      kind: changes.length ? "changed" : "unchanged",
      name: existing.name,
      medicationId: existing.id,
      before: { doseText: existing.doseText, times: existing.times },
      after: { ...after, doseText: e.dose ?? existing.doseText, times: timingChanged ? times : existing.times },
      changes,
    });
  }

  for (const [key, m] of byName) {
    if (!seen.has(key)) {
      items.push({
        kind: "stopped",
        name: m.name,
        medicationId: m.id,
        before: { doseText: m.doseText, times: m.times },
        after: null,
        changes: [],
      });
    }
  }

  const order: Record<DiffKind, number> = { added: 0, changed: 1, stopped: 2, unchanged: 3 };
  return items.sort((a, b) => order[a.kind] - order[b.kind]);
}
