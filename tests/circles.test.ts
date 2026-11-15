import { describe, expect, it } from "vitest";
import { harness } from "./helpers";
import {
  createCircle,
  createInvite,
  exportCircle,
  joinCircle,
  listMembers,
  publicMember,
  updateMember,
} from "@/lib/services/circles";

describe("Circle & Member Management", () => {
  it("creates a circle and assigns the elder as owner", async () => {
    await harness(); // Sets up in-memory DB
    const res = await createCircle({
      circleName: "Kapoor Family",
      elderName: "Om Prakash",
      email: "om@example.com",
      passcode: "123456",
      language: "hi",
    });

    expect(res.circle.id).toBeDefined();
    expect(res.circle.code.length).toBe(6);
    expect(res.member.role).toBe("ELDER");
    expect(res.member.language).toBe("hi");
  });

  it("creates an invite and allows a family member to join", async () => {
    const { circle, elder } = await harness();

    const invite = await createInvite(circle, elder, "FAMILY");
    expect(invite.code).toBeDefined();

    const joined = await joinCircle({
      circleCode: circle.code,
      inviteCode: invite.code,
      name: "Rohit",
      email: "rohit@example.com",
      passcode: "567890",
      language: "en",
    });

    expect(joined.member.name).toBe("Rohit");
    expect(joined.member.role).toBe("FAMILY");

    const members = await listMembers(circle.id);
    expect(members.some((m) => m.name === "Rohit")).toBe(true);
  });

  it("elder revokes access of a member", async () => {
    const { circle, family, elder } = await harness();

    // Elder revokes member
    await updateMember(circle, elder, family.id, { active: false });
    const members = await listMembers(circle.id);
    const revoked = members.find((m) => m.id === family.id);
    expect(revoked?.active).toBe(false);
  });

  it("updates elder consent and per-member visibility flags", async () => {
    const { circle, elder, family } = await harness();

    const updated = await updateMember(circle, elder, family.id, {
      visibility: {
        doses: true,
        missedReasons: false, // hide reasons
        symptoms: false, // hide symptoms
        appointments: true,
        stock: true,
      },
    });

    expect(updated.visibility.missedReasons).toBe(false);
    expect(updated.visibility.appointments).toBe(true);

    const pub = publicMember(updated);
    expect((pub as Record<string, unknown>).passcodeHash).toBeUndefined(); // never leak hash
  });

  it("exports complete decrypted circle data for data portability", async () => {
    const { circle } = await harness();
    const exported = await exportCircle(circle);
    expect(exported.circle.name).toBe(circle.name);
    expect(exported.members.length).toBeGreaterThan(0);
    expect(exported.exportedAt).toBeDefined();
  });
});
