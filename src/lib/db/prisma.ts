import { Prisma, PrismaClient } from "@prisma/client";
import type { Db, DocData, QueryOptions, Tx, Where } from "./types";

const globalForPrisma = globalThis as unknown as { __prisma?: PrismaClient };

export const prisma =
  globalForPrisma.__prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__prisma = prisma;
}

function compare(a: unknown, b: unknown): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
}

function matches(doc: DocData, [field, op, value]: Where): boolean {
  const v = doc[field];
  switch (op) {
    case "==":
      return v === value;
    case "in":
      return Array.isArray(value) && value.includes(v);
    default:
      if (v === undefined || v === null) return false;
      if (op === "<") return compare(v, value) < 0;
      if (op === "<=") return compare(v, value) <= 0;
      if (op === ">") return compare(v, value) > 0;
      return compare(v, value) >= 0;
  }
}

function toJsonInput(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

/**
 * PostgreSQL database implementation of Db via Prisma.
 * Persists collections to PostgreSQL on Neon / Supabase with ACID transactions.
 */
export class PrismaDb implements Db {
  constructor(private readonly client: PrismaClient = prisma) {}

  async get<T>(collection: string, id: string): Promise<T | null> {
    const row = await this.client.documentStore.findUnique({
      where: { collection_id: { collection, id } },
    });
    return row ? (row.data as T) : null;
  }

  async query<T>(collection: string, options: QueryOptions = {}): Promise<T[]> {
    const rows = await this.client.documentStore.findMany({
      where: { collection },
    });
    let docs = rows.map((r) => r.data as DocData);
    for (const w of options.where ?? []) {
      docs = docs.filter((d) => matches(d, w));
    }
    if (options.orderBy) {
      const { field, direction = "asc" } = options.orderBy;
      docs.sort((a, b) => compare(a[field], b[field]) * (direction === "asc" ? 1 : -1));
    }
    if (options.limit !== undefined) {
      docs = docs.slice(0, options.limit);
    }
    return docs as T[];
  }

  async set(collection: string, id: string, data: object): Promise<void> {
    const docData = toJsonInput(data);
    await this.client.documentStore.upsert({
      where: { collection_id: { collection, id } },
      create: { collection, id, data: docData },
      update: { data: docData },
    });
  }

  async create(collection: string, id: string, data: object): Promise<boolean> {
    try {
      await this.client.documentStore.create({
        data: {
          collection,
          id,
          data: toJsonInput(data),
        },
      });
      return true;
    } catch (err: unknown) {
      const e = err as { code?: string } | undefined;
      if (e?.code === "P2002") {
        return false;
      }
      throw err;
    }
  }

  async update(collection: string, id: string, patch: DocData): Promise<void> {
    const existing = await this.get<DocData>(collection, id);
    if (!existing) {
      throw new Error(`Document not found: ${collection}/${id}`);
    }
    const merged = { ...existing, ...structuredClone(patch) };
    await this.client.documentStore.update({
      where: { collection_id: { collection, id } },
      data: { data: toJsonInput(merged) },
    });
  }

  async delete(collection: string, id: string): Promise<void> {
    try {
      await this.client.documentStore.delete({
        where: { collection_id: { collection, id } },
      });
    } catch (err: unknown) {
      const e = err as { code?: string } | undefined;
      if (e?.code !== "P2025") throw err;
    }
  }

  async deleteTree(collection: string, id: string): Promise<void> {
    await this.delete(collection, id);
    const prefix = `${collection}/${id}/`;
    await this.client.documentStore.deleteMany({
      where: {
        collection: {
          startsWith: prefix,
        },
      },
    });
  }

  async transaction<R>(fn: (tx: Tx) => Promise<R>): Promise<R> {
    return this.client.$transaction(async (prismaTx) => {
      const writes: Array<() => Promise<void>> = [];

      const tx: Tx = {
        get: async <T>(c: string, id: string) => {
          const row = await prismaTx.documentStore.findUnique({
            where: { collection_id: { collection: c, id } },
          });
          return row ? (row.data as T) : null;
        },
        set: (c, id, data) => {
          writes.push(async () => {
            const docData = toJsonInput(data);
            await prismaTx.documentStore.upsert({
              where: { collection_id: { collection: c, id } },
              create: { collection: c, id, data: docData },
              update: { data: docData },
            });
          });
        },
        update: (c, id, patch) => {
          writes.push(async () => {
            const existing = await prismaTx.documentStore.findUnique({
              where: { collection_id: { collection: c, id } },
            });
            if (!existing) throw new Error(`Document not found: ${c}/${id}`);
            const merged = { ...(existing.data as DocData), ...structuredClone(patch) };
            await prismaTx.documentStore.update({
              where: { collection_id: { collection: c, id } },
              data: { data: toJsonInput(merged) },
            });
          });
        },
        create: (c, id, data) => {
          writes.push(async () => {
            await prismaTx.documentStore.create({
              data: {
                collection: c,
                id,
                data: toJsonInput(data),
              },
            });
          });
        },
        delete: (c, id) => {
          writes.push(async () => {
            try {
              await prismaTx.documentStore.delete({
                where: { collection_id: { collection: c, id } },
              });
            } catch (err: unknown) {
              const e = err as { code?: string } | undefined;
              if (e?.code !== "P2025") throw err;
            }
          });
        },
      };

      const result = await fn(tx);
      for (const write of writes) {
        await write();
      }
      return result;
    });
  }
}
