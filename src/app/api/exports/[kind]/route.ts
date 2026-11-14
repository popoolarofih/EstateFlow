import { apiRoute } from "@/lib/api/handler";
import { notFound } from "@/lib/errors";
import { buildExport, EXPORT_KINDS, type ExportKind } from "@/server/services/exports";

export const GET = apiRoute({ auth: "member", action: "reports.export" }, async ({ context, actor, params, request }) => {
  const kind = params.kind as ExportKind;
  if (!EXPORT_KINDS.includes(kind)) throw notFound();
  const search = request.nextUrl.searchParams;
  const { csv, filename } = await buildExport({ context, actor }, kind, {
    from: search.get("from"),
    to: search.get("to"),
  });
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
});
