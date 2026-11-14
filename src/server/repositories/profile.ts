import "server-only";
import type { ActiveContext } from "@/lib/auth/authorize";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { adminDb } from "@/lib/firebase/admin";
import { fromDoc } from "@/lib/firestore/convert";
import { COLLECTIONS } from "@/lib/firestore/paths";
import type { Estate, Unit } from "@/types/domain";

/** Profile page data: the member's unit label and the estates they can switch between. */
export async function profileDetails(context: ActiveContext) {
  const db = adminDb();
  const [unit, estates] = await Promise.all([
    context.member.unitId ? db.collection(COLLECTIONS.units).doc(context.member.unitId).get() : null,
    Promise.all(context.memberships.map((member) => db.collection(COLLECTIONS.estates).doc(member.estateId).get())),
  ]);
  const unitDoc = unit ? fromDoc<Unit>(unit) : null;
  return {
    unitLabel: unitDoc && unitDoc.estateId === context.estate.id ? unitDoc.label : null,
    estates: estates
      .map((snapshot, index) => {
        const estate = fromDoc<Estate>(snapshot);
        const member = context.memberships[index]!;
        return estate && estate.status === "active" ? { id: estate.id, name: estate.name, role: ROLE_LABELS[member.role] } : null;
      })
      .filter((value): value is { id: string; name: string; role: string } => value !== null),
  };
}
