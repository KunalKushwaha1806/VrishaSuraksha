import type { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { z, type ZodType } from "zod";
import { env, features } from "../env";
import { fail } from "../http";
import { errorMessage, log } from "../logger";
import { BRIEF_SYSTEM, explainerPrompt, PRESCRIPTION_SYSTEM, PRESCRIPTION_USER } from "./prompts";

/**
 * Gemini, called only from the server. Output is always validated with Zod,
 * retried once on malformed output, and treated as a suggestion that a
 * person must confirm.
 */
const TIMEOUT_MS = 25_000;
let client: GoogleGenAI | null = null;

async function ai(): Promise<GoogleGenAI> {
  if (!features.ai()) throw fail.unavailable("AI help is not configured. You can still enter details by hand.");
  if (!client) {
    const { GoogleGenAI } = await import("@google/genai");
    client = new GoogleGenAI({ apiKey: env().GEMINI_API_KEY, apiVersion: "v1beta" });
  }
  return client;
}

type Part = { text: string } | { inlineData: { mimeType: string; data: string } };

async function generateJson<T>(schema: ZodType<T>, parts: Part[], systemInstruction?: string): Promise<T> {
  const genai = await ai();
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await genai.models.generateContent({
        model: env().GEMINI_MODEL,
        contents: [{ role: "user", parts }],
        config: {
          systemInstruction,
          // Gemini 3 thinks before answering; keep it brief so replies stay fast
          // and the thinking budget never crowds out the JSON answer.
          thinkingConfig: { thinkingLevel: "LOW" as ThinkingLevel },
          maxOutputTokens: 8192,
          responseMimeType: "application/json",
          httpOptions: { timeout: TIMEOUT_MS },
        },
      });
      const parsed = schema.safeParse(JSON.parse(res.text ?? ""));
      if (parsed.success) return parsed.data;
      log.warn("Gemini output failed validation", { attempt });
    } catch (err) {
      const message = errorMessage(err);
      if (/429|quota|RESOURCE_EXHAUSTED/i.test(message))
        throw fail.unavailable("AI help is busy right now. Please try again in a minute.");
      if (attempt === 2 || !(err instanceof SyntaxError)) {
        log.error("Gemini request failed", { attempt, error: message.slice(0, 200) });
        throw fail.unavailable("AI help could not answer just now. You can enter details by hand.");
      }
    }
  }
  throw fail.unavailable("AI help returned something we could not use. Please enter details by hand.");
}

const nullableText = (max: number) =>
  z
    .string()
    .max(max)
    .nullable()
    .transform((v) => (v && v.trim() ? v.trim() : null));

export const extractedMedicineSchema = z.object({
  name: z.string().trim().min(1).max(80),
  dose: nullableText(60),
  frequency: nullableText(60),
  durationDays: z.number().int().min(1).max(365).nullable(),
  instructions: nullableText(160),
});

const extractionSchema = z.object({ medicines: z.array(extractedMedicineSchema).max(20) });

export async function extractPrescription(imageBase64: string, mimeType: string) {
  const result = await generateJson(
    extractionSchema,
    [{ inlineData: { mimeType, data: imageBase64 } }, { text: PRESCRIPTION_USER }],
    PRESCRIPTION_SYSTEM,
  );
  return result.medicines;
}

const explanationSchema = z.object({ explanation: z.string().trim().min(5).max(600) });

export const EXPLAINER_DISCLAIMER = {
  en: "Please confirm with your doctor or pharmacist.",
  hi: "कृपया अपने डॉक्टर या फार्मासिस्ट से पुष्टि करें।",
} as const;

/** Only the medicine name is sent: no names, emails or phone numbers. */
export async function explainMedicine(medicineName: string, language: "en" | "hi"): Promise<string> {
  const safeName = medicineName.replace(/[<>]/g, "").slice(0, 80);
  const { explanation } = await generateJson(explanationSchema, [{ text: explainerPrompt(safeName, language) }]);
  return `${explanation} ${EXPLAINER_DISCLAIMER[language]}`;
}

const briefSchema = z.object({ bullets: z.array(z.string().trim().min(1).max(240)).min(1).max(8) });

/** Facts are anonymised before this call: medicine names and counts only. */
export async function summariseForDoctor(facts: string): Promise<string[]> {
  const { bullets } = await generateJson(briefSchema, [{ text: facts.slice(0, 6000) }], BRIEF_SYSTEM);
  return bullets;
}
