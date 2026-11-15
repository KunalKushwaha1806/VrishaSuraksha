import { env, features } from "./env";
import { log } from "./logger";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export type Mailer = (message: EmailMessage) => Promise<void>;

/** Messages "sent" while no SMTP server is configured (local dev and tests). */
export const outbox: EmailMessage[] = [];

let override: Mailer | null = null;
let smtp: Mailer | null = null;

/** Test helper: replace the mailer. Pass null to restore the default. */
export function setMailerForTests(mailer: Mailer | null): void {
  override = mailer;
}

async function smtpMailer(): Promise<Mailer> {
  if (smtp) return smtp;
  const nodemailer = await import("nodemailer");
  const e = env();
  const transport = nodemailer.createTransport({
    host: e.SMTP_HOST,
    port: e.SMTP_PORT,
    secure: e.SMTP_PORT === 465,
    requireTLS: e.SMTP_PORT !== 465,
    auth: { user: e.SMTP_USER, pass: e.SMTP_PASS },
  });
  smtp = async (m) => {
    await transport.sendMail({ from: e.EMAIL_FROM, to: m.to, subject: m.subject, text: m.text, html: m.html });
  };
  return smtp;
}

/** Placeholder demo addresses are never emailed. */
const isUndeliverable = (to: string) => /@example\.(com|org|net)$/i.test(to);

export async function sendEmail(message: EmailMessage): Promise<void> {
  if (override) return override(message);
  if (!features.email() || isUndeliverable(message.to)) {
    outbox.push(message);
    if (outbox.length > 200) outbox.shift();
    log.info("Email captured (SMTP not configured or demo address)", { subject: message.subject });
    return;
  }
  const send = await smtpMailer();
  await send(message);
}
