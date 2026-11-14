import { Timestamp, type DocumentSnapshot, type QuerySnapshot } from "firebase-admin/firestore";

/** Recursively converts Firestore Timestamps into JavaScript Dates. */
export function reviveTimestamps<T>(value: unknown): T {
  if (value instanceof Timestamp) return value.toDate() as T;
  if (Array.isArray(value)) return value.map((item) => reviveTimestamps(item)) as T;
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) out[key] = reviveTimestamps(item);
    return out as T;
  }
  return value as T;
}

export function fromDoc<T extends { id: string }>(snapshot: DocumentSnapshot): T | null {
  if (!snapshot.exists) return null;
  return { ...reviveTimestamps<Omit<T, "id">>(snapshot.data()), id: snapshot.id } as T;
}

export function fromQuery<T extends { id: string }>(snapshot: QuerySnapshot): T[] {
  return snapshot.docs.map((doc) => ({ ...reviveTimestamps<Omit<T, "id">>(doc.data()), id: doc.id }) as T);
}
