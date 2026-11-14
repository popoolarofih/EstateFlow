import { STATUS_LABELS } from "@/lib/maintenance/workflow";
import { formatDateTime } from "@/lib/time";
import type { TicketEvent } from "@/types/domain";

export function TicketTimeline({ events, timezone }: { events: TicketEvent[]; timezone: string }) {
  return (
    <ol className="flex flex-col gap-4 border-l-2 border-line pl-4" aria-label="Ticket timeline">
      {events.map((event) => (
        <li key={event.id} className="relative flex flex-col gap-1">
          <span aria-hidden className="absolute top-2 size-2 rounded-full bg-violet" style={{ left: "-21px" }} />
          <p className="title-4 text-ink">
            {event.type === "created" && "Request created"}
            {event.type === "comment" && `${event.actorName} commented`}
            {event.type === "assignment" && "Assigned"}
            {event.type === "status_change" && event.toStatus && `Moved to ${STATUS_LABELS[event.toStatus].toLowerCase()}`}
          </p>
          {event.body && <p className="body-6 whitespace-pre-line text-ink">{event.body}</p>}
          <p className="caption-5 text-muted">
            {event.actorName} · {formatDateTime(event.createdAt, timezone)}
          </p>
        </li>
      ))}
    </ol>
  );
}

export function TicketPhotos({ paths }: { paths: string[] }) {
  if (paths.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {paths.map((path, index) => (
        <a key={path} href={`/api/files?path=${encodeURIComponent(path)}`} target="_blank" rel="noopener" className="block overflow-hidden rounded-xl border border-line">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/files?path=${encodeURIComponent(path)}`} alt={`Photo ${index + 1} attached to the request`} className="aspect-square w-full object-cover" loading="lazy" />
        </a>
      ))}
    </div>
  );
}
