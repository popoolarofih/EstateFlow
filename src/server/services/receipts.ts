import "server-only";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { formatNaira } from "@/lib/money";
import { formatDateTime } from "@/lib/time";
import type { Estate, Receipt } from "@/types/domain";

/** Renders a verified payment receipt as a PDF. Standard PDF fonts cannot encode ₦, so "NGN" is used. */
export async function renderReceiptPdf(receipt: Receipt, estate: Estate): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Receipt ${receipt.receiptNumber}`);
  pdf.setProducer("EstateFlow");
  const page = pdf.addPage([595, 842]); // A4 in points
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const navy = rgb(0x10 / 255, 0x1b / 255, 0x35 / 255);
  const muted = rgb(0.4, 0.43, 0.5);
  const amount = formatNaira(receipt.amountKobo).replace("₦", "NGN ");

  let y = 780;
  page.drawText("EstateFlow", { x: 48, y, size: 12, font: bold, color: navy });
  page.drawText("Payment receipt", { x: 48, y: (y -= 40), size: 24, font: bold, color: navy });
  page.drawText(estate.name, { x: 48, y: (y -= 28), size: 12, font: regular, color: muted });
  page.drawText(estate.address, { x: 48, y: (y -= 16), size: 10, font: regular, color: muted });

  const rows: [string, string][] = [
    ["Receipt number", receipt.receiptNumber],
    ["Paid by", receipt.payerName],
    ["Unit", receipt.unitLabel],
    ["Billing period", receipt.periodKey],
    ["Payment reference", receipt.paymentId],
    ["Confirmed", formatDateTime(receipt.issuedAt, estate.timezone)],
  ];
  y -= 40;
  for (const [label, value] of rows) {
    page.drawText(label, { x: 48, y, size: 10, font: regular, color: muted });
    page.drawText(value, { x: 220, y, size: 11, font: regular, color: navy });
    y -= 24;
  }
  y -= 16;
  page.drawRectangle({ x: 48, y: y - 16, width: 499, height: 56, color: rgb(0.957, 0.969, 0.984) });
  page.drawText("Amount received", { x: 64, y: y + 12, size: 10, font: regular, color: muted });
  page.drawText(amount, { x: 64, y: y - 6, size: 18, font: bold, color: navy });

  page.drawText("This receipt was issued after the payment provider confirmed the transaction.", {
    x: 48,
    y: 80,
    size: 9,
    font: regular,
    color: muted,
  });
  return pdf.save();
}
