import { apiRoute } from "@/lib/api/handler";
import { notFound } from "@/lib/errors";
import { authorizeFileRead, readFile } from "@/server/services/files";

/** Streams a private file after re-checking access to the record that owns it. */
export const GET = apiRoute({ auth: "member" }, async ({ context, request }) => {
  const path = request.nextUrl.searchParams.get("path");
  if (!path) throw notFound();
  await authorizeFileRead(context, path);
  const { bytes, contentType } = await readFile(path);
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, no-store",
      "Content-Disposition": contentType === "application/pdf" ? "inline" : "inline",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
