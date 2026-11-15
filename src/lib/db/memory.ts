import type { Db, DocData, QueryOptions, Tx, Where } from "./types";

type Store = Map<string, Map<string, DocData>>;

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

class TransactionConflict extends Error {}

/**
 * In-memory implementation of {@link Db}. Transactions are serialised with a
 * promise-chain lock and buffer their writes until commit, mirroring
 * Firestore semantics closely enough for concurrency tests.
 */
export class MemoryDb implements Db {
  private store: Store = new Map();
  private lock: Promise<unknown> = Promise.resolve();

  private col(name: string): Map<string, DocData> {
    let c = this.store.get(name);
    if (!c) {
      c = new Map();
      this.store.set(name, c);
    }
    return c;
  }

  async get<T>(collection: string, id: string): Promise<T | null> {
    const doc = this.col(collection).get(id);
    return doc ? (structuredClone(doc) as T) : null;
  }

  async query<T>(collection: string, options: QueryOptions = {}): Promise<T[]> {
    let docs = [...this.col(collection).values()];
    for (const w of options.where ?? []) docs = docs.filter((d) => matches(d, w));
    if (options.orderBy) {
      const { field, direction = "asc" } = options.orderBy;
      docs.sort((a, b) => compare(a[field], b[field]) * (direction === "asc" ? 1 : -1));
    }
    if (options.limit !== undefined) docs = docs.slice(0, options.limit);
    return docs.map((d) => structuredClone(d) as T);
  }

  async set(collection: string, id: string, data: object): Promise<void> {
    this.col(collection).set(id, structuredClone(data) as DocData);
  }

  async create(collection: string, id: string, data: object): Promise<boolean> {
    const c = this.col(collection);
    if (c.has(id)) return false;
    c.set(id, structuredClone(data) as DocData);
    return true;
  }

  async update(collection: string, id: string, patch: DocData): Promise<void> {
    const c = this.col(collection);
    const existing = c.get(id);
    if (!existing) throw new Error(`Document not found: ${collection}/${id}`);
    c.set(id, { ...existing, ...structuredClone(patch) });
  }

  async delete(collection: string, id: string): Promise<void> {
    this.col(collection).delete(id);
  }

  async deleteTree(collection: string, id: string): Promise<void> {
    this.col(collection).delete(id);
    const prefix = `${collection}/${id}/`;
    for (const name of [...this.store.keys()]) if (name.startsWith(prefix)) this.store.delete(name);
  }

  async transaction<R>(fn: (tx: Tx) => Promise<R>): Promise<R> {
    const run = async (): Promise<R> => {
      const writes: Array<() => void> = [];
      const tx: Tx = {
        get: (c, id) => this.get(c, id),
        set: (c, id, data) => writes.push(() => this.col(c).set(id, structuredClone(data) as DocData)),
        update: (c, id, patch) =>
          writes.push(() => {
            const existing = this.col(c).get(id);
            if (!existing) throw new TransactionConflict(`Document not found: ${c}/${id}`);
            this.col(c).set(id, { ...existing, ...structuredClone(patch) });
          }),
        create: (c, id, data) =>
          writes.push(() => {
            if (this.col(c).has(id)) throw new TransactionConflict(`Document exists: ${c}/${id}`);
            this.col(c).set(id, structuredClone(data) as DocData);
          }),
        delete: (c, id) => writes.push(() => this.col(c).delete(id)),
      };
      const result = await fn(tx);
      for (const w of writes) w();
      return result;
    };
    const next = this.lock.then(run, run);
    this.lock = next.catch(() => undefined);
    return next;
  }
}
