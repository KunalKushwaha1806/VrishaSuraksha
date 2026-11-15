import { env, googleClientOptions } from "../env";
import { MemoryDb } from "./memory";
import type { Db } from "./types";

export type { Db, Tx, QueryOptions, Where } from "./types";

const globalForDb = globalThis as unknown as { __vsDb?: Db };

/** Returns the process-wide database (Prisma / PostgreSQL in production, memory otherwise). */
export async function getDb(): Promise<Db> {
  if (globalForDb.__vsDb) return globalForDb.__vsDb;
  const currentEnv = env();

  if (currentEnv.DATA_BACKEND === "prisma" || (currentEnv.DATABASE_URL && currentEnv.DATA_BACKEND !== "memory")) {
    const { PrismaDb } = await import("./prisma");
    globalForDb.__vsDb = new PrismaDb();
  } else if (currentEnv.DATA_BACKEND === "firestore") {
    const [{ Firestore }, { FirestoreDb }] = await Promise.all([
      import("@google-cloud/firestore"),
      import("./firestore"),
    ]);
    globalForDb.__vsDb = new FirestoreDb(
      new Firestore({ ...googleClientOptions(), ignoreUndefinedProperties: true, preferRest: true }),
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
