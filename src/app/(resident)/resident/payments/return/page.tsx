import type { Metadata } from "next";
import { Suspense } from "react";
import { PaymentReturn } from "@/components/resident/payment-return";
import { Card } from "@/components/ui/card";
import { ListSkeleton, Notice } from "@/components/ui/feedback";
import { requirePageContext } from "@/lib/auth/authorize";

export const metadata: Metadata = { title: "Confirming payment", robots: { index: false } };

async function ReturnContent({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePageContext("invoice.pay");
  const params = await searchParams;
  const reference = typeof params.reference === "string" ? params.reference : typeof params.trxref === "string" ? params.trxref : null;
  if (!reference || !/^ef_[a-f0-9]{24}$/.test(reference)) {
    return <Notice tone="error" title="Payment reference missing">Open your payments page to see the latest status.</Notice>;
  }
  return <PaymentReturn reference={reference} />;
}

export default function PaymentReturnPage({ searchParams }: PageProps<"/resident/payments/return">) {
  return (
    <Card className="py-10">
      <Suspense fallback={<ListSkeleton rows={1} label="Confirming payment" />}>
        <ReturnContent searchParams={searchParams} />
      </Suspense>
    </Card>
  );
}
