import { beforeEach, describe, expect, it } from "vitest";
import { C, type DoseEvent, type Job, type Medication } from "@/lib/models";
import { claimRefill } from "@/lib/services/care";
import { logDose } from "@/lib/services/doses";
import { generateUpcoming, processJob, tick } from "@/lib/services/engine";
import { istDayKey, istToUtc } from "@/lib/time";
import { EVERY_DAY, harness, makeMember, medication, type Harness } from "./helpers";

const TODAY = istDayKey(new Date("2026-11-15T06:00:00Z"));
const at = (hhmm: string) => istToUtc(TODAY, hhmm);

let h: Harness;
let med: Medication;

async function doses(): Promise<DoseEvent[]> {
  return h.db.query<DoseEvent>(C.doses("c1"), { orderBy: { field: "scheduledFor" } });
}
async function jobs(): Promise<Job[]> {
  return h.db.query<Job>(C.jobs);
}
const recipients = () => h.sent.map((m) => m.to.split("@")[0]);

beforeEach(async () => {
  h = await harness();
  med = medication({ schedule: { times: ["09:00"], days: EVERY_DAY, startDate: TODAY, endDate: null } });
  await h.db.set(C.medications("c1"), med.id, med);
  await generateUpcoming(at("08:00"));
});

describe("dose generation", () => {
  it("creates the next 48 hours of doses with an escalation ladder each", async () => {
    const list = await doses();
    expect(list.map((d) => d.dayKey)).toHaveLength(2);
    expect(list[0].scheduledFor).toBe(at("09:00").toISOString());
    expect((await jobs()).filter((j) => j.doseId === list[0].id)).toHaveLength(5);
  });

  it("is idempotent", async () => {
    const before = (await jobs()).length;
    await generateUpcoming(at("08:00"));
    await generateUpcoming(at("08:30"));
    expect(await doses()).toHaveLength(2);
    expect((await jobs()).length).toBe(before);
  });
});

describe("reminder delivery", () => {
  it("emails the elder at dose time with a one-tap link", async () => {
    await tick(at("09:00"));
    expect(recipients()).toEqual(["elder"]);
    expect(h.sent[0].subject).toContain("Metformin");
    expect(h.sent[0].text).toMatch(/http:\/\/localhost:3000\/a\/[\w.-]+/);
  });

  it("sends exactly one email when two ticks run at the same moment", async () => {
    await Promise.all([tick(at("09:00")), tick(at("09:00")), tick(at("09:00"))]);
    expect(h.sent).toHaveLength(1);
  });

  it("escalates elder, elder, caretaker, family, then marks the dose missed", async () => {
    for (const time of ["09:00", "09:15", "09:30", "10:00", "10:30"]) await tick(at(time));
    expect(recipients()).toEqual(["elder", "elder", "caretaker", "family", "elder"]);
    expect((await doses())[0].status).toBe("MISSED");
  });

  it("stops escalating as soon as the dose is logged", async () => {
    await tick(at("09:00"));
    const doseId = (await doses())[0].id;
    await logDose(h.circle, h.elder, doseId, { status: "TAKEN" }, at("09:05"));
    for (const time of ["09:15", "09:30", "10:00", "10:30"]) await tick(at(time));
    expect(h.sent).toHaveLength(1);
    const ladder = (await jobs()).filter((j) => j.doseId === doseId);
    expect(ladder.filter((j) => j.status === "cancelled").map((j) => j.kind).sort()).toEqual([
      "caretaker_alert",
      "elder_renudge",
      "family_alert",
      "mark_missed",
    ]);
  });

  it("skips family alerts for members who are not allowed to see doses", async () => {
    await h.db.set(C.members("c1"), "private", makeMember("c1", "private", "FAMILY", { doses: false }));
    for (const time of ["09:00", "09:15", "09:30", "10:00"]) await tick(at(time));
    expect(recipients()).not.toContain("private");
  });

  it("retries after a failure without emailing anyone twice", async () => {
    await h.db.set(C.members("c1"), "family2", makeMember("c1", "family2", "FAMILY"));
    const familyJob = (await jobs()).find((j) => j.kind === "family_alert" && j.dueAt === istToUtc(TODAY, "10:00").toISOString())!;
    await h.db.update(C.jobs, familyJob.id, { dueAt: at("08:00").toISOString() });

    h.failNext(0);
    // First recipient succeeds, second fails.
    let calls = 0;
    const { setMailerForTests } = await import("@/lib/email");
    setMailerForTests(async (m) => {
      calls++;
      if (calls === 2) throw new Error("SMTP unavailable");
      h.sent.push(m);
    });
    expect(await processJob(familyJob.id, at("08:00"))).toBe("retry");
    expect(await processJob(familyJob.id, at("08:30"))).toBe("sent");
    expect(recipients().sort()).toEqual(["family", "family2"]);
  });

  it("gives up after three failed attempts and records the error", async () => {
    const due = (await jobs()).find((j) => j.kind === "dose_due" && j.dueAt === at("09:00").toISOString())!;
    h.failNext(10);
    expect(await processJob(due.id, at("09:00"))).toBe("retry");
    expect(await processJob(due.id, at("09:05"))).toBe("retry");
    expect(await processJob(due.id, at("09:30"))).toBe("failed");
    const job = await h.db.get<Job>(C.jobs, due.id);
    expect(job).toMatchObject({ status: "failed", attempts: 3, lastError: "SMTP unavailable" });
  });
});

describe("dose logging", () => {
  it("decrements stock when a dose is taken", async () => {
    await logDose(h.circle, h.elder, (await doses())[0].id, { status: "TAKEN" }, at("09:01"));
    expect((await h.db.get<Medication>(C.medications("c1"), "m1"))?.stock).toBe(29);
  });

  it("refuses to log the same dose twice", async () => {
    const id = (await doses())[0].id;
    await logDose(h.circle, h.elder, id, { status: "TAKEN" }, at("09:01"));
    await expect(logDose(h.circle, h.caretaker, id, { status: "TAKEN" }, at("09:02"))).rejects.toMatchObject({ status: 409 });
  });

  it("guards against a double dose across slots and alerts the caretaker when confirmed", async () => {
    const twice = medication({ id: "m2", name: "Paracetamol", schedule: { times: ["09:00", "11:00"], days: EVERY_DAY, startDate: TODAY, endDate: null } });
    await h.db.set(C.medications("c1"), twice.id, twice);
    await generateUpcoming(at("08:00"));
    const [first, second] = (await doses()).filter((d) => d.medicationId === "m2");
    await logDose(h.circle, h.elder, first.id, { status: "TAKEN" }, at("09:00"));
    await expect(logDose(h.circle, h.elder, second.id, { status: "TAKEN" }, at("09:20"))).rejects.toMatchObject({
      status: 409,
      details: { reason: "double_dose" },
    });
    h.sent.length = 0;
    await logDose(h.circle, h.elder, second.id, { status: "TAKEN", confirmDouble: true }, at("09:21"));
    expect(h.sent.map((m) => m.subject)).toEqual(["Possible double dose of Paracetamol"]);
    expect(recipients()).toEqual(["caretaker"]);
  });

  it("routes 'ran out' to a refill alert for caretakers and family", async () => {
    await logDose(h.circle, h.elder, (await doses())[0].id, { status: "MISSED", reason: "ran_out" }, at("09:10"));
    expect((await h.db.get<Medication>(C.medications("c1"), "m1"))?.stock).toBe(0);
    await tick(new Date());
    const refill = h.sent.filter((m) => m.subject.startsWith("Refill needed"));
    expect(refill.map((m) => m.to.split("@")[0]).sort()).toEqual(["caretaker", "family"]);
  });

  it("routes 'side effect' to the caretaker and the symptom diary", async () => {
    await logDose(h.circle, h.elder, (await doses())[0].id, { status: "MISSED", reason: "side_effect" }, at("09:10"));
    expect(recipients()).toEqual(["caretaker"]);
    expect(await h.db.query(C.symptoms("c1"))).toHaveLength(1);
  });

  it("does nothing extra when the elder simply forgot", async () => {
    await logDose(h.circle, h.elder, (await doses())[0].id, { status: "MISSED", reason: "forgot" }, at("09:10"));
    expect(h.sent).toHaveLength(0);
  });
});

describe("refill claims", () => {
  it("lets only one person claim a refill", async () => {
    await claimRefill("c1", h.family, "m1");
    await expect(claimRefill("c1", h.caretaker, "m1")).rejects.toMatchObject({ status: 409 });
  });

  it("suppresses further refill emails once claimed", async () => {
    await h.db.update(C.medications("c1"), "m1", { stock: 2 });
    await claimRefill("c1", h.family, "m1");
    await generateUpcoming(at("12:00"));
    await tick(at("12:00"));
    expect(h.sent.filter((m) => m.subject.startsWith("Refill"))).toHaveLength(0);
  });
});
