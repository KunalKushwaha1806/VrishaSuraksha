import { env } from "../env";
import { MemoryDb } from "./memory";
import type { Db } from "./types";

export type { Db, Tx, QueryOptions, Where } from "./types";

const globalForDb = globalThis as unknown as { __vsDb?: Db };

/** Returns the process-wide database (Firestore in production, memory otherwise). */
export async function getDb(): Promise<Db> {
  if (globalForDb.__vsDb) return globalForDb.__vsDb;
  if (env().DATA_BACKEND === "firestore") {
    const [{ Firestore }, { FirestoreDb }] = await Promise.all([
      import("@google-cloud/firestore"),
      import("./firestore"),
    ]);
    globalForDb.__vsDb = new FirestoreDb(
      new Firestore({ projectId: env().GOOGLE_CLOUD_PROJECT, ignoreUndefinedProperties: true }),
    );
  } else {
    globalForDb.__vsDb = new MemoryDb();
  }
  return globalForDb.__vsDb;
}

/** Test helper: install a fresh database instance. */
export function setDbForTests(db: Db): void {
  globalForDb.__vsDb = db;
}
