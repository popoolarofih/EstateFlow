import { FieldValue, type Firestore, type Transaction, type WriteBatch } from "firebase-admin/firestore";
import { COLLECTIONS } from "@/lib/firestore/paths";

/**
 * Append only audit trail (blueprint section 8). Audit records are written inside the same
 * transaction or batch as the change they describe so they can never drift apart.
 */
export interface AuditActor {
  uid: string;
  name: string;
  ipHash?: string | null;
  userAgent?: string | null;
}

export interface AuditInput {
  estateId: string;
  action: string;
  entityType: string;
  entityId: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}

function auditData(actor: AuditActor, input: AuditInput) {
  return {
    estateId: input.estateId,
    actorUid: actor.uid,
    actorName: actor.name,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    before: input.before ?? null,
    after: input.after ?? null,
    ipHash: actor.ipHash ?? null,
    userAgent: actor.userAgent?.slice(0, 256) ?? null,
    createdAt: FieldValue.serverTimestamp(),
  };
}

export function auditInTransaction(db: Firestore, tx: Transaction | WriteBatch, actor: AuditActor, input: AuditInput) {
  const ref = db.collection(COLLECTIONS.auditLogs).doc();
  // Both Transaction and WriteBatch expose a compatible `set(ref, data)`.
  (tx as WriteBatch).set(ref, auditData(actor, input));
  return ref.id;
}

export async function audit(db: Firestore, actor: AuditActor, input: AuditInput): Promise<string> {
  const ref = await db.collection(COLLECTIONS.auditLogs).add(auditData(actor, input));
  return ref.id;
}

export const SYSTEM_ACTOR: AuditActor = { uid: "system", name: "EstateFlow system" };
