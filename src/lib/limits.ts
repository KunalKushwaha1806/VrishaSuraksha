/** Upload limits shared by browser and server (kept free of dependencies so the client bundle stays small). */
export const MAX_VOICE_BYTES = 400 * 1024;
export const MAX_VOICE_SECONDS = 15;
export const VOICE_MIME_TYPES = ["audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg"] as const;
export const MAX_IMAGE_BYTES = 1_500_000;
