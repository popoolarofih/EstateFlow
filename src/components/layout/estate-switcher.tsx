"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Field, Select } from "@/components/ui/field";
import { Notice } from "@/components/ui/feedback";
import { api, errorMessage } from "@/lib/api/client";

export function EstateSwitcher({ estates, activeEstateId }: { estates: { id: string; name: string; role: string }[]; activeEstateId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  if (estates.length < 2) return null;
  return (
    <div className="flex flex-col gap-2">
      <Field id="estate-switcher" label="Active estate" hint="You are a member of more than one estate.">
        <Select
          id="estate-switcher"
          defaultValue={activeEstateId}
          disabled={pending}
          onChange={async (event) => {
            setPending(true);
            setError(null);
            try {
              const { redirectTo } = await api<{ redirectTo: string }>("/api/auth/estate", { json: { estateId: event.target.value } });
              router.replace(redirectTo);
              router.refresh();
            } catch (caught) {
              setError(errorMessage(caught));
              setPending(false);
            }
          }}
        >
          {estates.map((estate) => (
            <option key={estate.id} value={estate.id}>
              {estate.name} ({estate.role})
            </option>
          ))}
        </Select>
      </Field>
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  );
}
