import type { EmailMessage } from "../email";
import { env } from "../env";
import type { Lang } from "../models";

const DISCLAIMER =
  "VridhaSuraksha supports daily routines. It does not replace advice from a doctor or pharmacist.";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface EmailContent {
  to: string;
  subject: string;
  heading: string;
  lines: string[];
  action?: { label: string; url: string };
  lang?: Lang;
}

/** Renders a short, accessible, plain-looking email with one clear button. */
export function renderEmail(c: EmailContent): EmailMessage {
  const appUrl = env().APP_URL;
  const button = c.action
    ? `<p style="margin:24px 0"><a href="${escapeHtml(c.action.url)}" style="background:#b4410f;color:#ffffff;padding:14px 22px;border-radius:12px;text-decoration:none;font-size:18px;font-weight:600;display:inline-block">${escapeHtml(c.action.label)}</a></p>`
    : "";
  const html = `<!doctype html><html lang="${c.lang ?? "en"}"><body style="margin:0;background:#fffaf3;font-family:Arial,Helvetica,sans-serif;color:#1f1a17">
<div style="max-width:560px;margin:0 auto;padding:24px">
<p style="font-size:14px;color:#7a4a2a;margin:0 0 8px">VridhaSuraksha</p>
<h1 style="font-size:24px;line-height:1.3;margin:0 0 16px">${escapeHtml(c.heading)}</h1>
${c.lines.map((l) => `<p style="font-size:18px;line-height:1.5;margin:0 0 12px">${escapeHtml(l)}</p>`).join("\n")}
${button}
<p style="font-size:13px;color:#6b5e55;margin-top:32px">${escapeHtml(DISCLAIMER)}<br><a href="${escapeHtml(appUrl)}" style="color:#7a4a2a">Open VridhaSuraksha</a></p>
</div></body></html>`;
  const text = [c.heading, "", ...c.lines, "", c.action ? `${c.action.label}: ${c.action.url}` : "", "", DISCLAIMER]
    .filter((l, i, arr) => !(l === "" && arr[i - 1] === ""))
    .join("\n");
  return { to: c.to, subject: c.subject, html, text };
}
