import { apiRoute } from "@/lib/api/handler";
import { receiptFor } from "@/server/repositories";
import { renderReceiptPdf } from "@/server/services/receipts";

/** Downloadable PDF receipt; only exists for server verified payments. */
export const GET = apiRoute({ auth: "member", action: ["invoice.viewOwn", "invoice.viewAll"] }, async ({ context, params }) => {
  const receipt = await receiptFor(context, params.paymentId!);
  const pdf = await renderReceiptPdf(receipt, context.estate);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="receipt_${receipt.receiptNumber}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
});
