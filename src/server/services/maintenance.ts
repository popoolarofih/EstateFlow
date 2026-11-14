import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import type { z } from "zod";
import { assertSameEstate, loadMember } from "@/lib/auth/authorize";
import { can } from "@/lib/auth/permissions";
import { auditInTransaction } from "@/lib/audit/audit";
import { AppError, conflict, forbidden, notFound, precondition } from "@/lib/errors";
import { adminDb } from "@/lib/firebase/admin";
import { fromDoc } from "@/lib/firestore/convert";
import { COLLECTIONS } from "@/lib/firestore/paths";
import { canTransition, STATUS_LABELS, targetSlaFor } from "@/lib/maintenance/workflow";
import { memberUidsWithRoles } from "@/lib/notifications/notify";
import { validateUpload } from "@/lib/uploads";
import type { commentTicketSchema, createTicketSchema, transitionTicketSchema } from "@/lib/validation/maintenance";
import type { MaintenanceTicket, TicketEvent, Unit } from "@/types/domain";
import { appNotifier, type ServiceContext } from "./context";
import { deleteFiles, storeFile } from "./files";

type NewEvent = Omit<TicketEvent, "id" | "createdAt"> & { createdAt: FieldValue };

export async function createTicket(
  { context, actor }: ServiceContext,
  input: z.output<typeof createTicketSchema>,
  photos: File[],
): Promise<{ id: string }> {
  if (!can(context.member, "maintenance.create")) throw forbidden();
  if (!context.member.unitId) throw precondition("Your membership is not linked to a unit yet.");
  const db = adminDb();
  const unit = assertSameEstate(fromDoc<Unit>(await db.collection(COLLECTIONS.units).doc(context.member.unitId).get()), context);
  const ref = db.collection(COLLECTIONS.maintenanceTickets).doc();
  const uploads = await Promise.all(photos.map((photo) => validateUpload(photo, "image")));
  const paths: string[] = [];
  try {
    for (const upload of uploads) paths.push(await storeFile(context.estate.id, "tickets", ref.id, upload));
    const now = new Date();
    const ticket: Omit<MaintenanceTicket, "id" | "createdAt" | "updatedAt"> & { createdAt: FieldValue; updatedAt: FieldValue } = {
      estateId: context.estate.id,
      unitId: unit.id,
      unitLabel: unit.label,
      createdByUid: context.member.uid,
      createdByName: actor.name,
      category: input.category,
      title: input.title,
      description: input.description,
      photoPaths: paths,
      priority: input.priority,
      status: "new",
      assignedToUid: null,
      assignedToName: null,
      targetSlaAt: targetSlaFor(input.priority, now),
      resolutionNotes: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      resolvedAt: null,
      closedAt: null,
    };
    const batch = db.batch();
    batch.create(ref, ticket);
    batch.create(ref.collection(COLLECTIONS.ticketEvents).doc(), {
      estateId: context.estate.id,
      type: "created",
      fromStatus: null,
      toStatus: "new",
      body: null,
      actorUid: context.member.uid,
      actorName: actor.name,
      createdAt: FieldValue.serverTimestamp(),
    } satisfies NewEvent);
    auditInTransaction(db, batch, actor, {
      estateId: context.estate.id,
      action: "ticket.created",
      entityType: "maintenanceTicket",
      entityId: ref.id,
      after: { category: input.category, priority: input.priority },
    });
    await batch.commit();
  } catch (error) {
    await deleteFiles(paths);
    throw error;
  }
  const managers = await memberUidsWithRoles(db, context.estate.id, ["manager"]);
  await appNotifier().send(managers, {
    estateId: context.estate.id,
    type: "ticket.created",
    title: `New ${input.priority === "urgent" ? "urgent " : ""}maintenance request`,
    body: `${unit.label}: ${input.title}`,
    link: `/admin/maintenance/${ref.id}`,
    priority: input.priority === "urgent" ? "high" : "normal",
  });
  return { id: ref.id };
}

export async function transitionTicket(
  { context, actor }: ServiceContext,
  ticketId: string,
  input: z.output<typeof transitionTicketSchema>,
  now = new Date(),
): Promise<void> {
  const db = adminDb();
  const ref = db.collection(COLLECTIONS.maintenanceTickets).doc(ticketId);
  const isManager = can(context.member, "maintenance.manage");

  let assigneeName: string | null = null;
  if (input.to === "assigned" && input.assigneeUid) {
    if (!isManager) throw forbidden();
    const assignee = await loadMember(input.assigneeUid, context.estate.id);
    if (!assignee || assignee.status !== "active" || assignee.role !== "manager") {
      throw new AppError("validation_failed", "Assign the ticket to an active facility manager.");
    }
    assigneeName = assignee.displayName;
  }

  const ticket = await db.runTransaction(async (tx) => {
    const current = assertSameEstate(fromDoc<MaintenanceTicket>(await tx.get(ref)), context);
    const isOwner = current.unitId === context.member.unitId && can(context.member, "maintenance.viewOwn");
    if (!isManager && !isOwner) throw notFound();
    const decision = canTransition({
      ticket: current,
      to: input.to,
      actor: isManager ? "manager" : "owner",
      now,
      reopenDays: context.estate.settings.ticketReopenDays,
      assigneeUid: input.assigneeUid,
      resolutionNotes: input.resolutionNotes,
    });
    if (!decision.ok) throw conflict(decision.message);

    const update: Record<string, unknown> = { status: input.to, updatedAt: FieldValue.serverTimestamp() };
    if (input.to === "assigned") {
      update.assignedToUid = input.assigneeUid;
      update.assignedToName = assigneeName;
    }
    if (input.to === "resolved") {
      update.resolvedAt = FieldValue.serverTimestamp();
      update.resolutionNotes = input.resolutionNotes;
    }
    if (input.to === "closed") update.closedAt = FieldValue.serverTimestamp();
    if (input.to === "triaged" && (current.status === "resolved" || current.status === "closed")) {
      update.resolvedAt = null;
      update.closedAt = null;
    }
    if (isManager && input.priority && input.priority !== current.priority) {
      update.priority = input.priority;
      update.targetSlaAt = targetSlaFor(input.priority, current.createdAt);
    }
    tx.update(ref, update);
    tx.create(ref.collection(COLLECTIONS.ticketEvents).doc(), {
      estateId: current.estateId,
      type: input.to === "assigned" ? "assignment" : "status_change",
      fromStatus: current.status,
      toStatus: input.to,
      body: input.to === "assigned" ? `Assigned to ${assigneeName}` : (input.resolutionNotes ?? null),
      actorUid: context.member.uid,
      actorName: actor.name,
      createdAt: FieldValue.serverTimestamp(),
    } satisfies NewEvent);
    auditInTransaction(db, tx, actor, {
      estateId: current.estateId,
      action: "ticket.status_changed",
      entityType: "maintenanceTicket",
      entityId: ticketId,
      before: { status: current.status },
      after: { status: input.to, assignedToUid: input.assigneeUid ?? current.assignedToUid },
    });
    return current;
  });

  const recipients = isManager ? [ticket.createdByUid] : await memberUidsWithRoles(db, context.estate.id, ["manager"]);
  if (input.to === "assigned" && input.assigneeUid) recipients.push(input.assigneeUid);
  await appNotifier().send(recipients.filter((uid) => uid !== context.member.uid), {
    estateId: ticket.estateId,
    type: "ticket.status_changed",
    title: `Ticket ${STATUS_LABELS[input.to].toLowerCase()}`,
    body: ticket.title,
    link: isManager ? `/resident/services/${ticketId}` : `/admin/maintenance/${ticketId}`,
  });
}

export async function commentOnTicket(
  { context, actor }: ServiceContext,
  ticketId: string,
  input: z.output<typeof commentTicketSchema>,
): Promise<void> {
  if (!can(context.member, "maintenance.comment")) throw forbidden();
  const db = adminDb();
  const ref = db.collection(COLLECTIONS.maintenanceTickets).doc(ticketId);
  const ticket = assertSameEstate(fromDoc<MaintenanceTicket>(await ref.get()), context);
  const isManager = can(context.member, "maintenance.manage");
  if (!isManager && ticket.unitId !== context.member.unitId) throw notFound();
  if (ticket.status === "closed") throw conflict("Reopen the ticket before adding comments.");
  const batch = db.batch();
  batch.create(ref.collection(COLLECTIONS.ticketEvents).doc(), {
    estateId: ticket.estateId,
    type: "comment",
    fromStatus: null,
    toStatus: null,
    body: input.body,
    actorUid: context.member.uid,
    actorName: actor.name,
    createdAt: FieldValue.serverTimestamp(),
  } satisfies NewEvent);
  batch.update(ref, { updatedAt: FieldValue.serverTimestamp() });
  await batch.commit();
  const recipients = isManager
    ? [ticket.createdByUid]
    : ticket.assignedToUid
      ? [ticket.assignedToUid]
      : await memberUidsWithRoles(db, ticket.estateId, ["manager"]);
  await appNotifier().send(recipients.filter((uid) => uid !== context.member.uid), {
    estateId: ticket.estateId,
    type: "ticket.comment",
    title: "New comment on a ticket",
    body: ticket.title,
    link: isManager ? `/resident/services/${ticketId}` : `/admin/maintenance/${ticketId}`,
  });
}
