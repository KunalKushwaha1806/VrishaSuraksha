import { describe, expect, it } from "vitest";
import { diffPrescription, frequencyToTimes, normalizeName, type ExtractedMedicine } from "@/lib/domain/prescription";

const rx = (name: string, dose: string | null, frequency: string | null): ExtractedMedicine => ({
  name,
  dose,
  frequency,
  durationDays: null,
  instructions: null,
});

describe("normalizeName", () => {
  it("ignores form words, strengths and punctuation", () => {
    expect(normalizeName("Tab. Metformin 500mg")).toBe("metformin");
    expect(normalizeName("METFORMIN")).toBe("metformin");
    expect(normalizeName("Cap Omeprazole 20 mg")).toBe("omeprazole");
  });
});

describe("frequencyToTimes", () => {
  it("reads Indian morning-afternoon-night notation", () => {
    expect(frequencyToTimes("1-0-1")).toEqual(["08:00", "21:00"]);
    expect(frequencyToTimes("1-1-1")).toEqual(["08:00", "14:00", "21:00"]);
    expect(frequencyToTimes("0-0-1")).toEqual(["21:00"]);
  });

  it("reads common abbreviations", () => {
    expect(frequencyToTimes("BD")).toEqual(["09:00", "21:00"]);
    expect(frequencyToTimes("TDS after food")).toEqual(["08:00", "14:00", "20:00"]);
    expect(frequencyToTimes("once daily")).toEqual(["09:00"]);
    expect(frequencyToTimes("HS")).toEqual(["21:00"]);
    expect(frequencyToTimes(null)).toEqual(["09:00"]);
  });
});

describe("diffPrescription", () => {
  const current = [
    { id: "a", name: "Metformin", doseText: "500 mg", times: ["09:00", "21:00"] },
    { id: "b", name: "Amlodipine", doseText: "5 mg", times: ["09:00"] },
    { id: "c", name: "Atorvastatin", doseText: "10 mg", times: ["21:00"] },
  ];

  it("classifies added, changed, stopped and unchanged medicines", () => {
    const diff = diffPrescription(current, [
      rx("Tab Metformin", "500mg", "BD"),
      rx("Amlodipine", "10 mg", "OD"),
      rx("Pantoprazole", "40 mg", "1-0-0"),
    ]);
    const byName = Object.fromEntries(diff.map((d) => [d.name, d]));
    expect(byName.Pantoprazole.kind).toBe("added");
    expect(byName.Pantoprazole.after?.times).toEqual(["08:00"]);
    expect(byName.Amlodipine.kind).toBe("changed");
    expect(byName.Amlodipine.changes).toEqual(["dose"]);
    expect(byName.Atorvastatin.kind).toBe("stopped");
    expect(byName.Metformin.kind).toBe("unchanged");
  });

  it("orders results so the important changes come first", () => {
    const diff = diffPrescription(current, [rx("Metformin", "500 mg", "BD"), rx("Newmed", "1 mg", "OD")]);
    expect(diff.map((d) => d.kind)).toEqual(["added", "stopped", "stopped", "unchanged"]);
  });

  it("detects timing changes and keeps the old dose when none is written", () => {
    const [item] = diffPrescription([current[0]], [rx("Metformin", null, "1-1-1")]);
    expect(item.kind).toBe("changed");
    expect(item.changes).toEqual(["timing"]);
    expect(item.after?.doseText).toBe("500 mg");
  });

  it("keeps the family's times when the prescription names the same parts of the day", () => {
    const own = [{ id: "m", name: "Metformin", doseText: "500 mg", times: ["08:30", "20:30"] }];
    const [item] = diffPrescription(own, [rx("Tab. Metformin", "500mg", "1-0-1")]);
    expect(item.kind).toBe("unchanged");
    expect(item.after?.times).toEqual(["08:30", "20:30"]);
  });

  it("shows new medicines without the tablet prefix", () => {
    const [item] = diffPrescription([], [rx("Tab. Telmisartan", "40 mg", "0-0-1")]);
    expect(item.name).toBe("Telmisartan");
  });

  it("ignores duplicate lines for the same medicine", () => {
    const diff = diffPrescription([], [rx("Metformin", "500 mg", "BD"), rx("Tab. Metformin", "500 mg", "BD")]);
    expect(diff).toHaveLength(1);
  });
});
