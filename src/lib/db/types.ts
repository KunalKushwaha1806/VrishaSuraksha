/**
 * Minimal document-store contract shared by the Firestore backend
 * (production) and the in-memory backend (tests and keyless local demo).
 * Collections are slash-separated paths, e.g. "circles/abc/medications".
 */
export type WhereOp = "==" | "<" | "<=" | ">" | ">=" | "in";
export type Where = [field: string, op: WhereOp, value: unknown];

export interface QueryOptions {
  where?: Where[];
  orderBy?: { field: string; direction?: "asc" | "desc" };
  limit?: number;
}

export type DocData = Record<string, unknown>;

export interface Tx {
  get<T>(collection: string, id: string): Promise<T | null>;
  set(collection: string, id: string, data: object): void;
  update(collection: string, id: string, patch: DocData): void;
  /** Fails the whole transaction if the document already exists. */
  create(collection: string, id: string, data: object): void;
  delete(collection: string, id: string): void;
}

export interface Db {
  get<T>(collection: string, id: string): Promise<T | null>;
  query<T>(collection: string, options?: QueryOptions): Promise<T[]>;
  set(collection: string, id: string, data: object): Promise<void>;
  /** Creates the document only if absent. Returns false when it already existed. */
  create(collection: string, id: string, data: object): Promise<boolean>;
  update(collection: string, id: string, patch: DocData): Promise<void>;
  delete(collection: string, id: string): Promise<void>;
  /** Deletes a document and every subcollection beneath it. */
  deleteTree(collection: string, id: string): Promise<void>;
  transaction<R>(fn: (tx: Tx) => Promise<R>): Promise<R>;
}
