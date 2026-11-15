import { describe, expect, it } from "vitest";
import { escapeHtml, renderEmail } from "@/lib/services/emailTemplates";

describe("Email Templates & HTML Escaping", () => {
  it("escapes malicious characters in user-provided content", () => {
    const raw = `<script>alert("xss")</script> & 'single'`;
    const escaped = escapeHtml(raw);
    expect(escaped).not.toContain("<script>");
    expect(escaped).toContain("&lt;script&gt;");
    expect(escaped).toContain("&amp;");
    expect(escaped).toContain("&#39;single&#39;");
  });

  it("renders accessible email structure with action button and disclaimer", () => {
    const rendered = renderEmail({
      to: "dadaji@example.com",
      subject: "Dose Reminder: Metformin",
      heading: "Time for your morning medicine",
      lines: ["Please take 1 tablet of Metformin (500 mg) with water."],
      action: {
        label: "I Took It",
        url: "https://vridhasuraksha.vercel.app/a/test-token",
      },
      lang: "en",
    });

    expect(rendered.to).toBe("dadaji@example.com");
    expect(rendered.subject).toBe("Dose Reminder: Metformin");
    expect(rendered.html).toContain("Time for your morning medicine");
    expect(rendered.html).toContain("I Took It");
    expect(rendered.html).toContain("https://vridhasuraksha.vercel.app/a/test-token");
    expect(rendered.html).toContain("VridhaSuraksha supports daily routines");
    expect(rendered.text).toContain("Time for your morning medicine");
  });
});
