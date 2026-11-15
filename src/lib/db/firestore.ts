import { Firestore, type Query } from "@google-cloud/firestore";
import type { Db, DocData, QueryOptions, Tx } from "./types";

const GRPC_ALREADY_EXISTS = 6;

/** Cloud Firestore implementation of {@link Db}. Uses Application Default Credentials on Cloud Run. */
export class FirestoreDb implements Db {
  constructor(private readonly fs: Firestore) {}

  async get<T>(collection: string, id: string): Promise<T | null> {
    const snap = await this.fs.collection(collection).doc(id).get();
    return snap.exists ? (snap.data() as T) : null;
  }

  async query<T>(collection: string, options: QueryOptions = {}): Promise<T[]> {
    let q: Query = this.fs.collection(collection);
    for (const [field, op, value] of options.where ?? []) q = q.where(field, op, value);
    if (options.orderBy) q = q.orderBy(options.orderBy.field, options.orderBy.direction ?? "asc");
    if (options.limit !== undefined) q = q.limit(options.limit);
    const snap = await q.get();
    return snap.docs.map((d) => d.data() as T);
  }

  async set(collection: string, id: string, data: object): Promise<void> {
    await this.fs.collection(collection).doc(id).set(data);
  }

  async create(collection: string, id: string, data: object): Promise<boolean> {
    try {
      await this.fs.collection(collection).doc(id).create(data);
      return true;
    } catch (err) {
      if ((err as { code?: number }).code === GRPC_ALREADY_EXISTS) return false;
      throw err;
    }
  }

  async update(collection: string, id: string, patch: DocData): Promise<void> {
    await this.fs.collection(collection).doc(id).update(patch);
  }

  async delete(collection: string, id: string): Promise<void> {
    await this.fs.collection(collection).doc(id).delete();
  }

  async deleteTree(collection: string, id: string): Promise<void> {
    await this.fs.recursiveDelete(this.fs.collection(collection).doc(id));
  }

  async transaction<R>(fn: (tx: Tx) => Promise<R>): Promise<R> {
    return this.fs.runTransaction(async (t) => {
      const ref = (c: string, id: string) => this.fs.collection(c).doc(id);
      const tx: Tx = {
        get: async <T>(c: string, id: string) => {
          const snap = await t.get(ref(c, id));
          return snap.exists ? (snap.data() as T) : null;
        },
        set: (c, id, data) => void t.set(ref(c, id), data),
        update: (c, id, patch) => void t.update(ref(c, id), patch),
        create: (c, id, data) => void t.create(ref(c, id), data),
        delete: (c, id) => void t.delete(ref(c, id)),
      };
      return fn(tx);
    });
  }
}
