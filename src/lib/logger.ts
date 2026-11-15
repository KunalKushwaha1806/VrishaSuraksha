/**
 * Structured JSON logs. Cloud Run forwards stdout to Cloud Logging, which
 * parses "severity" and "message" automatically. Never log secrets or
 * medical free text here.
 */
type Severity = "DEBUG" | "INFO" | "WARNING" | "ERROR";

function write(severity: Severity, message: string, fields: Record<string, unknown> = {}): void {
  if (process.env.NODE_ENV === "test" && severity !== "ERROR") return;
  const line = JSON.stringify({ severity, message, ...fields, time: new Date().toISOString() });
  if (severity === "ERROR") console.error(line);
  else console.log(line);
}

export const log = {
  debug: (m: string, f?: Record<string, unknown>) => write("DEBUG", m, f),
  info: (m: string, f?: Record<string, unknown>) => write("INFO", m, f),
  warn: (m: string, f?: Record<string, unknown>) => write("WARNING", m, f),
  error: (m: string, f?: Record<string, unknown>) => write("ERROR", m, f),
};

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
