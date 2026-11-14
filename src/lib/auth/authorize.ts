import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { can, type Action } from "@/lib/auth/permissions";
import { getSessionUser, type SessionUser } from "@/lib/auth/session";
import { forbidden, notFound, unauthenticated } from "@/lib/errors";
import { adminDb } from "@/lib/firebase/admin";
import { fromDoc, fromQuery } from "@/lib/firestore/convert";
import { COLLECTIONS, memberDocId } from "@/lib/firestore/paths";
import type { Estate, EstateMember, UserProfile } from "@/types/domain";

/**
 * Tenant context for the current request. Membership documents are the source of truth for
 * estate access and role; nothing here trusts client supplied estate ids or roles.
 */
export interface ActiveContext {
  user: SessionUser;
  profile: UserProfile | null;
  member: EstateMember;
  estate: Estate;
  memberships: EstateMember[];
}

export const getActiveMemberships = cache(async (uid: string): Promise<EstateMember[]> => {
  const snapshot = await adminDb()
    .collection(COLLECTIONS.estateMembers)
    .where("uid", "==", uid)
    .where("status", "==", "active")
    .limit(20)
    .get();
  return fromQuery<EstateMember>(snapshot);
});

export const getProfile = cache(async (uid: string): Promise<UserProfile | null> => {
  return fromDoc<UserProfile>(await adminDb().collection(COLLECTIONS.users).doc(uid).get());
});

export const getActiveContext = cache(async (): Promise<ActiveContext | null> => {
  const user = await getSessionUser();
  if (!user) return null;
  const [memberships, profile] = await Promise.all([getActiveMemberships(user.uid), getProfile(user.uid)]);
  if (memberships.length === 0) return null;

  const preferred = profile?.activeEstateId ?? null;
  const ordered = [...memberships].sort((a, b) => Number(b.estateId === preferred) - Number(a.estateId === preferred));
  for (const member of ordered) {
    const estate = fromDoc<Estate>(await adminDb().collection(COLLECTIONS.estates).doc(member.estateId).get());
    if (estate && estate.status === "active") {
      return { user, profile, member, estate, memberships };
    }
  }
  return null;
});

function allowed(context: ActiveContext, actions: Action | readonly Action[]): boolean {
  const list = typeof actions === "string" ? [actions] : actions;
  return list.some((action) => can(context.member, action));
}

/** For Server Components: redirects instead of throwing. Any one of `actions` is sufficient. */
export async function requirePageContext(actions?: Action | readonly Action[]): Promise<ActiveContext> {
  // Authenticated content is always request time (it also reads the clock), never prerendered.
  await connection();
  const user = await getSessionUser();
  if (!user) redirect("/sign-in");
  const context = await getActiveContext();
  if (!context) redirect(user.platformAdmin ? "/platform" : "/no-access");
  if (actions && !allowed(context, actions)) redirect("/no-access?reason=role");
  return context;
}

/** For route handlers: throws `AppError`s that the API wrapper turns into JSON responses. */
export async function requireApiContext(actions?: Action | readonly Action[]): Promise<ActiveContext> {
  const user = await getSessionUser();
  if (!user) throw unauthenticated();
  const context = await getActiveContext();
  if (!context) throw forbidden("You are not an active member of an estate.");
  if (actions && !allowed(context, actions)) throw forbidden();
  return context;
}

/**
 * Guards a loaded tenant record. Records from another estate are reported as not found so
 * the response never reveals that they exist.
 */
export function assertSameEstate<T extends { estateId: string }>(record: T | null, context: ActiveContext): T {
  if (!record || record.estateId !== context.estate.id) throw notFound();
  return record;
}

export async function loadMember(uid: string, estateId: string): Promise<EstateMember | null> {
  return fromDoc<EstateMember>(
    await adminDb().collection(COLLECTIONS.estateMembers).doc(memberDocId(uid, estateId)).get(),
  );
}

export function actorName(context: ActiveContext): string {
  return context.profile?.displayName || context.member.displayName || context.user.email || "Member";
}
