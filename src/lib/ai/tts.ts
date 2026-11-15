import type { TextToSpeechClient } from "@google-cloud/text-to-speech";
import { features, googleClientOptions } from "../env";
import { fail } from "../http";

/**
 * Google Cloud Text-to-Speech for the elder's spoken explanations. Many
 * phones ship without a Hindi browser voice, so the server provides one.
 * The browser's SpeechSynthesis is used as a fallback when this is off.
 */
let client: TextToSpeechClient | null = null;

export async function synthesize(text: string, language: "en" | "hi"): Promise<Buffer> {
  if (!features.tts()) throw fail.unavailable("Server voice is off; using the phone's voice instead.");
  if (!client) {
    const { TextToSpeechClient } = await import("@google-cloud/text-to-speech");
    client = new TextToSpeechClient({ ...googleClientOptions() });
  }
  const [response] = await client.synthesizeSpeech({
    input: { text: text.slice(0, 1000) },
    voice: { languageCode: language === "hi" ? "hi-IN" : "en-IN", ssmlGender: "FEMALE" },
    audioConfig: { audioEncoding: "MP3", speakingRate: 0.9 },
  });
  if (!response.audioContent) throw fail.unavailable("No audio was produced.");
  return Buffer.from(response.audioContent as Uint8Array);
}
